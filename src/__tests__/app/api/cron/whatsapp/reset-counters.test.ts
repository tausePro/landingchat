import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock del cliente Supabase service-role. El test inyecta el cliente
// per-suite vía mockCreateServiceClient.mockReturnValue() para mantener
// el contrato síncrono real de `createServiceClient` (sync, no async).
const mockCreateServiceClient = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: mockCreateServiceClient,
}))

// Silenciar console.log/error durante tests sin perder visibilidad
// de fallos reales en CI.
beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
})

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
})

/**
 * Construye un mock de Supabase con respuestas configurables para
 * (a) el snapshot pre-reset (select sobre organizations con filtro)
 * (b) el RPC reset_all_whatsapp_counters
 * (c) el count post-reset
 */
function buildSupabaseMock(opts: {
    snapshot?: Array<{
        id: string
        slug: string
        whatsapp_conversations_used: number
    }>
    snapshotError?: { message: string } | null
    rpcError?: { message: string } | null
    countAfter?: number | null
} = {}) {
    const rpcSpy = vi.fn(async () => ({
        error: opts.rpcError ?? null,
    }))

    const snapshotResult = {
        data: opts.snapshot ?? [],
        error: opts.snapshotError ?? null,
    }

    const countResult = {
        count: opts.countAfter ?? 0,
        error: null,
    }

    return {
        rpcSpy,
        client: {
            from(table: string) {
                if (table === "organizations") {
                    return {
                        select(_sel: string, opts2?: { count?: string; head?: boolean }) {
                            // Caso 1: snapshot pre-reset
                            // .select("id, slug, ...").gt(...).order(...).limit(...)
                            if (!opts2?.head) {
                                return {
                                    gt() {
                                        return this
                                    },
                                    order() {
                                        return this
                                    },
                                    async limit() {
                                        return snapshotResult
                                    },
                                }
                            }
                            // Caso 2: count post-reset
                            // .select("id", { count: "exact", head: true }).gt(...)
                            return {
                                async gt() {
                                    return countResult
                                },
                            }
                        },
                    }
                }
                throw new Error(`Unexpected table query: ${table}`)
            },
            rpc: rpcSpy,
        },
    }
}

async function importHandler() {
    // Import dinámico para que cada test obtenga una instancia fresca
    // tras `vi.resetModules()` si se requiere.
    return await import("@/app/api/cron/whatsapp/reset-counters/route")
}

