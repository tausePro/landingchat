/**
 * Tests del action executor (T4.6.a): whitelist estricta, handlers por kind,
 * eventos con idempotency key, errores no propagados.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCouponInsert = vi.fn()
const mockProductUpdateSelect = vi.fn()
const mockEmit = vi.fn()
const mockSendOwner = vi.fn()

function productsChain() {
    const chain: Record<string, unknown> = {}
    for (const method of ["update", "eq"]) {
        chain[method] = vi.fn(() => chain)
    }
    chain.select = mockProductUpdateSelect
    return chain
}

vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: vi.fn(() => ({
        from: (table: string) => {
            if (table === "coupons") return { insert: mockCouponInsert }
            if (table === "products") return productsChain()
            throw new Error(`Tabla inesperada: ${table}`)
        },
    })),
    createClient: vi.fn(),
}))

vi.mock("@/lib/events/emit", () => ({
    emitPlatformEvent: (...args: unknown[]) => mockEmit(...args),
}))

vi.mock("@/lib/notifications/whatsapp", () => ({
    sendOwnerNotification: (...args: unknown[]) => mockSendOwner(...args),
}))

import { executeProposedAction } from "@/lib/copilot/actionExecutor"
import type { CopilotProposedAction } from "@/lib/copilot/types"

const BASE = { insightId: "insight-1", decidedBy: "user-1", organizationId: "org-1" }

function action(kind: string, params: Record<string, unknown> = {}): CopilotProposedAction {
    return { kind: kind as CopilotProposedAction["kind"], human_label: "test", requires_approval: true, params }
}

beforeEach(() => {
    vi.clearAllMocks()
    mockCouponInsert.mockResolvedValue({ error: null })
    mockProductUpdateSelect.mockResolvedValue({ data: [{ id: "p1" }], error: null })
    mockEmit.mockResolvedValue({ ok: true })
    mockSendOwner.mockResolvedValue(true)
})

describe("executeProposedAction", () => {
    it("send_coupon_to_customers crea cupón real y avisa al owner", async () => {
        const result = await executeProposedAction({
            ...BASE,
            action: action("send_coupon_to_customers", { discount_percent: 15, expires_in_days: 7, customer_ids: ["c1", "c2"] }),
        })

        expect(result.ok).toBe(true)
        expect(mockCouponInsert).toHaveBeenCalledWith(expect.objectContaining({
            organization_id: "org-1",
            type: "percentage",
            value: 15,
            max_uses: 2,
            is_active: true,
        }))
        expect(mockSendOwner).toHaveBeenCalledWith("org-1", expect.stringContaining("15%"))
    })

    it("pause_product desactiva el producto del org", async () => {
        const result = await executeProposedAction({
            ...BASE,
            action: action("pause_product", { product_id: "p1" }),
        })

        expect(result.ok).toBe(true)
    })

    it("enable_product reactiva; producto de otro org → error sin propagar", async () => {
        mockProductUpdateSelect.mockResolvedValue({ data: [], error: null })

        const result = await executeProposedAction({
            ...BASE,
            action: action("enable_product", { product_id: "p-ajeno" }),
        })

        expect(result.ok).toBe(false)
        expect(result.error).toBe("product_not_found_in_org")
        expect(mockEmit).not.toHaveBeenCalled()
    })

    it("notify_owner envía el mensaje al WhatsApp personal", async () => {
        const result = await executeProposedAction({
            ...BASE,
            action: action("notify_owner", { message: "Revisa el stock del Serum" }),
        })

        expect(result.ok).toBe(true)
        expect(mockSendOwner).toHaveBeenCalledWith("org-1", expect.stringContaining("Revisa el stock del Serum"))
    })

    it("kind fuera de whitelist → rechazado sin side effects", async () => {
        const result = await executeProposedAction({
            ...BASE,
            action: action("drop_database"),
        })

        expect(result.ok).toBe(false)
        expect(result.error).toContain("action_kind_not_whitelisted")
        expect(mockCouponInsert).not.toHaveBeenCalled()
        expect(mockSendOwner).not.toHaveBeenCalled()
        expect(mockEmit).not.toHaveBeenCalled()
    })

    it("emite COPILOT_ACTION_EXECUTED con idempotency key por (insight, kind)", async () => {
        await executeProposedAction({ ...BASE, action: action("notify_owner", { message: "ok" }) })
        await executeProposedAction({ ...BASE, action: action("notify_owner", { message: "ok" }) })

        // Mismo key en ambas: la dedupe real la hace el UNIQUE de platform_events (23505 → ok)
        const keys = mockEmit.mock.calls.map((call) => call[0].idempotencyKey)
        expect(keys).toEqual(["copilot.action.insight-1.notify_owner", "copilot.action.insight-1.notify_owner"])
    })

    it("cupón sin discount_percent válido → error controlado", async () => {
        const result = await executeProposedAction({
            ...BASE,
            action: action("send_coupon_to_customers", { discount_percent: 250 }),
        })

        expect(result.ok).toBe(false)
        expect(result.error).toBe("invalid_discount_percent")
        expect(mockCouponInsert).not.toHaveBeenCalled()
    })
})
