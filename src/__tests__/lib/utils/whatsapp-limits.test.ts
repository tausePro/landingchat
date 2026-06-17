import { describe, expect, it } from "vitest"
import { getMessagingConversationsThisMonth, consumeCreditIfOverPlanLimit } from "@/lib/utils/whatsapp-limits"

// =============================================================================
// Regresión bug cuota WhatsApp (2026-06): el límite usaba un contador acumulativo
// (organizations.whatsapp_conversations_used) que dependía de un cron mensual para
// resetear. Cuando el cron no reseteaba, tenants quedaban bloqueados (incidente
// recurrente Casa Inmobiliaria: 800/800). El fix cuenta filas de chat de canales
// de mensajería creadas en el MES CALENDARIO actual → resetea solo, sin cron.
// =============================================================================

type Captured = {
    table?: string
    filters: Record<string, unknown>
}

function mockSupabase(count: number | null, captured: Captured) {
    const builder = {
        select() {
            return builder
        },
        eq(column: string, value: unknown) {
            captured.filters[column] = value
            return builder
        },
        in(column: string, values: unknown[]) {
            captured.filters[column] = values
            return builder
        },
        gte(column: string, value: unknown) {
            captured.filters[column] = value
            return builder
        },
        then<T>(resolve: (value: { count: number | null; error: null }) => T) {
            return Promise.resolve({ count, error: null }).then(resolve)
        },
    }
    return {
        from(table: string) {
            captured.table = table
            return builder
        },
    }
}

type SupabaseArg = Parameters<typeof getMessagingConversationsThisMonth>[0]

describe("getMessagingConversationsThisMonth", () => {
    it("cuenta chats de canales de mensajería (whatsapp/instagram/messenger) del mes actual", async () => {
        const captured: Captured = { filters: {} }
        const used = await getMessagingConversationsThisMonth(
            mockSupabase(42, captured) as unknown as SupabaseArg,
            "org-1",
        )

        expect(used).toBe(42)
        expect(captured.table).toBe("chats")
        expect(captured.filters.organization_id).toBe("org-1")
        expect(captured.filters.channel).toEqual(["whatsapp", "instagram", "messenger"])
        // El corte es el primer día del mes a medianoche UTC → resetea solo cada mes
        expect(String(captured.filters.created_at)).toMatch(/-01T00:00:00/)
    })

    it("devuelve 0 cuando count es null (org sin conversaciones)", async () => {
        const used = await getMessagingConversationsThisMonth(
            mockSupabase(null, { filters: {} }) as unknown as SupabaseArg,
            "org-1",
        )
        expect(used).toBe(0)
    })
})

// =============================================================================
// Slice B créditos: al crear una conversación que supera el límite del plan, se
// consume 1 crédito comprado (overflow, roll-over). Dentro del plan o ilimitado
// no se consume.
// =============================================================================

function mockClientForConsume(opts: { planLimit: number | null; usedCount: number }) {
    const rpcCalls: Array<{ fn: string; args: unknown }> = []
    const client = {
        from(table: string) {
            if (table === "subscriptions") {
                const b: Record<string, unknown> = {}
                b.select = () => b
                b.eq = () => b
                b.maybeSingle = () =>
                    Promise.resolve({
                        data: opts.planLimit === null ? null : { plans: { max_whatsapp_conversations: opts.planLimit } },
                        error: null,
                    })
                return b
            }
            // chats → getMessagingConversationsThisMonth
            const b: Record<string, unknown> = {}
            b.select = () => b
            b.eq = () => b
            b.in = () => b
            b.gte = () => Promise.resolve({ count: opts.usedCount, error: null })
            return b
        },
        rpc(fn: string, args: unknown) {
            rpcCalls.push({ fn, args })
            return Promise.resolve({ data: null, error: null })
        },
    }
    return { client, rpcCalls }
}

describe("consumeCreditIfOverPlanLimit", () => {
    it("consume 1 crédito cuando la org supera el límite del plan", async () => {
        const { client, rpcCalls } = mockClientForConsume({ planLimit: 10, usedCount: 15 })
        await consumeCreditIfOverPlanLimit(client as unknown as SupabaseArg, "org-1")
        expect(rpcCalls).toEqual([{ fn: "consume_conversation_credit", args: { org_id: "org-1" } }])
    })

    it("NO consume si está dentro del límite del plan", async () => {
        const { client, rpcCalls } = mockClientForConsume({ planLimit: 100, usedCount: 50 })
        await consumeCreditIfOverPlanLimit(client as unknown as SupabaseArg, "org-1")
        expect(rpcCalls).toEqual([])
    })

    it("NO consume si el plan es ilimitado (-1)", async () => {
        const { client, rpcCalls } = mockClientForConsume({ planLimit: -1, usedCount: 9999 })
        await consumeCreditIfOverPlanLimit(client as unknown as SupabaseArg, "org-1")
        expect(rpcCalls).toEqual([])
    })
})
