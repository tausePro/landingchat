import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { createClientMock, rpcMock } = vi.hoisted(() => ({
    createClientMock: vi.fn(),
    rpcMock: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
    createClient: createClientMock,
}))

import { GET } from "@/app/api/store/[slug]/search-suggestions/route"

function createSupabaseClient(params: {
    organization: { id: string } | null
    orgError?: { message: string } | null
    rpcResponse?: { data: unknown; error: unknown }
}) {
    rpcMock.mockReset()
    rpcMock.mockResolvedValue(params.rpcResponse ?? { data: [], error: null })

    return {
        from(table: string) {
            const builder = {
                select() {
                    return builder
                },
                eq() {
                    return builder
                },
                async single() {
                    if (table !== "organizations") {
                        throw new Error(`Unexpected single query on ${table}`)
                    }
                    return {
                        data: params.organization,
                        error: params.orgError ?? null,
                    }
                },
            }
            return builder
        },
        rpc: rpcMock,
    }
}

function buildRequest(slug: string, query: string): NextRequest {
    return new NextRequest(
        `http://localhost:3000/api/store/${slug}/search-suggestions?${query}`,
    )
}

describe("GET /api/store/[slug]/search-suggestions", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("returns 400 when query is missing or shorter than 2 chars", async () => {
        createClientMock.mockResolvedValue(
            createSupabaseClient({ organization: { id: "org-1" } }),
        )

        const response = await GET(buildRequest("tez", "q=a"), {
            params: Promise.resolve({ slug: "tez" }),
        })

        expect(response.status).toBe(400)
        const body = await response.json()
        expect(body.error).toContain("at least 2 characters")
        expect(rpcMock).not.toHaveBeenCalled()
    })

    it("returns 404 when store does not exist", async () => {
        createClientMock.mockResolvedValue(
            createSupabaseClient({
                organization: null,
                orgError: { message: "not found" },
            }),
        )

        const response = await GET(buildRequest("ghost", "q=serum"), {
            params: Promise.resolve({ slug: "ghost" }),
        })

        expect(response.status).toBe(404)
        expect(rpcMock).not.toHaveBeenCalled()
    })

    it("invokes RPC with sanitized params and maps the response", async () => {
        createClientMock.mockResolvedValue(
            createSupabaseClient({
                organization: { id: "org-1" },
                rpcResponse: {
                    data: [
                        { product_id: "p-1", name: "Serum Hidratante", similarity: 0.7 },
                        { product_id: "p-2", name: "Serum Antiedad", similarity: 0.55 },
                    ],
                    error: null,
                },
            }),
        )

        const response = await GET(
            buildRequest("tez", "q=serim&limit=3&threshold=0.2"),
            { params: Promise.resolve({ slug: "tez" }) },
        )

        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body.suggestions).toHaveLength(2)
        expect(body.suggestions[0]).toEqual({
            id: "p-1",
            name: "Serum Hidratante",
            similarity: 0.7,
        })

        expect(rpcMock).toHaveBeenCalledWith("search_product_suggestions", {
            p_organization_id: "org-1",
            p_query: "serim",
            p_limit: 3,
            p_min_similarity: 0.2,
        })
    })

    it("clamps limit to 20 when too high and threshold to 0.5 when too high", async () => {
        createClientMock.mockResolvedValue(
            createSupabaseClient({
                organization: { id: "org-1" },
                rpcResponse: { data: [], error: null },
            }),
        )

        await GET(buildRequest("tez", "q=serum&limit=999&threshold=0.99"), {
            params: Promise.resolve({ slug: "tez" }),
        })

        expect(rpcMock).toHaveBeenCalledWith("search_product_suggestions", {
            p_organization_id: "org-1",
            p_query: "serum",
            p_limit: 20,
            p_min_similarity: 0.5,
        })
    })

    it("falls back to defaults when limit/threshold are invalid", async () => {
        createClientMock.mockResolvedValue(
            createSupabaseClient({
                organization: { id: "org-1" },
                rpcResponse: { data: [], error: null },
            }),
        )

        await GET(buildRequest("tez", "q=serum&limit=abc&threshold=xyz"), {
            params: Promise.resolve({ slug: "tez" }),
        })

        expect(rpcMock).toHaveBeenCalledWith("search_product_suggestions", {
            p_organization_id: "org-1",
            p_query: "serum",
            p_limit: 5,
            p_min_similarity: 0.15,
        })
    })

    it("returns 500 with empty suggestions when RPC fails", async () => {
        createClientMock.mockResolvedValue(
            createSupabaseClient({
                organization: { id: "org-1" },
                rpcResponse: {
                    data: null,
                    error: { message: "RPC kaboom" },
                },
            }),
        )

        const response = await GET(buildRequest("tez", "q=serum"), {
            params: Promise.resolve({ slug: "tez" }),
        })

        expect(response.status).toBe(500)
        const body = await response.json()
        expect(body.error).toBe("Failed to load suggestions")
    })

    it("filters out malformed rows (missing id or name)", async () => {
        createClientMock.mockResolvedValue(
            createSupabaseClient({
                organization: { id: "org-1" },
                rpcResponse: {
                    data: [
                        { product_id: "p-1", name: "Serum", similarity: 0.7 },
                        { product_id: null, name: "Bad row", similarity: 0.5 },
                        { product_id: "p-2", name: "", similarity: 0.4 },
                        { product_id: "p-3", name: "Crema", similarity: 0.3 },
                    ],
                    error: null,
                },
            }),
        )

        const response = await GET(buildRequest("tez", "q=serum"), {
            params: Promise.resolve({ slug: "tez" }),
        })

        const body = await response.json()
        expect(body.suggestions).toEqual([
            { id: "p-1", name: "Serum", similarity: 0.7 },
            { id: "p-3", name: "Crema", similarity: 0.3 },
        ])
    })
})
