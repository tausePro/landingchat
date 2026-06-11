/**
 * Tests de sendCopilotInsight + formatInsightForWhatsApp (T4.5 / T2 del
 * platform-notifier: la entrega ahora pasa por la cadena notifyMerchant).
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mockInsightSingle = vi.fn()
const mockNotifyMerchant = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: vi.fn(async () => ({
        from: () => {
            const chain: Record<string, unknown> = {}
            chain.select = vi.fn(() => chain)
            chain.eq = vi.fn(() => chain)
            chain.single = mockInsightSingle
            return chain
        },
    })),
    createClient: vi.fn(),
}))

vi.mock("@/lib/whatsapp", () => ({
    sendWhatsAppMessage: vi.fn(),
}))

vi.mock("@/lib/notifications/notify-merchant", () => ({
    notifyMerchant: (...args: unknown[]) => mockNotifyMerchant(...args),
}))

import { sendCopilotInsight, formatInsightForWhatsApp } from "@/lib/notifications/whatsapp"

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
    mockInsightSingle.mockResolvedValue({ data: INSIGHT })
    mockNotifyMerchant.mockResolvedValue({ delivered: true, channel: "personal" })
})

describe("sendCopilotInsight", () => {
    it("formatea el insight y lo entrega vía notifyMerchant con kind copilot_insight", async () => {
        const result = await sendCopilotInsight({ organizationId: "org-1", insightId: "i-1" })

        expect(result).toBe(true)
        expect(mockNotifyMerchant).toHaveBeenCalledWith({
            organizationId: "org-1",
            message: expect.stringContaining("Atlas Copilot"),
            kind: "copilot_insight",
        })
    })

    it("insight inexistente → false sin intentar entrega", async () => {
        mockInsightSingle.mockResolvedValue({ data: null })

        expect(await sendCopilotInsight({ organizationId: "org-1", insightId: "i-404" })).toBe(false)
        expect(mockNotifyMerchant).not.toHaveBeenCalled()
    })

    it("la cadena no entrega (sin canal) → false sin lanzar", async () => {
        mockNotifyMerchant.mockResolvedValue({ delivered: false, channel: null, error: "no_channel_available" })

        expect(await sendCopilotInsight({ organizationId: "org-1", insightId: "i-1" })).toBe(false)
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
