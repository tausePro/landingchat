/**
 * Tests del worker semanal del copilot (T4.4).
 *
 * Todo mockeado (composer, métricas, WhatsApp, Supabase): el worker debe
 * ser idempotente por semana ISO y tolerante a fallos por org.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mockOrdersResult = vi.fn()
const mockChatsResult = vi.fn()
const mockOrgsResult = vi.fn()
const mockExistingMaybeSingle = vi.fn()
const mockInsertSingle = vi.fn()
const mockLoadWeeklyMetrics = vi.fn()
const mockCompose = vi.fn()
const mockEmit = vi.fn()
const mockSendInsight = vi.fn()

// T4 platform-notifier: elegibilidad por ACTIVIDAD semanal (orders/chats),
// sin exigir WhatsApp (la entrega va por la cadena notifyMerchant)
function thenableChain(resultFn: () => unknown) {
    const chain: Record<string, unknown> = {}
    for (const method of ["select", "eq", "in", "gte", "range"]) {
        chain[method] = vi.fn(() => chain)
    }
    chain.then = (resolve: (value: unknown) => void) => resolve(resultFn())
    return chain
}

function insightsChain() {
    const chain: Record<string, unknown> = {}
    for (const method of ["select", "eq", "insert"]) {
        chain[method] = vi.fn(() => chain)
    }
    chain.maybeSingle = mockExistingMaybeSingle
    chain.single = mockInsertSingle
    return chain
}

vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: vi.fn(() => ({
        from: (table: string) => {
            if (table === "orders") return thenableChain(mockOrdersResult)
            if (table === "chats") return thenableChain(mockChatsResult)
            if (table === "organizations") return thenableChain(mockOrgsResult)
            if (table === "copilot_insights") return insightsChain()
            throw new Error(`Tabla inesperada: ${table}`)
        },
    })),
    createClient: vi.fn(),
}))

vi.mock("@/lib/copilot/weeklyMetrics", () => ({
    loadWeeklyMetrics: (...args: unknown[]) => mockLoadWeeklyMetrics(...args),
}))

vi.mock("@/lib/copilot/insightComposer", () => ({
    composeWeeklyInsight: (...args: unknown[]) => mockCompose(...args),
}))

vi.mock("@/lib/events/emit", () => ({
    emitPlatformEvent: (...args: unknown[]) => mockEmit(...args),
}))

vi.mock("@/lib/notifications/whatsapp", () => ({
    sendCopilotInsight: (...args: unknown[]) => mockSendInsight(...args),
}))

import { GET } from "@/app/api/cron/copilot/weekly-insights/route"

const ORG = { id: "org-1", slug: "tez", locale: "es-CO", currency_code: "COP", country_code: "CO", copilot_autonomy_level: "level_1_propose" }

function buildRequest(auth?: string) {
    return new Request("http://localhost/api/cron/copilot/weekly-insights", {
        headers: auth ? { authorization: auth } : {},
    })
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("CRON_SECRET", "cron-secret")

    mockOrdersResult.mockReturnValue({ data: [{ organization_id: "org-1" }], error: null })
    mockChatsResult.mockReturnValue({ data: [], error: null })
    mockOrgsResult.mockReturnValue({ data: [ORG], error: null })
    mockExistingMaybeSingle.mockResolvedValue({ data: null })
    mockInsertSingle.mockResolvedValue({ data: { id: "insight-1" }, error: null })
    mockLoadWeeklyMetrics.mockResolvedValue({ orders: { count: 5 } })
    mockCompose.mockResolvedValue({
        title: "Semana ok",
        body: "Resumen",
        proposed_actions: [],
        metrics_snapshot: {},
    })
    mockEmit.mockResolvedValue({ ok: true })
    mockSendInsight.mockResolvedValue(true)
})

describe("GET /api/cron/copilot/weekly-insights", () => {
    it("401 sin header de auth", async () => {
        const response = await GET(buildRequest())
        expect(response.status).toBe(401)
    })

    it("401 con secret incorrecto", async () => {
        const response = await GET(buildRequest("Bearer wrong"))
        expect(response.status).toBe(401)
    })

    it("200 sin orgs elegibles", async () => {
        mockOrdersResult.mockReturnValue({ data: [], error: null })
        mockChatsResult.mockReturnValue({ data: [], error: null })

        const response = await GET(buildRequest("Bearer cron-secret"))
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.message).toBe("No eligible orgs")
        expect(mockCompose).not.toHaveBeenCalled()
    })

    it("genera insight para org elegible: compose → insert → evento → WhatsApp", async () => {
        const response = await GET(buildRequest("Bearer cron-secret"))
        const body = await response.json()

        expect(body.generated).toBe(1)
        expect(body.errors).toEqual([])
        expect(mockLoadWeeklyMetrics).toHaveBeenCalledWith("org-1")
        expect(mockCompose).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1", locale: "es-CO" }))
        expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({
            eventType: "copilot.insight_proposed",
            idempotencyKey: expect.stringContaining("org-1"),
        }))
        expect(mockSendInsight).toHaveBeenCalledWith({ organizationId: "org-1", insightId: "insight-1" })
    })

    it("idempotencia: insight existente de la semana → skip sin componer", async () => {
        mockExistingMaybeSingle.mockResolvedValue({ data: { id: "already" } })

        const response = await GET(buildRequest("Bearer cron-secret"))
        const body = await response.json()

        expect(body.generated).toBe(0)
        expect(body.skipped).toBe(1)
        expect(mockCompose).not.toHaveBeenCalled()
        expect(mockSendInsight).not.toHaveBeenCalled()
    })

    it("error en una org no bloquea las demás", async () => {
        mockOrdersResult.mockReturnValue({
            data: [{ organization_id: "org-1" }, { organization_id: "org-2" }],
            error: null,
        })
        mockOrgsResult.mockReturnValue({
            data: [ORG, { ...ORG, id: "org-2", slug: "qp" }],
            error: null,
        })
        mockLoadWeeklyMetrics
            .mockRejectedValueOnce(new Error("metrics exploded"))
            .mockResolvedValueOnce({ orders: { count: 3 } })

        const response = await GET(buildRequest("Bearer cron-secret"))
        const body = await response.json()

        expect(body.generated).toBe(1)
        expect(body.errors).toHaveLength(1)
        expect(body.errors[0]).toContain("org-1")
    })
})
