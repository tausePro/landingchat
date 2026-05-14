/**
 * Tests focales para los server actions de control IA en chats:
 *   - `toggleAiEnabled`: hard pause manual (chats.ai_enabled).
 *   - `toggleHumanOnly`: whitelist permanente del cliente (customers.is_human_only).
 *
 * Ambas acciones deben:
 *   - Rechazar requests sin sesión válida.
 *   - Persistir el flag correcto en la tabla correspondiente.
 *   - Devolver `ActionResult` con success/error coherente.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// --- Mocks ------------------------------------------------------------------

const mockAuthGetUser = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockFrom = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockAuthGetUser },
        from: mockFrom,
    })),
}))

vi.mock("@/lib/whatsapp/provider", () => ({
    sendWhatsAppMessage: vi.fn(),
}))

beforeEach(() => {
    vi.clearAllMocks()
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } })

    // Por defecto: update().eq() resuelve sin error.
    mockEq.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockFrom.mockImplementation(() => ({ update: mockUpdate }))
})

// ---------------------------------------------------------------------------
// toggleAiEnabled
// ---------------------------------------------------------------------------

describe("toggleAiEnabled", () => {
    it("rechaza si no hay usuario autenticado", async () => {
        mockAuthGetUser.mockResolvedValue({ data: { user: null } })
        const { toggleAiEnabled } = await import("@/app/dashboard/chats/actions")

        const result = await toggleAiEnabled("chat-1", false)

        expect(result.success).toBe(false)
        if (!result.success) expect(result.error).toBe("Unauthorized")
        expect(mockFrom).not.toHaveBeenCalled()
    })

    it("hace update sobre tabla chats con ai_enabled=false (hard pause)", async () => {
        const { toggleAiEnabled } = await import("@/app/dashboard/chats/actions")

        const result = await toggleAiEnabled("chat-1", false)

        expect(result.success).toBe(true)
        if (result.success) expect(result.data.ai_enabled).toBe(false)
        expect(mockFrom).toHaveBeenCalledWith("chats")
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ ai_enabled: false })
        )
        expect(mockEq).toHaveBeenCalledWith("id", "chat-1")
    })

    it("propaga error de Supabase como ActionResult error", async () => {
        mockEq.mockResolvedValue({ error: { message: "boom" } })
        const { toggleAiEnabled } = await import("@/app/dashboard/chats/actions")

        const result = await toggleAiEnabled("chat-1", true)

        expect(result.success).toBe(false)
        if (!result.success) expect(result.error).toMatch(/boom/)
    })
})

// ---------------------------------------------------------------------------
// toggleHumanOnly
// ---------------------------------------------------------------------------

describe("toggleHumanOnly", () => {
    it("rechaza si no hay usuario autenticado", async () => {
        mockAuthGetUser.mockResolvedValue({ data: { user: null } })
        const { toggleHumanOnly } = await import("@/app/dashboard/chats/actions")

        const result = await toggleHumanOnly("customer-1", true)

        expect(result.success).toBe(false)
        if (!result.success) expect(result.error).toBe("Unauthorized")
        expect(mockFrom).not.toHaveBeenCalled()
    })

    it("marca cliente como human-only (whitelist) en customers", async () => {
        const { toggleHumanOnly } = await import("@/app/dashboard/chats/actions")

        const result = await toggleHumanOnly("customer-1", true)

        expect(result.success).toBe(true)
        if (result.success) expect(result.data.is_human_only).toBe(true)
        expect(mockFrom).toHaveBeenCalledWith("customers")
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ is_human_only: true })
        )
        expect(mockEq).toHaveBeenCalledWith("id", "customer-1")
    })

    it("desmarca cliente human-only (vuelve a flujo normal IA)", async () => {
        const { toggleHumanOnly } = await import("@/app/dashboard/chats/actions")

        const result = await toggleHumanOnly("customer-1", false)

        expect(result.success).toBe(true)
        if (result.success) expect(result.data.is_human_only).toBe(false)
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ is_human_only: false })
        )
    })

    it("propaga error de Supabase como ActionResult error", async () => {
        mockEq.mockResolvedValue({ error: { message: "rls denied" } })
        const { toggleHumanOnly } = await import("@/app/dashboard/chats/actions")

        const result = await toggleHumanOnly("customer-1", true)

        expect(result.success).toBe(false)
        if (!result.success) expect(result.error).toMatch(/rls denied/)
    })

    it("siempre incluye updated_at en el payload de update", async () => {
        const { toggleHumanOnly } = await import("@/app/dashboard/chats/actions")

        await toggleHumanOnly("customer-1", true)

        const updatePayload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
        expect(updatePayload).toHaveProperty("updated_at")
        expect(typeof updatePayload.updated_at).toBe("string")
    })
})
