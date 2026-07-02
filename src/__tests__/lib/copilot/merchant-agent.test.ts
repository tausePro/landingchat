/**
 * Tests de Atlas conversacional (merchant-agent): identidad por teléfono,
 * dedupe, rate limit diario, loop de tools y fallbacks.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const matchMock = vi.fn()
vi.mock("@/lib/copilot/whatsappReplyHandler", () => ({
    matchMerchantByPhone: (...args: unknown[]) => matchMock(...args),
}))

const llmMock = vi.fn()
vi.mock("@/lib/ai/anthropic", () => ({
    createMessage: (...args: unknown[]) => llmMock(...args),
}))

const emitMock = vi.fn()
vi.mock("@/lib/events/emit", () => ({
    emitPlatformEvent: (...args: unknown[]) => emitMock(...args),
}))

const sendMock = vi.fn()
vi.mock("@/lib/notifications/platform-whatsapp", () => ({
    sendPlatformText: (...args: unknown[]) => sendMock(...args),
}))

const metricsMock = vi.fn()
vi.mock("@/lib/copilot/weeklyMetrics", () => ({
    loadWeeklyMetrics: (...args: unknown[]) => metricsMock(...args),
}))

const composeMock = vi.fn()
vi.mock("@/lib/copilot/insightComposer", () => ({
    composeWeeklyInsight: (...args: unknown[]) => composeMock(...args),
}))

vi.mock("@/lib/copilot/atlas-skills", () => ({
    isAtlasSkillEnabled: () => true,
}))

interface QueryResult {
    data?: unknown
    count?: number | null
    error?: unknown
}

let tableResults: Record<string, QueryResult>

interface QueryBuilder {
    select: () => QueryBuilder
    eq: () => QueryBuilder
    gte: () => QueryBuilder
    order: () => QueryBuilder
    limit: () => QueryBuilder
    insert: () => QueryBuilder
    single: () => Promise<{ data: unknown; error: unknown }>
    then: (resolve: (value: unknown) => unknown) => Promise<unknown>
}

function makeBuilder(result: QueryResult): QueryBuilder {
    const builder: QueryBuilder = {
        select: () => builder,
        eq: () => builder,
        gte: () => builder,
        order: () => builder,
        limit: () => builder,
        insert: () => builder,
        single: () => Promise.resolve({ data: result.data ?? null, error: result.error ?? null }),
        then: (resolve) =>
            Promise.resolve({
                data: result.data ?? null,
                count: result.count ?? 0,
                error: result.error ?? null,
            }).then(resolve),
    }
    return builder
}

vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: () => ({
        from: (table: string) => makeBuilder(tableResults[table] ?? {}),
    }),
}))

import { processMerchantMessage } from "@/lib/copilot/merchant-agent"

const textResponse = (text: string) => ({
    stop_reason: "end_turn",
    content: [{ type: "text", text }],
})

const params = { senderPhone: "573007801382", text: "¿cómo van mis ventas?", messageId: "wamid.x" }

beforeEach(() => {
    vi.clearAllMocks()
    matchMock.mockResolvedValue([{ organizationId: "org-1", orgName: "Tez" }])
    emitMock.mockResolvedValue({ ok: true })
    sendMock.mockResolvedValue({ delivered: true })
    metricsMock.mockResolvedValue({ ordersCount: 5, revenue: 100000 })
    tableResults = {
        organizations: { data: { name: "Tez", locale: "es-CO", settings: {} } },
        platform_events: { count: 0 },
    }
})

describe("processMerchantMessage", () => {
    it("número desconocido → silencio total (sin LLM, sin envío)", async () => {
        matchMock.mockResolvedValue([])
        const result = await processMerchantMessage(params)
        expect(result).toEqual({ handled: false, replied: false })
        expect(llmMock).not.toHaveBeenCalled()
        expect(sendMock).not.toHaveBeenCalled()
    })

    it("webhook duplicado (mismo messageId) → no reprocesa", async () => {
        emitMock.mockResolvedValue({ ok: true, duplicate: true })
        const result = await processMerchantMessage(params)
        expect(result).toEqual({ handled: true, replied: false })
        expect(llmMock).not.toHaveBeenCalled()
    })

    it("límite diario superado → silencio (sin LLM)", async () => {
        tableResults.platform_events = { count: 31 }
        const result = await processMerchantMessage(params)
        expect(result).toEqual({ handled: true, replied: false })
        expect(llmMock).not.toHaveBeenCalled()
        expect(sendMock).not.toHaveBeenCalled()
    })

    it("límite diario exacto → mensaje de límite, sin LLM", async () => {
        tableResults.platform_events = { count: 30 }
        const result = await processMerchantMessage(params)
        expect(result).toEqual({ handled: true, replied: true })
        expect(llmMock).not.toHaveBeenCalled()
        expect(sendMock).toHaveBeenCalledWith(
            "573007801382",
            expect.stringContaining("límite")
        )
    })

    it("happy path: respuesta directa del modelo → se envía free-form", async () => {
        llmMock.mockResolvedValue(textResponse("Hola 👋 esta semana vendiste $100.000") as never)
        const result = await processMerchantMessage(params)
        expect(result).toEqual({ handled: true, replied: true })
        expect(sendMock).toHaveBeenCalledWith(
            "573007801382",
            "Hola 👋 esta semana vendiste $100.000"
        )
    })

    it("loop de tools: tool_use → ejecuta get_weekly_metrics → respuesta final", async () => {
        llmMock
            .mockResolvedValueOnce({
                stop_reason: "tool_use",
                content: [{ type: "tool_use", id: "tu1", name: "get_weekly_metrics", input: {} }],
            } as never)
            .mockResolvedValueOnce(textResponse("Vendiste $100.000 en 5 órdenes 🚀") as never)
        const result = await processMerchantMessage(params)
        expect(metricsMock).toHaveBeenCalledWith("org-1")
        expect(sendMock).toHaveBeenCalledWith("573007801382", "Vendiste $100.000 en 5 órdenes 🚀")
        expect(result).toEqual({ handled: true, replied: true })
    })

    it("LLM falla → responde el fallback (nunca silencio con merchant conocido)", async () => {
        llmMock.mockRejectedValue(new Error("api down"))
        const result = await processMerchantMessage(params)
        expect(result.handled).toBe(true)
        expect(sendMock).toHaveBeenCalledWith(
            "573007801382",
            expect.stringContaining("Tuve un problema")
        )
    })

    it("multi-org: opera sobre el primero y el prompt lo advierte", async () => {
        matchMock.mockResolvedValue([
            { organizationId: "org-1", orgName: "Tez" },
            { organizationId: "org-2", orgName: "Quality Pets" },
        ])
        llmMock.mockResolvedValue(textResponse("ok") as never)
        await processMerchantMessage(params)
        const callArgs = llmMock.mock.calls[0][0] as { system: string }
        expect(callArgs.system).toContain("2 negocios")
        expect(callArgs.system).toContain("Tez")
    })
})