describe("Cron WhatsApp Reset Counters", () => {
    describe("Authorization", () => {
        it("returns 401 cuando CRON_SECRET está set y no llega Authorization", async () => {
            vi.stubEnv("CRON_SECRET", "super-secret")
            const { GET } = await importHandler()

            const response = await GET(new Request("http://localhost/cron"))

            expect(response.status).toBe(401)
            const body = await response.json()
            expect(body.error).toBe("Unauthorized")
        })

        it("returns 401 con Bearer incorrecto", async () => {
            vi.stubEnv("CRON_SECRET", "super-secret")
            const { GET } = await importHandler()

            const response = await GET(
                new Request("http://localhost/cron", {
                    headers: { authorization: "Bearer wrong-token" },
                })
            )

            expect(response.status).toBe(401)
        })

        it("permite request si CRON_SECRET no está set (consistencia con crons existentes)", async () => {
            vi.stubEnv("CRON_SECRET", "")
            const mock = buildSupabaseMock({ countAfter: 0 })
            mockCreateServiceClient.mockReturnValue(mock.client)

            const { GET } = await importHandler()
            const response = await GET(new Request("http://localhost/cron"))

            expect(response.status).toBe(200)
            expect(mock.rpcSpy).toHaveBeenCalledWith("reset_all_whatsapp_counters")
        })
    })

    describe("Reset flow", () => {
        beforeEach(() => {
            vi.stubEnv("CRON_SECRET", "super-secret")
        })

        it("llama RPC reset_all_whatsapp_counters con auth válida", async () => {
            const mock = buildSupabaseMock({
                snapshot: [
                    {
                        id: "org-1",
                        slug: "casainmobiliaria",
                        whatsapp_conversations_used: 1000,
                    },
                    {
                        id: "org-2",
                        slug: "qp",
                        whatsapp_conversations_used: 350,
                    },
                ],
                countAfter: 0,
            })
            mockCreateServiceClient.mockReturnValue(mock.client)

            const { GET } = await importHandler()
            const response = await GET(
                new Request("http://localhost/cron", {
                    headers: { authorization: "Bearer super-secret" },
                })
            )

            expect(response.status).toBe(200)
            expect(mock.rpcSpy).toHaveBeenCalledTimes(1)
            expect(mock.rpcSpy).toHaveBeenCalledWith("reset_all_whatsapp_counters")

            const body = await response.json()
            expect(body.message).toBe("WhatsApp counters reset successfully")
            expect(body.orgsWithUsageBefore).toBe(2)
            expect(body.totalUsageBefore).toBe(1350)
            expect(body.orgsStillWithCounterAfter).toBe(0)
            expect(body.topUsageSnapshot).toEqual([
                { slug: "casainmobiliaria", usedBefore: 1000 },
                { slug: "qp", usedBefore: 350 },
            ])
            expect(body.startedAt).toBeTruthy()
            expect(body.finishedAt).toBeTruthy()
        })

        it("retorna 500 si el RPC falla", async () => {
            const mock = buildSupabaseMock({
                rpcError: { message: "RPC connection refused" },
            })
            mockCreateServiceClient.mockReturnValue(mock.client)

            const { GET } = await importHandler()
            const response = await GET(
                new Request("http://localhost/cron", {
                    headers: { authorization: "Bearer super-secret" },
                })
            )

            expect(response.status).toBe(500)
            const body = await response.json()
            expect(body.error).toBe("RPC connection refused")
            expect(body.startedAt).toBeTruthy()
            expect(body.finishedAt).toBeTruthy()
        })

        it("no bloquea el reset si el snapshot pre falla (snapshot es metadata)", async () => {
            const mock = buildSupabaseMock({
                snapshotError: { message: "Permission denied on snapshot" },
                countAfter: 0,
            })
            mockCreateServiceClient.mockReturnValue(mock.client)

            const { GET } = await importHandler()
            const response = await GET(
                new Request("http://localhost/cron", {
                    headers: { authorization: "Bearer super-secret" },
                })
            )

            // Reset debe ejecutarse incluso si snapshot falló
            expect(response.status).toBe(200)
            expect(mock.rpcSpy).toHaveBeenCalledWith("reset_all_whatsapp_counters")
            const body = await response.json()
            expect(body.orgsWithUsageBefore).toBe(0)
            expect(body.topUsageSnapshot).toEqual([])
        })

        it("captura excepciones inesperadas con status 500", async () => {
            mockCreateServiceClient.mockImplementation(() => {
                throw new Error("Boom: supabase init failed")
            })

            const { GET } = await importHandler()
            const response = await GET(
                new Request("http://localhost/cron", {
                    headers: { authorization: "Bearer super-secret" },
                })
            )

            expect(response.status).toBe(500)
            const body = await response.json()
            expect(body.error).toBe("Boom: supabase init failed")
            expect(body.startedAt).toBeTruthy()
            expect(body.finishedAt).toBeTruthy()
        })
    })

    describe("POST alias", () => {
        it("POST delega a GET (trigger manual)", async () => {
            vi.stubEnv("CRON_SECRET", "super-secret")
            const mock = buildSupabaseMock({ countAfter: 0 })
            mockCreateServiceClient.mockReturnValue(mock.client)

            const { POST } = await importHandler()
            const response = await POST(
                new Request("http://localhost/cron", {
                    method: "POST",
                    headers: { authorization: "Bearer super-secret" },
                })
            )

            expect(response.status).toBe(200)
            expect(mock.rpcSpy).toHaveBeenCalledWith("reset_all_whatsapp_counters")
        })
    })
})
