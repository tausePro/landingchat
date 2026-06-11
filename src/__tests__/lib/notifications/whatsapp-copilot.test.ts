/**
 * Tests de sendCopilotInsight + formatInsightForWhatsApp (T4.5).
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mockInstanceSingle = vi.fn()
const mockInsightSingle = vi.fn()
const mockSendWhatsAppMessage = vi.fn()

function buildChain(result: { data: unknown }) {
    const chain: Record<string, unknown> = {}
    for (const method of ["select", "eq"]) {
        chain[method] = vi.fn(() => chain)
    }
    chain.single = vi.fn(async () => result === undefined ? { data: null } : result)
    return chain
}

const mockFrom = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: vi.fn(async () => ({ from: mockFrom })),
    createClient: vi.fn(),
}))

vi.mock("@/lib/whatsapp", () => ({
    sendWhatsAppMessage: (...args: unknown[]) => mockSendWhatsAppMessage(...args),
}))

import { sendCopilotInsight, formatInsightForWhatsApp } from "@/lib/notifications/whatsapp"

const CONNECTED_INSTANCE = {
    phone_number: "573001112233",
    notifications_enabled: true,
    notify_on_copilot_insight: true,
}

const INSIGHT = {
    title: "Semana fuerte",
    body: "Las ventas subieron 30%.",
    proposed_actions: [
        { human_label: "Enviar cupón a 3 clientes inactivos" },
        { human_label: "Pausar producto sin stock" },
    ],
}

beforeEach(() => {
    vi.clearAllMocks()
    mockInstanceSingle.mockResolvedValue({ data: CONNECTED_INSTANCE })
    mockInsightSingle.mockResolvedValue({ data: INSIGHT })
    mockSendWhatsAppMessage.mockResolvedValue({ messageId: "m1" })

    mockFrom.mockImplementation((table: string) => {
        if (table === "whatsapp_instances") {
            const chain = buildChain({ data: null })
            chain.single = mockInstanceSingle
            return chain
        }
        if (table === "copilot_insights") {
            const chain = buildChain({ data: null })
            chain.single = mockInsightSingle
            return chain
        }
        throw new Error(`Tabla inesperada: ${table}`)
    })
})

describe("sendCopilotInsight", () => {
    it("personal conectado con insights activos → envía el mensaje formateado", async () => {
        const result = await sendCopilotInsight({ organizationId: "org-1", insightId: "i-1" })

        expect(result).toBe(true)
        expect(mockSendWhatsAppMessage).toHaveBeenCalledWith(
            "org-1",
            "573001112233",
            expect.stringContaining("Atlas Copilot")
        )
    })

    it("instancia desconectada (sin fila) → false sin enviar", async () => {
        mockInstanceSingle.mockResolvedValue({ data: null })

        const result = await sendCopilotInsight({ organizationId: "org-1", insightId: "i-1" })

        expect(result).toBe(false)
        expect(mockSendWhatsAppMessage).not.toHaveBeenCalled()
    })

    it("notifications_enabled=false → no envía", async () => {
        mockInstanceSingle.mockResolvedValue({ data: { ...CONNECTED_INSTANCE, notifications_enabled: false } })

        expect(await sendCopilotInsight({ organizationId: "org-1", insightId: "i-1" })).toBe(false)
        expect(mockSendWhatsAppMessage).not.toHaveBeenCalled()
    })

    it("notify_on_copilot_insight=false → no envía", async () => {
        mockInstanceSingle.mockResolvedValue({ data: { ...CONNECTED_INSTANCE, notify_on_copilot_insight: false } })

        expect(await sendCopilotInsight({ organizationId: "org-1", insightId: "i-1" })).toBe(false)
        expect(mockSendWhatsAppMessage).not.toHaveBeenCalled()
    })

    it("insight inexistente → false sin enviar", async () => {
        mockInsightSingle.mockResolvedValue({ data: null })

        expect(await sendCopilotInsight({ organizationId: "org-1", insightId: "i-404" })).toBe(false)
        expect(mockSendWhatsAppMessage).not.toHaveBeenCalled()
    })
})

describe("formatInsightForWhatsApp", () => {
    it("numera las acciones y enlaza al dashboard", () => {
        const message = formatInsightForWhatsApp(INSIGHT)

        expect(message).toContain("1. Enviar cupón a 3 clientes inactivos")
        expect(message).toContain("2. Pausar producto sin stock")
        expect(message).toContain("/dashboard/copilot")
    })

    it("sin acciones → sin sección '¿Qué hacemos?'", () => {
        const message = formatInsightForWhatsApp({ ...INSIGHT, proposed_actions: [] })

        expect(message).not.toContain("¿Qué hacemos?")
        expect(message).toContain("Revisa el detalle en tu dashboard")
    })

    it("body de más de 800 chars se trunca con elipsis", () => {
        const message = formatInsightForWhatsApp({ ...INSIGHT, body: "x".repeat(1200) })

        expect(message).toContain("…")
        expect(message.length).toBeLessThan(1200)
    })
})
