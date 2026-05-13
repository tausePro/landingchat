import type { SupabaseClient } from "@supabase/supabase-js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resolvePublicOrganization } from "../../lib/storefront/resolvePublicOrganization"

const mockCreateServiceClient = vi.fn()
const mockGetClientIdentifier = vi.fn(() => "test-ip")
const mockGetRateLimitHeaders = vi.fn(() => new Headers())
const mockChatInitRateLimit = { limit: vi.fn(async () => ({ success: true, reset: Date.now() + 60_000 })) }
const mockBookingsRateLimit = { limit: vi.fn(async () => ({ success: true, reset: Date.now() + 60_000 })) }

vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: mockCreateServiceClient,
}))

vi.mock("@/lib/rate-limit", () => ({
    chatInitRateLimit: mockChatInitRateLimit,
    bookingsRateLimit: mockBookingsRateLimit,
    getClientIdentifier: mockGetClientIdentifier,
    getRateLimitHeaders: mockGetRateLimitHeaders,
    limitOrAllowOnProviderError: async (
        rateLimiter: { limit: (id: string) => Promise<unknown> },
        identifier: string,
    ) => rateLimiter.limit(identifier),
}))

vi.mock("@/lib/calendar/google-calendar", () => ({
    createCalendarEvent: vi.fn(async () => null),
    getFreeBusySlots: vi.fn(async () => []),
    isCalendarConnected: vi.fn(async () => false),
}))

vi.mock("@/lib/advisors/assignment", () => ({
    assignAdvisor: vi.fn(async () => null),
    getAdvisors: vi.fn(async () => []),
}))

vi.mock("@/lib/notifications/whatsapp", () => ({
    sendAppointmentNotification: vi.fn(async () => undefined),
}))

type QueryResult = { data: unknown; error: unknown }

function createSelectBuilder(resolver: (filters: Record<string, string>) => Promise<QueryResult> | QueryResult) {
    const filters: Record<string, string> = {}

    const builder = {
        eq(column: string, value: string) {
            filters[column] = value
            return builder
        },
        async single() {
            return resolver(filters)
        },
    }

    return builder
}

function createMockSupabase(options: {
    organizationBySlug?: { id: string; name: string; slug?: string } | null
    organizationById?: { id: string; name: string } | null
    customerByFilters?: { id: string; full_name: string; total_orders: number } | null
}) {
    return {
        from(table: string) {
            if (table === "organizations") {
                return {
                    select: () => createSelectBuilder((filters) => {
                        if (filters.slug) {
                            return { data: options.organizationBySlug ?? null, error: null }
                        }

                        if (filters.id) {
                            return { data: options.organizationById ?? null, error: null }
                        }

                        return { data: null, error: null }
                    }),
                }
            }

            if (table === "customers") {
                return {
                    select: () => createSelectBuilder(() => ({
                        data: options.customerByFilters ?? null,
                        error: null,
                    })),
                }
            }

            return {
                select: () => createSelectBuilder(() => ({ data: null, error: null })),
                insert: () => ({
                    select: () => ({
                        single: async () => ({ data: { id: "generated-id" }, error: null }),
                    }),
                }),
            }
        },
    }
}

describe("public tenant isolation", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetModules()
    })

    it("resuelve organización por slug y rechaza mismatch con organizationId legado", async () => {
        const supabase = createMockSupabase({
            organizationBySlug: { id: "org-store", name: "Store", slug: "store" },
        }) as unknown as SupabaseClient

        const organization = await resolvePublicOrganization(supabase, {
            slug: "store",
            organizationId: "org-other",
        })

        expect(organization).toBeNull()
    })

    it("permite fallback por organizationId cuando no hay slug", async () => {
        const supabase = createMockSupabase({
            organizationById: { id: "org-store", name: "Store" },
        }) as unknown as SupabaseClient

        const organization = await resolvePublicOrganization(supabase, {
            organizationId: "org-store",
        })

        expect(organization).toEqual({ id: "org-store", name: "Store" })
    })

    it("chat init rechaza customerId de otro tenant", async () => {
        mockCreateServiceClient.mockReturnValue(
            createMockSupabase({
                organizationBySlug: { id: "org-store", name: "Store", slug: "store" },
                customerByFilters: null,
            })
        )

        const { POST } = await import("../../app/api/store/[slug]/chat/init/route")
        const request = new Request("http://localhost:3000/api/store/store/chat/init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerId: "123e4567-e89b-42d3-a456-426614174000" }),
        })

        const response = await POST(request as never, {
            params: Promise.resolve({ slug: "store" }),
        })

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({ error: "Cliente no encontrado" })
    })

    it("bookings create rechaza payload legado si slug y organizationId no coinciden", async () => {
        mockCreateServiceClient.mockReturnValue(
            createMockSupabase({
                organizationBySlug: { id: "org-store", name: "Store", slug: "store" },
            })
        )

        const { POST } = await import("../../app/api/bookings/create/route")
        const request = new Request("http://localhost:3000/api/bookings/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                slug: "store",
                organizationId: "org-other",
                proposedDate: "2099-01-01T10:00:00.000Z",
                customerName: "Cliente Demo",
                customerPhone: "+573001112233",
            }),
        })

        const response = await POST(request as never)

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({ error: "Organización no encontrada" })
    })

    it("bookings availability rechaza payload legado si slug y organizationId no coinciden", async () => {
        mockCreateServiceClient.mockReturnValue(
            createMockSupabase({
                organizationBySlug: { id: "org-store", name: "Store", slug: "store" },
            })
        )

        const { POST } = await import("../../app/api/bookings/availability/route")
        const request = new Request("http://localhost:3000/api/bookings/availability", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                slug: "store",
                organizationId: "org-other",
                date: "2099-01-01T00:00:00.000Z",
            }),
        })

        const response = await POST(request as never)

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({ error: "Organización no encontrada" })
    })
})
