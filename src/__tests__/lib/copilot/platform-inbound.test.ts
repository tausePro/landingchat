/**
 * Tests del ruteo inbound del número de la PLATAFORMA (fix del loop Hermes
 * tras el switch a Meta: las respuestas "1/2/3" de merchants llegaban al
 * webhook whatsapp-meta y caían en "Instance not found").
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MetaWebhookValue } from "@/lib/whatsapp"

const configMock = vi.fn()
vi.mock("@/lib/notifications/platform-whatsapp", () => ({
    getPlatformNotificationsConfig: (...args: unknown[]) => configMock(...args),
}))

const replyMock = vi.fn()
vi.mock("@/lib/copilot/whatsappReplyHandler", () => ({
    handleCopilotWhatsAppReply: (...args: unknown[]) => replyMock(...args),
    // Parser real-ish (estricto) para el gate de ruteo
    parseReplyIntent: (text: string) => {
        const normalized = text.trim().toLowerCase()
        if (/^[1-5]$/.test(normalized)) return { kind: "action", index: Number(normalized) - 1 }
        if (normalized === "todas") return { kind: "all" }
        if (normalized === "no") return { kind: "dismiss" }
        return { kind: "unknown" }
    },
}))

const agentMock = vi.fn()
vi.mock("@/lib/copilot/merchant-agent", () => ({
    processMerchantMessage: (...args: unknown[]) => agentMock(...args),
}))

import { handlePlatformNumberInbound } from "@/lib/copilot/platform-inbound"

function buildValue(partial: Partial<MetaWebhookValue> = {}): MetaWebhookValue {
    return {
        messaging_product: "whatsapp",
        metadata: { display_phone_number: "573239118408", phone_number_id: "PN-PLATFORM" },
        ...partial,
    } as MetaWebhookValue
}

const textMessage = (from: string, body: string, id = "wamid.1") => ({
    from,
    id,
    timestamp: "1700000000",
    type: "text" as const,
    text: { body },
})

beforeEach(() => {
    vi.clearAllMocks()
    configMock.mockResolvedValue({
        enabled: true,
        provider: "meta",
        meta_phone_number_id: "PN-PLATFORM",
    })
    replyMock.mockResolvedValue({ handled: true, replied: true })
    agentMock.mockResolvedValue({ handled: true, replied: true })
})

describe("handlePlatformNumberInbound", () => {
    it("número platform + intent claro ('1') → rutea al loop de aprobación", async () => {
        const handled = await handlePlatformNumberInbound(
            "PN-PLATFORM",
            buildValue({ messages: [textMessage("573007801382", "1", "wamid.abc")] as MetaWebhookValue["messages"] })
        )
        expect(handled).toBe(true)
        expect(replyMock).toHaveBeenCalledWith({
            senderPhone: "573007801382",
            text: "1",
            messageId: "wamid.abc",
        })
        expect(agentMock).not.toHaveBeenCalled()
    })

    it("número platform + texto libre → rutea a Atlas conversacional", async () => {
        const handled = await handlePlatformNumberInbound(
            "PN-PLATFORM",
            buildValue({
                messages: [textMessage("573007801382", "¿cómo van mis ventas?", "wamid.free")] as MetaWebhookValue["messages"],
            })
        )
        expect(handled).toBe(true)
        expect(agentMock).toHaveBeenCalledWith({
            senderPhone: "573007801382",
            text: "¿cómo van mis ventas?",
            messageId: "wamid.free",
        })
        expect(replyMock).not.toHaveBeenCalled()
    })

    it("phone_number_id de un tenant (no platform) → false y no toca el handler", async () => {
        const handled = await handlePlatformNumberInbound(
            "PN-TENANT",
            buildValue({ messages: [textMessage("573007801382", "1")] as MetaWebhookValue["messages"] })
        )
        expect(handled).toBe(false)
        expect(replyMock).not.toHaveBeenCalled()
    })

    it("provider evolution → false (el número platform meta no está activo)", async () => {
        configMock.mockResolvedValue({ enabled: true, provider: "evolution", meta_phone_number_id: "PN-PLATFORM" })
        const handled = await handlePlatformNumberInbound("PN-PLATFORM", buildValue())
        expect(handled).toBe(false)
    })

    it("solo statuses (receipts) → true en silencio, sin llamar al handler", async () => {
        const handled = await handlePlatformNumberInbound(
            "PN-PLATFORM",
            buildValue({ statuses: [] as MetaWebhookValue["statuses"] })
        )
        expect(handled).toBe(true)
        expect(replyMock).not.toHaveBeenCalled()
    })

    it("mensajes no-texto se ignoran; el handler que lanza no rompe (best-effort)", async () => {
        replyMock.mockRejectedValueOnce(new Error("boom"))
        const value = buildValue({
            messages: [
                { from: "573007801382", id: "wamid.img", timestamp: "1", type: "image" },
                textMessage("573007801382", "todas", "wamid.2"),
            ] as MetaWebhookValue["messages"],
        })
        const handled = await handlePlatformNumberInbound("PN-PLATFORM", value)
        expect(handled).toBe(true)
        expect(replyMock).toHaveBeenCalledTimes(1)
    })
})
