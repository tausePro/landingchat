/**
 * Tests de F0.1 — purchase server-side (fuente de verdad del conteo).
 * Antes: purchase solo cliente → subconteo 7x. Ahora: seam de pago confirmado
 * con dedupe por order_id + PostHog best-effort.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { emitServerPurchaseEvent, type ServerPurchaseInput } from "@/lib/analytics/server-purchase"

let countResult: number
let insertError: { message: string } | null
let insertedRow: Record<string, unknown> | null
let fromThrows: boolean

interface Builder {
    select: () => Builder
    eq: () => Builder
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
    then: (resolve: (value: unknown) => unknown) => Promise<unknown>
}

function makeSupabase() {
    const builder: Builder = {
        select: () => builder,
        eq: () => builder,
        insert: (row) => {
            insertedRow = row
            return Promise.resolve({ error: insertError })
        },
        then: (resolve) => Promise.resolve({ count: countResult, error: null }).then(resolve),
    }
    return {
        from: () => {
            if (fromThrows) throw new Error("db down")
            return builder
        },
    } as never
}

const fetchMock = vi.fn()

const baseInput: ServerPurchaseInput = {
    organizationId: "org-1",
    orderId: "order-123",
    total: 150000,
    currency: "COP",
    contentIds: ["prod-1", "prod-2"],
    paymentMethod: "contraentrega",
    sourceChannel: "chat",
    customerKey: "laura@example.com",
}

beforeEach(() => {
    vi.clearAllMocks()
    countResult = 0
    insertError = null
    insertedRow = null
    fromThrows = false
    vi.stubGlobal("fetch", fetchMock)
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key")
    fetchMock.mockResolvedValue({ ok: true })
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
})

describe("emitServerPurchaseEvent", () => {
    it("emite first-party con order_id, valor y canal correcto", async () => {
        const result = await emitServerPurchaseEvent(makeSupabase(), baseInput)
        expect(result.emitted).toBe(true)
        expect(insertedRow).toMatchObject({
            organization_id: "org-1",
            event_name: "purchase",
            order_id: "order-123",
            value: 150000,
            currency: "COP",
            source_channel: "chat",
            content_ids: ["prod-1", "prod-2"],
        })
        expect((insertedRow?.properties as Record<string, unknown>).emittedBy).toBe("server")
    })

    it("dedupe: purchase existente para la orden → no re-emite ni llama PostHog", async () => {
        countResult = 1
        const result = await emitServerPurchaseEvent(makeSupabase(), baseInput)
        expect(result).toEqual({ emitted: false, reason: "duplicate" })
        expect(insertedRow).toBeNull()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("PostHog recibe $insert_id y distinct_id del cliente", async () => {
        await emitServerPurchaseEvent(makeSupabase(), baseInput)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
        expect(body.event).toBe("purchase")
        expect(body.distinct_id).toBe("laura@example.com")
        expect(body.properties.$insert_id).toBe("purchase_order-123")
        expect(body.properties.value).toBe(150000)
    })

    it("sin POSTHOG_KEY → no llama a PostHog pero sí emite first-party", async () => {
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "")
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_TOKEN", "")
        const result = await emitServerPurchaseEvent(makeSupabase(), baseInput)
        expect(result.emitted).toBe(true)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("error del insert → emitted false con razón, sin PostHog", async () => {
        insertError = { message: "permission denied" }
        const result = await emitServerPurchaseEvent(makeSupabase(), baseInput)
        expect(result).toEqual({ emitted: false, reason: "permission denied" })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("PostHog caído → best-effort, el evento first-party queda emitido", async () => {
        fetchMock.mockRejectedValue(new Error("network"))
        const result = await emitServerPurchaseEvent(makeSupabase(), baseInput)
        expect(result.emitted).toBe(true)
    })

    it("nunca lanza aunque la DB explote", async () => {
        fromThrows = true
        const result = await emitServerPurchaseEvent(makeSupabase(), baseInput)
        expect(result).toEqual({ emitted: false, reason: "unexpected" })
    })

    it("sin customerKey → distinct_id basado en la orden", async () => {
        await emitServerPurchaseEvent(makeSupabase(), { ...baseInput, customerKey: null })
        const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
        expect(body.distinct_id).toBe("order_order-123")
    })
})
