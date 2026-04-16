import { beforeEach, describe, expect, it, vi } from "vitest"

const CUSTOMER_ID = "123e4567-e89b-42d3-a456-426614174000"

const mockCreateServiceClient = vi.fn()
const mockProcessMessage = vi.fn(async () => ({
    response: "Respuesta de prueba",
    actions: [],
    metadata: { source: "test" },
}))
const mockResolvePublicOrganization = vi.fn(async () => ({
    id: "org-store",
    name: "Store",
    slug: "store",
    customDomain: null,
}))
const mockGetValidatedStorefrontCustomerSession = vi.fn(async () => ({
    customerId: CUSTOMER_ID,
    organizationId: "org-store",
    slug: "store",
}))
const mockCanCreateResource = vi.fn(async () => ({ allowed: true }))
const mockGetClientIdentifier = vi.fn(() => "test-ip")
const mockGetRateLimitHeaders = vi.fn(() => new Headers())
const mockAiChatRateLimit = {
    limit: vi.fn(async () => ({
        success: true,
        limit: 10,
        remaining: 9,
        reset: Date.now() + 60_000,
    })),
}

vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: mockCreateServiceClient,
}))

vi.mock("@/lib/ai/chat-agent", () => ({
    processMessage: mockProcessMessage,
}))

vi.mock("@/lib/storefront/resolvePublicOrganization", () => ({
    resolvePublicOrganization: mockResolvePublicOrganization,
}))

vi.mock("@/lib/storefrontAccess", () => ({
    getValidatedStorefrontCustomerSession: mockGetValidatedStorefrontCustomerSession,
}))

vi.mock("@/lib/utils/subscription", () => ({
    canCreateResource: mockCanCreateResource,
}))

vi.mock("@/lib/rate-limit", () => ({
    aiChatRateLimit: mockAiChatRateLimit,
    getClientIdentifier: mockGetClientIdentifier,
    getRateLimitHeaders: mockGetRateLimitHeaders,
}))

vi.mock("@/lib/logger", () => ({
    logger: vi.fn(() => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    })),
}))

function createMockSupabase() {
    const insertChatSpy = vi.fn()
    const insertMessageSpy = vi.fn(async () => ({ data: null, error: null }))

    return {
        insertChatSpy,
        insertMessageSpy,
        client: {
            from(table: string) {
                if (table === "chats") {
                    return {
                        select(selection: string) {
                            if (selection === "id, assigned_agent_id") {
                                return {
                                    eq() {
                                        return this
                                    },
                                    is() {
                                        return this
                                    },
                                    order() {
                                        return this
                                    },
                                    limit() {
                                        return this
                                    },
                                    maybeSingle: async () => ({
                                        data: {
                                            id: "chat-active-1",
                                            assigned_agent_id: "agent-1",
                                        },
                                        error: null,
                                    }),
                                }
                            }

                            if (selection === "assigned_agent_id, customer_id, organization_id") {
                                return {
                                    eq() {
                                        return this
                                    },
                                    single: async () => ({
                                        data: {
                                            assigned_agent_id: "agent-1",
                                            customer_id: CUSTOMER_ID,
                                            organization_id: "org-store",
                                        },
                                        error: null,
                                    }),
                                }
                            }

                            return {
                                eq() {
                                    return this
                                },
                                single: async () => ({ data: null, error: null }),
                            }
                        },
                        insert: insertChatSpy,
                    }
                }

                if (table === "messages") {
                    return {
                        insert: insertMessageSpy,
                    }
                }

                if (table === "carts") {
                    return {
                        select() {
                            return {
                                eq() {
                                    return this
                                },
                                single: async () => ({ data: null, error: { message: "not found" } }),
                            }
                        },
                        insert: vi.fn(async () => ({ data: null, error: null })),
                        update: vi.fn(() => ({
                            eq() {
                                return this
                            },
                        })),
                    }
                }

                if (table === "agents") {
                    return {
                        select() {
                            return {
                                eq() {
                                    return this
                                },
                                single: async () => ({
                                    data: { id: "agent-new" },
                                    error: null,
                                }),
                            }
                        },
                    }
                }

                return {
                    select() {
                        return {
                            eq() {
                                return this
                            },
                            single: async () => ({ data: null, error: null }),
                        }
                    },
                    insert: vi.fn(async () => ({ data: null, error: null })),
                    update: vi.fn(() => ({
                        eq() {
                            return this
                        },
                    })),
                }
            },
        },
    }
}

describe("api/ai-chat", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetModules()
    })

    it("reuses existing active chat before creating a new one", async () => {
        const supabase = createMockSupabase()
        mockCreateServiceClient.mockReturnValue(supabase.client)

        const { POST } = await import("../../app/api/ai-chat/route")
        const request = new Request("http://localhost:3000/api/ai-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Hola",
                slug: "store",
                customerId: CUSTOMER_ID,
            }),
        })

        const response = await POST(request as never)
        const payload = await response.json()

        expect(response.status).toBe(200)
        expect(payload).toMatchObject({
            chatId: "chat-active-1",
            message: "Respuesta de prueba",
        })
        expect(mockCanCreateResource).not.toHaveBeenCalled()
        expect(supabase.insertChatSpy).not.toHaveBeenCalled()
        expect(mockProcessMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                chatId: "chat-active-1",
                agentId: "agent-1",
                organizationId: "org-store",
                customerId: CUSTOMER_ID,
            })
        )
    })
})
