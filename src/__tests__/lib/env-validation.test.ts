/**
 * Tests for environment variable validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock logger to avoid side effects
vi.mock("@/lib/logger", () => ({
    logger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}))

describe("Env Validation", () => {
    const originalEnv = { ...process.env }

    beforeEach(() => {
        // Reset module cache so validateEnv() runs fresh
        vi.resetModules()
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        process.env = { ...originalEnv }
    })

    it("should pass when all required vars are present", async () => {
        vi.stubEnv("NODE_ENV", "test")
        process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
        process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key"
        process.env.ANTHROPIC_API_KEY = "sk-test-key"

        const { validateEnv } = await import("@/lib/env-validation")
        const result = validateEnv()
        expect(result.valid).toBe(true)
        expect(result.missing.length).toBe(0)
    })

    it("should report missing required vars in dev without throwing", async () => {
        vi.stubEnv("NODE_ENV", "test")
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
        delete process.env.ANTHROPIC_API_KEY

        const { validateEnv } = await import("@/lib/env-validation")
        const result = validateEnv()
        expect(result.missing.length).toBeGreaterThan(0)
    })

    it("should report production-only vars as warnings in dev", async () => {
        vi.stubEnv("NODE_ENV", "test")
        process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
        process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key"
        process.env.ANTHROPIC_API_KEY = "sk-test-key"
        delete process.env.ENCRYPTION_SALT
        delete process.env.CRON_SECRET

        const { validateEnv } = await import("@/lib/env-validation")
        const result = validateEnv()
        expect(result.warnings.length).toBeGreaterThan(0)
    })
})
