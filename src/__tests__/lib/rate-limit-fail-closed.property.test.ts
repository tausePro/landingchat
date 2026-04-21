/**
 * @file Rate limit fail-closed property tests
 * @description Verifica el comportamiento del rate limit cuando Redis NO está
 *              configurado (mockRateLimit activo):
 *                - production: success:false (fail-closed, devuelve 429)
 *                - development: success:true (fail-open, permite trabajo local)
 *              Relacionado con Fase 0.3 del plan (Bug D). Ver
 *              `docs-private/PUNCHLIST_HARDENING_PLATAFORMA_2026-04.md` §0.3.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

// Borrar las vars de Upstash antes de importar el módulo, para que
// `isRedisConfigured` quede `false` y el módulo use `mockRateLimit`.
beforeAll(() => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
})

// Mocks defensivos: si por error se intentara construir un Ratelimit real
// sin Redis configurado, estos mocks lo detectan.
vi.mock("@upstash/redis", () => ({
    Redis: function MockRedis() { return {} }
}))

vi.mock("@upstash/ratelimit", () => {
    const MockRatelimit = Object.assign(
        function () {
            throw new Error(
                "Ratelimit real no debería instanciarse cuando Redis no está configurado: " +
                "el módulo debe usar mockRateLimit"
            )
        },
        { slidingWindow: vi.fn() }
    )
    return { Ratelimit: MockRatelimit }
})

// Silenciar los logs del module load (no son objeto de este test).
vi.spyOn(console, "error").mockImplementation(() => { })
vi.spyOn(console, "warn").mockImplementation(() => { })

describe("Rate limit fail-closed behavior (Redis no configurado)", () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    describe("NODE_ENV=production → fail-closed", () => {
        it("los 4 rate limiters devuelven success:false en producción sin Redis", async () => {
            vi.stubEnv("NODE_ENV", "production")
            const { aiChatRateLimit, storeApiRateLimit, chatInitRateLimit, bookingsRateLimit } =
                await import("@/lib/rate-limit")

            const results = await Promise.all([
                aiChatRateLimit.limit("ip-test-ai"),
                storeApiRateLimit.limit("ip-test-store"),
                chatInitRateLimit.limit("ip-test-chat-init"),
                bookingsRateLimit.limit("ip-test-bookings"),
            ])

            for (const result of results) {
                expect(result.success).toBe(false)
                expect(result.remaining).toBe(0)
                expect(typeof result.reset).toBe("number")
                expect(result.reset).toBeGreaterThan(0)
            }
        })

        it("repeated calls desde diferentes IPs siguen fail-closed (no hay ventana por IP en el mock)", async () => {
            vi.stubEnv("NODE_ENV", "production")
            const { aiChatRateLimit } = await import("@/lib/rate-limit")

            const results = await Promise.all(
                Array.from({ length: 10 }, (_, i) => aiChatRateLimit.limit(`ip-prod-${i}`))
            )

            for (const result of results) {
                expect(result.success).toBe(false)
            }
        })
    })

    describe("NODE_ENV=development → fail-open", () => {
        it("los 4 rate limiters devuelven success:true en development sin Redis", async () => {
            vi.stubEnv("NODE_ENV", "development")
            const { aiChatRateLimit, storeApiRateLimit, chatInitRateLimit, bookingsRateLimit } =
                await import("@/lib/rate-limit")

            const results = await Promise.all([
                aiChatRateLimit.limit("ip-dev-ai"),
                storeApiRateLimit.limit("ip-dev-store"),
                chatInitRateLimit.limit("ip-dev-chat-init"),
                bookingsRateLimit.limit("ip-dev-bookings"),
            ])

            for (const result of results) {
                expect(result.success).toBe(true)
                expect(result.remaining).toBeGreaterThan(0)
            }
        })
    })

    describe("NODE_ENV=test → fail-open (tests no deben romper por rate limit)", () => {
        it("en NODE_ENV=test el rate limiter devuelve success:true", async () => {
            vi.stubEnv("NODE_ENV", "test")
            const { aiChatRateLimit } = await import("@/lib/rate-limit")
            const result = await aiChatRateLimit.limit("ip-test")
            expect(result.success).toBe(true)
        })
    })

    describe("Reactividad a NODE_ENV sin reimportar el módulo", () => {
        it("cambia de success:false a success:true al cambiar NODE_ENV en runtime", async () => {
            const { aiChatRateLimit } = await import("@/lib/rate-limit")

            vi.stubEnv("NODE_ENV", "production")
            const prodResult = await aiChatRateLimit.limit("ip-reactivo")
            expect(prodResult.success).toBe(false)
            expect(prodResult.remaining).toBe(0)

            vi.stubEnv("NODE_ENV", "development")
            const devResult = await aiChatRateLimit.limit("ip-reactivo")
            expect(devResult.success).toBe(true)
            expect(devResult.remaining).toBeGreaterThan(0)
        })
    })
})
