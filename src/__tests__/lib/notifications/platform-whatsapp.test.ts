/**
 * Tests del canal de notificaciones de la plataforma (T1).
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mockSendTextMessage = vi.fn()
let platformConfig: Record<string, unknown> | null
let evolutionAvailable: boolean

vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: vi.fn(() => ({
        from: () => {
            const chain: Record<string, unknown> = {}
            chain.select = vi.fn(() => chain)
            chain.eq = vi.fn(() => chain)
            chain.maybeSingle = vi.fn(async () => ({ data: platformConfig ? { value: platformConfig } : null }))
            return chain
        },
    })),
    createClient: vi.fn(),
}))

vi.mock("@/lib/evolution", () => ({
    createEvolutionClient: vi.fn(async () =>
        evolutionAvailable ? { sendTextMessage: mockSendTextMessage } : null
    ),
}))

import { sendPlatformNotification } from "@/lib/notifications/platform-whatsapp"

beforeEach(() => {
    vi.clearAllMocks()
    platformConfig = { enabled: true, instance_name: "platform_notifications" }
    evolutionAvailable = true
    mockSendTextMessage.mockResolvedValue({ key: { id: "m1" } })
})

describe("sendPlatformNotification", () => {
    it("canal habilitado → envía desde la instancia platform", async () => {
        const result = await sendPlatformNotification("+57 300 111 2233", "hola merchant")

        expect(result).toEqual({ delivered: true })
        expect(mockSendTextMessage).toHaveBeenCalledWith("platform_notifications", {
            number: "573001112233",
            text: "hola merchant",
        })
    })

    it("canal deshabilitado (rollback operativo) → no envía", async () => {
        platformConfig = { enabled: false }

        const result = await sendPlatformNotification("573001112233", "hola")

        expect(result.delivered).toBe(false)
        expect(result.error).toBe("platform_channel_disabled")
        expect(mockSendTextMessage).not.toHaveBeenCalled()
    })

    it("sin config → deshabilitado por default (opt-in explícito)", async () => {
        platformConfig = null

        const result = await sendPlatformNotification("573001112233", "hola")

        expect(result.delivered).toBe(false)
        expect(result.error).toBe("platform_channel_disabled")
    })

    it("teléfono inválido → rechazado sin llamar al server", async () => {
        const result = await sendPlatformNotification("12345", "hola")

        expect(result.error).toBe("invalid_phone")
        expect(mockSendTextMessage).not.toHaveBeenCalled()
    })

    it("Evolution no configurada → delivered false sin lanzar", async () => {
        evolutionAvailable = false

        const result = await sendPlatformNotification("573001112233", "hola")

        expect(result.error).toBe("evolution_not_configured")
    })

    it("el server falla → delivered false con el error", async () => {
        mockSendTextMessage.mockRejectedValue(new Error("instance not connected"))

        const result = await sendPlatformNotification("573001112233", "hola")

        expect(result.delivered).toBe(false)
        expect(result.error).toContain("instance not connected")
    })
})
