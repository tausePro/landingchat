/**
 * Tests del loader de métricas semanales (T4.3).
 *
 * Mock de Supabase con builder thenable: cada query del loader debe filtrar
 * SIEMPRE por organization_id (criterio de seguridad del spec).
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

interface QueryRecord {
    table: string
    eqCalls: Array<[string, unknown]>
}

const queryLog: QueryRecord[] = []
let dataByTable: Record<string, unknown[]>

function buildChain(table: string) {
    const record: QueryRecord = { table, eqCalls: [] }
    queryLog.push(record)

    const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn((column: string, value: unknown) => {
            record.eqCalls.push([column, value])
            return chain
        }),
        gte: vi.fn(() => chain),
        lt: vi.fn(() => chain),
        in: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        // fetchAllPages pagina con .range (fix del cap de PostgREST)
        range: vi.fn(() => chain),
        then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
            resolve({ data: dataByTable[table] ?? [], error: null }),
    }
    return chain
}

vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: vi.fn(() => ({ from: (table: string) => buildChain(table) })),
    createClient: vi.fn(),
}))

import { loadWeeklyMetrics } from "@/lib/copilot/weeklyMetrics"

const NOW = new Date("2026-06-10T12:00:00Z")

beforeEach(() => {
    vi.clearAllMocks()
    queryLog.length = 0
    dataByTable = { orders: [], chats: [], analytics_events: [], products: [] }
})

describe("loadWeeklyMetrics", () => {
    it("org sin datos → shape vacío válido con ventanas calculadas", async () => {
        const metrics = await loadWeeklyMetrics("org-1", NOW)

        expect(metrics.weekEnd).toEqual(NOW)
        expect(metrics.weekStart).toEqual(new Date("2026-06-03T12:00:00Z"))
        expect(metrics.previousWeekStart).toEqual(new Date("2026-05-27T12:00:00Z"))
        expect(metrics.orders).toEqual({ count: 0, revenue: 0, ticketAvg: 0 })
        expect(metrics.ordersPrev).toEqual({ count: 0, revenue: 0 })
        expect(metrics.conversations).toEqual({ count: 0, whatsappPct: 0 })
        expect(metrics.cartsAbandoned).toEqual([])
        expect(metrics.inactiveCustomers).toEqual([])
        expect(metrics.topProductsViewed).toEqual([])
        expect(metrics.topProductsConverted).toEqual([])
    })

    it("toda query a tablas multi-tenant filtra por organization_id", async () => {
        await loadWeeklyMetrics("org-secure", NOW)

        expect(queryLog.length).toBeGreaterThanOrEqual(6)
        for (const record of queryLog) {
            expect(
                record.eqCalls.some(([column, value]) => column === "organization_id" && value === "org-secure"),
                `query a "${record.table}" sin filtro de organization_id`
            ).toBe(true)
        }
    })

    it("agrega métricas: revenue solo de pagadas, whatsappPct, top convertidos", async () => {
        dataByTable.orders = [
            {
                id: "o1", total: 100000, payment_status: "paid", customer_id: "c1",
                customer_info: { name: "Laura" }, created_at: "2026-06-09T00:00:00Z",
                items: [{ product_id: "p1", product_name: "Serum", quantity: 2, total_price: 100000 }],
            },
            {
                id: "o2", total: 50000, payment_status: "pending", customer_id: "c2",
                customer_info: { name: "Pedro" }, created_at: "2026-06-08T00:00:00Z",
                items: [{ product_id: "p2", product_name: "Toalla", quantity: 1, total_price: 50000 }],
            },
        ]
        dataByTable.chats = [
            { id: "ch1", channel: "whatsapp" },
            { id: "ch2", channel: "web" },
        ]

        const metrics = await loadWeeklyMetrics("org-1", NOW)

        // count incluye todas; revenue solo pagadas
        expect(metrics.orders.count).toBe(2)
        expect(metrics.orders.revenue).toBe(100000)
        expect(metrics.orders.ticketAvg).toBe(100000)
        expect(metrics.conversations.whatsappPct).toBe(50)
        // Solo la orden pagada aporta producto convertido
        expect(metrics.topProductsConverted).toEqual([
            { productId: "p1", name: "Serum", orders: 1, revenue: 100000 },
        ])
    })

    it("carritos abandonados: sesiones con add_to_cart sin conversión", async () => {
        dataByTable.analytics_events = [
            { session_id: "s1", event_name: "add_to_cart", content_ids: [], value: 80000, occurred_at: "2026-06-09T10:00:00Z" },
            { session_id: "s2", event_name: "add_to_cart", content_ids: [], value: 30000, occurred_at: "2026-06-08T10:00:00Z" },
            { session_id: "s2", event_name: "checkout_order_created", content_ids: [], value: 30000, occurred_at: "2026-06-08T11:00:00Z" },
        ]

        const metrics = await loadWeeklyMetrics("org-1", NOW)

        expect(metrics.cartsAbandoned).toHaveLength(1)
        expect(metrics.cartsAbandoned[0]).toMatchObject({ id: "s1", total: 80000 })
    })

    it("clientes inactivos: última orden hace más de 21 días", async () => {
        // historyOrders comparte la tabla orders en el mock: el loader usa la
        // misma data para semana actual e histórico; ambas órdenes son viejas,
        // así que no cuentan en la semana pero sí en el histórico
        dataByTable.orders = [
            { id: "o1", total: 10000, payment_status: "paid", customer_id: "c-old", customer_info: { name: "Inactiva" }, created_at: "2026-05-01T00:00:00Z", items: [] },
            { id: "o2", total: 10000, payment_status: "paid", customer_id: "c-recent", customer_info: { name: "Reciente" }, created_at: "2026-06-08T00:00:00Z", items: [] },
        ]

        const metrics = await loadWeeklyMetrics("org-1", NOW)

        const inactiveIds = metrics.inactiveCustomers.map((customer) => customer.id)
        expect(inactiveIds).toContain("c-old")
        expect(inactiveIds).not.toContain("c-recent")
    })
})
