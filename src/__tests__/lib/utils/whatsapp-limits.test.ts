import { describe, expect, it } from "vitest"
import { getMessagingConversationsThisMonth } from "@/lib/utils/whatsapp-limits"

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
