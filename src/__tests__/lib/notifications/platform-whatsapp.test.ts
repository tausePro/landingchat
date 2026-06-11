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

const mockSendTemplateMessage = vi.fn()
vi.mock("@/lib/whatsapp/meta-client", () => ({
    MetaCloudClient: class {
        sendTemplateMessage = mockSendTemplateMessage
    },
}))

vi.mock("@/lib/utils/encryption", () => ({
    encrypt: vi.fn((text: string) => `enc:${text}`),
    decrypt: vi.fn((text: string) => text.replace(/^enc:/, "")),
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

describe("sendPlatformNotification — provider meta (oficial)", () => {
    beforeEach(() => {
        platformConfig = {
            enabled: true,
            provider: "meta",
            meta_phone_number_id: "555000111",
            meta_access_token_encrypted: "enc:secret-token",
            meta_template_name: "platform_notification",
            meta_template_language: "es",
        }
        mockSendTemplateMessage.mockResolvedValue({ messages: [{ id: "wamid.1" }] })
    })

    it("envía por template con el mensaje como parámetro de body y el token desencriptado", async () => {
        const result = await sendPlatformNotification("573001112233", "reporte semanal")

        expect(result).toEqual({ delivered: true })
        expect(mockSendTemplateMessage).toHaveBeenCalledWith(
            "555000111",
            "secret-token",
            "573001112233",
            "platform_notification",
            "es",
            [{ type: "body", parameters: [{ type: "text", text: "reporte semanal" }] }]
        )
        expect(mockSendTextMessage).not.toHaveBeenCalled()
    })

    it("sin credenciales → meta_not_configured", async () => {
        platformConfig = { enabled: true, provider: "meta", meta_template_name: "x" }

        const result = await sendPlatformNotification("573001112233", "hola")

        expect(result.error).toBe("meta_not_configured")
        expect(mockSendTemplateMessage).not.toHaveBeenCalled()
    })

    it("sin template aprobado → meta_template_missing (no intenta texto libre)", async () => {
        platformConfig = {
            enabled: true,
            provider: "meta",
            meta_phone_number_id: "555000111",
            meta_access_token_encrypted: "enc:secret-token",
        }

        const result = await sendPlatformNotification("573001112233", "hola")

        expect(result.error).toBe("meta_template_missing")
    })

    it("Meta API falla → delivered false sin lanzar", async () => {
        mockSendTemplateMessage.mockRejectedValue(new Error("(#132001) template not found"))

        const result = await sendPlatformNotification("573001112233", "hola")

        expect(result.delivered).toBe(false)
        expect(result.error).toContain("132001")
    })
})
