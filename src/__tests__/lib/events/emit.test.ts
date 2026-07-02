/**
 * Tests de `emitPlatformEvent` (T4.1 copilot-merchant-loop-v0).
 *
 * Garantías:
 * - Insert exitoso → { ok: true }
 * - Conflicto de idempotencia (23505) → { ok: true } sin propagar error
 * - Error genérico → { ok: false, error } sin lanzar (best-effort)
 * - Defaults: actor_id='system', payload={}, occurred_at=now, idempotency null
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mockInsert = vi.fn()
const mockFrom = vi.fn(() => ({ insert: mockInsert }))

vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: vi.fn(() => ({ from: mockFrom })),
    createClient: vi.fn(),
}))

import { emitPlatformEvent } from "@/lib/events/emit"
import { PLATFORM_EVENT_TYPES, ALL_PLATFORM_EVENT_TYPES } from "@/lib/events/platform-event-types"

const BASE_INPUT = {
    organizationId: "org-1",
    eventType: PLATFORM_EVENT_TYPES.ORDER_PAID,
    source: "webhook" as const,
}

beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ error: null })
})

describe("emitPlatformEvent", () => {
    it("insert exitoso retorna ok: true", async () => {
        const result = await emitPlatformEvent({
            ...BASE_INPUT,
            payload: { order_id: "o-1", total: 50000 },
            actorId: "customer-9",
            idempotencyKey: "webhook-abc",
        })

        expect(result).toEqual({ ok: true })
        expect(mockFrom).toHaveBeenCalledWith("platform_events")
        expect(mockInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                organization_id: "org-1",
                event_type: "order.paid",
                source: "webhook",
                payload: { order_id: "o-1", total: 50000 },
                actor_id: "customer-9",
                idempotency_key: "webhook-abc",
            })
        )
    })

    it("conflicto de idempotencia (23505) retorna ok: true sin propagar", async () => {
        mockInsert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } })

        const result = await emitPlatformEvent({ ...BASE_INPUT, idempotencyKey: "dup-key" })

        // Copilot v1: duplicate=true permite a los callers deduplicar webhooks
        expect(result).toEqual({ ok: true, duplicate: true })
    })

    it("error genérico retorna ok: false con mensaje, sin lanzar", async () => {
        mockInsert.mockResolvedValue({ error: { code: "XX000", message: "boom" } })

        const result = await emitPlatformEvent(BASE_INPUT)

        expect(result).toEqual({ ok: false, error: "boom" })
    })

    it("excepción inesperada retorna ok: false sin lanzar (best-effort)", async () => {
        mockInsert.mockRejectedValue(new Error("network down"))

        const result = await emitPlatformEvent(BASE_INPUT)

        expect(result).toEqual({ ok: false, error: "network down" })
    })

    it("aplica defaults: actor system, payload vacío, idempotency null, occurred_at now", async () => {
        const before = Date.now()
        await emitPlatformEvent(BASE_INPUT)
        const after = Date.now()

        const inserted = mockInsert.mock.calls[0][0]
        expect(inserted.actor_id).toBe("system")
        expect(inserted.payload).toEqual({})
        expect(inserted.idempotency_key).toBeNull()
        const occurredAt = new Date(inserted.occurred_at).getTime()
        expect(occurredAt).toBeGreaterThanOrEqual(before)
        expect(occurredAt).toBeLessThanOrEqual(after)
    })
})

describe("catálogo de event types", () => {
    it("cubre los 14 eventos (13 v0 + atlas_chat_reply) sin duplicados", () => {
        expect(ALL_PLATFORM_EVENT_TYPES).toHaveLength(14)
        expect(new Set(ALL_PLATFORM_EVENT_TYPES).size).toBe(14)
        expect(ALL_PLATFORM_EVENT_TYPES).toContain("copilot.atlas_chat_reply")
        // Áreas representadas
        expect(ALL_PLATFORM_EVENT_TYPES).toContain("order.paid")
        expect(ALL_PLATFORM_EVENT_TYPES).toContain("chat.started")
        expect(ALL_PLATFORM_EVENT_TYPES).toContain("copilot.action_executed")
    })
})
