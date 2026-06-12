/**
 * Tests del loop de respuestas por WhatsApp (Copilot v1 — slice 1):
 * "Responde 1, 2, 3 o todas" ahora EJECUTA de verdad.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mockSendPlatform = vi.fn()
const mockExecute = vi.fn()
const mockEmit = vi.fn()

let orgsWithPhone: Array<Record<string, unknown>>
let personalInstances: Array<Record<string, unknown>>
let proposedInsights: Array<Record<string, unknown>>
const insightUpdates: Array<Record<string, unknown>> = []

vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: vi.fn(async () => ({
        from: (table: string) => {
            const chain: Record<string, unknown> = {}
            for (const method of ["select", "eq", "in", "not", "order", "limit"]) {
                chain[method] = vi.fn(() => chain)
            }
            chain.update = vi.fn((payload: Record<string, unknown>) => {
                insightUpdates.push(payload)
                return chain
            })
            chain.then = (resolve: (value: unknown) => void) => {
                if (table === "organizations") resolve({ data: orgsWithPhone })
                else if (table === "whatsapp_instances") resolve({ data: personalInstances })
                else if (table === "copilot_insights") resolve({ data: proposedInsights })
                else resolve({ data: [] })
            }
            return chain
        },
    })),
    createClient: vi.fn(),
}))

vi.mock("@/lib/notifications/platform-whatsapp", () => ({
    sendPlatformNotification: (...args: unknown[]) => mockSendPlatform(...args),
}))

vi.mock("@/lib/copilot/actionExecutor", () => ({
    executeProposedAction: (...args: unknown[]) => mockExecute(...args),
}))

vi.mock("@/lib/events/emit", () => ({
    emitPlatformEvent: (...args: unknown[]) => mockEmit(...args),
}))

import { handleCopilotWhatsAppReply, parseReplyIntent } from "@/lib/copilot/whatsappReplyHandler"

const INSIGHT = {
    id: "insight-1",
    organization_id: "org-1",
    title: "Semana floja",
    generated_at: "2026-06-15T14:00:00Z",
    proposed_actions: [
        { kind: "send_coupon_to_customers", human_label: "Cupón 10% a inactivos", requires_approval: true, params: {} },
        { kind: "notify_owner", human_label: "Avisar stock bajo", requires_approval: true, params: {} },
    ],
}

beforeEach(() => {
    vi.clearAllMocks()
    insightUpdates.length = 0
    orgsWithPhone = [{ id: "org-1", name: "Tez", notification_phone: "573001112233" }]
    personalInstances = []
    proposedInsights = [INSIGHT]
    mockSendPlatform.mockResolvedValue({ delivered: true })
    mockExecute.mockResolvedValue({ ok: true })
    mockEmit.mockResolvedValue({ ok: true })
})

describe("parseReplyIntent (parser estricto, sin LLM)", () => {
    it("números, todas y rechazos", () => {
        expect(parseReplyIntent("2")).toEqual({ kind: "action", index: 1 })
        expect(parseReplyIntent(" 1 ")).toEqual({ kind: "action", index: 0 })
        expect(parseReplyIntent("Todas")).toEqual({ kind: "all" })
        expect(parseReplyIntent("SÍ A TODAS")).toEqual({ kind: "all" })
        expect(parseReplyIntent("No")).toEqual({ kind: "dismiss" })
        expect(parseReplyIntent("rechazar")).toEqual({ kind: "dismiss" })
    })

    it("texto libre → unknown (nada de adivinar)", () => {
        expect(parseReplyIntent("dale con la primera")).toEqual({ kind: "unknown" })
        expect(parseReplyIntent("12")).toEqual({ kind: "unknown" })
        expect(parseReplyIntent("")).toEqual({ kind: "unknown" })
    })
})

describe("handleCopilotWhatsAppReply", () => {
    it("'1' ejecuta la primera acción, marca executed y confirma", async () => {
        const result = await handleCopilotWhatsAppReply({
            senderPhone: "573001112233",
            text: "1",
            messageId: "msg-1",
        })

        expect(result).toEqual({ handled: true, replied: true })
        expect(mockExecute).toHaveBeenCalledTimes(1)
        expect(mockExecute.mock.calls[0][0].action.human_label).toBe("Cupón 10% a inactivos")
        expect(mockExecute.mock.calls[0][0].organizationId).toBe("org-1")
        expect(insightUpdates[0]).toMatchObject({ status: "executed" })
        expect(mockSendPlatform).toHaveBeenCalledWith(
            "573001112233",
            expect.stringContaining("✅ Cupón 10% a inactivos")
        )
    })

    it("'todas' ejecuta las 2 acciones", async () => {
        await handleCopilotWhatsAppReply({ senderPhone: "573001112233", text: "todas", messageId: "msg-2" })

        expect(mockExecute).toHaveBeenCalledTimes(2)
        expect(insightUpdates[0]).toMatchObject({ status: "executed" })
    })

    it("'no' descarta sin ejecutar", async () => {
        await handleCopilotWhatsAppReply({ senderPhone: "573001112233", text: "no", messageId: "msg-3" })

        expect(mockExecute).not.toHaveBeenCalled()
        expect(insightUpdates[0]).toMatchObject({ status: "dismissed" })
    })

    it("número desconocido → ignorado EN SILENCIO (cero respuesta)", async () => {
        const result = await handleCopilotWhatsAppReply({
            senderPhone: "5799999999999",
            text: "1",
            messageId: "msg-4",
        })

        expect(result).toEqual({ handled: false, replied: false })
        expect(mockSendPlatform).not.toHaveBeenCalled()
        expect(mockExecute).not.toHaveBeenCalled()
    })

    it("merchant conocido sin insight pendiente + intent claro → aviso de nada pendiente", async () => {
        proposedInsights = []

        const result = await handleCopilotWhatsAppReply({ senderPhone: "573001112233", text: "1", messageId: "msg-5" })

        expect(result.replied).toBe(true)
        expect(mockSendPlatform).toHaveBeenCalledWith("573001112233", expect.stringContaining("No tengo acciones pendientes"))
    })

    it("texto libre con insight pendiente → ayuda con el rango válido", async () => {
        await handleCopilotWhatsAppReply({ senderPhone: "573001112233", text: "hola que tal", messageId: "msg-6" })

        expect(mockExecute).not.toHaveBeenCalled()
        expect(mockSendPlatform).toHaveBeenCalledWith("573001112233", expect.stringContaining("1-2"))
    })

    it("webhook duplicado (mismo messageId) → no re-ejecuta", async () => {
        mockEmit.mockResolvedValue({ ok: true, duplicate: true })

        const result = await handleCopilotWhatsAppReply({ senderPhone: "573001112233", text: "1", messageId: "msg-7" })

        expect(result).toEqual({ handled: true, replied: false })
        expect(mockExecute).not.toHaveBeenCalled()
    })

    it("número fuera de rango → mensaje correctivo sin ejecutar", async () => {
        await handleCopilotWhatsAppReply({ senderPhone: "573001112233", text: "5", messageId: "msg-8" })

        expect(mockExecute).not.toHaveBeenCalled()
        expect(mockSendPlatform).toHaveBeenCalledWith("573001112233", expect.stringContaining("no corresponde"))
    })

    it("match por instancia personal conectada (segunda vía de la cadena)", async () => {
        orgsWithPhone = []
        personalInstances = [{ organization_id: "org-1", phone_number: "573001112233" }]
        // la query .in de organizations para resolver nombres
        orgsWithPhone = [{ id: "org-1", name: "Tez" }]

        const result = await handleCopilotWhatsAppReply({ senderPhone: "57 300 111 2233", text: "todas", messageId: "msg-9" })

        expect(result.handled).toBe(true)
        expect(mockExecute).toHaveBeenCalled()
    })
})
