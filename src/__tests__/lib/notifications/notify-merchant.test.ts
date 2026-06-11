/**
 * Tests de la cadena notifyMerchant (Platform Notifier v0 — T2):
 * personal del tenant → fallback platform → sin canal.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mockSendWhatsAppMessage = vi.fn()
const mockSendPlatform = vi.fn()

let personalInstance: Record<string, unknown> | null
let orgRow: Record<string, unknown> | null

vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: vi.fn(() => ({
        from: (table: string) => {
            const chain: Record<string, unknown> = {}
            chain.select = vi.fn(() => chain)
            chain.eq = vi.fn(() => chain)
            chain.maybeSingle = vi.fn(async () => ({ data: table === "whatsapp_instances" ? personalInstance : null }))
            chain.single = vi.fn(async () => ({ data: table === "organizations" ? orgRow : null }))
            return chain
        },
    })),
    createClient: vi.fn(),
}))

vi.mock("@/lib/whatsapp", () => ({
    sendWhatsAppMessage: (...args: unknown[]) => mockSendWhatsAppMessage(...args),
}))

vi.mock("@/lib/notifications/platform-whatsapp", () => ({
    sendPlatformNotification: (...args: unknown[]) => mockSendPlatform(...args),
}))

import { notifyMerchant } from "@/lib/notifications/notify-merchant"

const PERSONAL = {
    phone_number: "573001112233",
    notifications_enabled: true,
    notify_on_sale: true,
    notify_on_copilot_insight: true,
}

beforeEach(() => {
    vi.clearAllMocks()
    personalInstance = { ...PERSONAL }
    orgRow = { notification_phone: "573009998877" }
    mockSendWhatsAppMessage.mockResolvedValue({ messageId: "m1" })
    mockSendPlatform.mockResolvedValue({ delivered: true })
})

describe("notifyMerchant", () => {
    it("instancia personal conectada → entrega por canal personal", async () => {
        const result = await notifyMerchant({ organizationId: "org-1", message: "hola", kind: "sale" })

        expect(result).toEqual({ delivered: true, channel: "personal" })
        expect(mockSendWhatsAppMessage).toHaveBeenCalledWith("org-1", "573001112233", "hola")
        expect(mockSendPlatform).not.toHaveBeenCalled()
    })

    it("sin instancia personal → fallback al canal platform con notification_phone", async () => {
        personalInstance = null

        const result = await notifyMerchant({ organizationId: "org-1", message: "hola", kind: "copilot_insight" })

        expect(result).toEqual({ delivered: true, channel: "platform" })
        expect(mockSendPlatform).toHaveBeenCalledWith("573009998877", "hola")
    })

    it("toggle del kind apagado por el merchant → NO entrega y NO hace fallback (respeto al opt-out)", async () => {
        personalInstance = { ...PERSONAL, notify_on_copilot_insight: false }

        const result = await notifyMerchant({ organizationId: "org-1", message: "hola", kind: "copilot_insight" })

        expect(result.delivered).toBe(false)
        expect(result.error).toContain("disabled_by_merchant")
        expect(mockSendWhatsAppMessage).not.toHaveBeenCalled()
        expect(mockSendPlatform).not.toHaveBeenCalled()
    })

    it("master toggle apagado → NO entrega ni hace fallback", async () => {
        personalInstance = { ...PERSONAL, notifications_enabled: false }

        const result = await notifyMerchant({ organizationId: "org-1", message: "hola", kind: "system" })

        expect(result.delivered).toBe(false)
        expect(result.error).toContain("disabled_by_merchant")
        expect(mockSendPlatform).not.toHaveBeenCalled()
    })

    it("kind system ignora toggles de sale/copilot", async () => {
        personalInstance = { ...PERSONAL, notify_on_sale: false, notify_on_copilot_insight: false }

        const result = await notifyMerchant({ organizationId: "org-1", message: "aviso", kind: "system" })

        expect(result).toEqual({ delivered: true, channel: "personal" })
    })

    it("canal personal falla → intenta platform", async () => {
        mockSendWhatsAppMessage.mockRejectedValue(new Error("instance down"))

        const result = await notifyMerchant({ organizationId: "org-1", message: "hola", kind: "sale" })

        expect(result).toEqual({ delivered: true, channel: "platform" })
    })

    it("sin canal alguno → delivered false sin lanzar", async () => {
        personalInstance = null
        orgRow = { notification_phone: null }

        const result = await notifyMerchant({ organizationId: "org-1", message: "hola", kind: "sale" })

        expect(result).toEqual({ delivered: false, channel: null, error: "no_channel_available" })
    })

    it("platform falla → delivered false con error propagado", async () => {
        personalInstance = null
        mockSendPlatform.mockResolvedValue({ delivered: false, error: "platform_channel_disabled" })

        const result = await notifyMerchant({ organizationId: "org-1", message: "hola", kind: "sale" })

        expect(result.delivered).toBe(false)
        expect(result.error).toBe("platform_channel_disabled")
    })
})
