/**
 * Tests for the structured logger utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { logger } from "@/lib/logger"

describe("Logger", () => {
    beforeEach(() => {
        vi.spyOn(console, "log").mockImplementation(() => {})
        vi.spyOn(console, "error").mockImplementation(() => {})
        vi.spyOn(console, "warn").mockImplementation(() => {})
        vi.spyOn(console, "debug").mockImplementation(() => {})
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
    })

    it("should create a logger with the given source", () => {
        const log = logger("test/module")
        expect(log).toBeDefined()
        expect(log.info).toBeInstanceOf(Function)
        expect(log.error).toBeInstanceOf(Function)
        expect(log.warn).toBeInstanceOf(Function)
        expect(log.debug).toBeInstanceOf(Function)
    })

    it("should log info messages to console.log", () => {
        const log = logger("test/source")
        log.info("Hello world")

        expect(console.log).toHaveBeenCalledTimes(1)
        const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        expect(output).toContain("[INFO]")
        expect(output).toContain("[test/source]")
        expect(output).toContain("Hello world")
    })

    it("should log error messages to console.error", () => {
        const log = logger("payments/wompi")
        log.error("Payment failed", { transactionId: "abc123" })

        expect(console.error).toHaveBeenCalledTimes(1)
        const output = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        expect(output).toContain("[ERROR]")
        expect(output).toContain("[payments/wompi]")
        expect(output).toContain("Payment failed")
        expect(output).toContain("abc123")
    })

    it("should log warn messages to console.warn", () => {
        const log = logger("webhooks/whatsapp")
        log.warn("Rate limit near", { current: 95, max: 100 })

        expect(console.warn).toHaveBeenCalledTimes(1)
        const output = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        expect(output).toContain("[WARN]")
        expect(output).toContain("Rate limit near")
    })

    it("should include timestamp in ISO format", () => {
        const log = logger("test")
        log.info("test message")

        const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        // Should contain an ISO date pattern
        expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it("should serialize data object as JSON", () => {
        const log = logger("test")
        log.info("order", { amount: 50000, currency: "COP" })

        const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        expect(output).toContain('"amount":50000')
        expect(output).toContain('"currency":"COP"')
    })

    it("should not include data JSON when no data provided", () => {
        const log = logger("test")
        log.info("simple message")

        const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        // Should not contain data object (context braces may appear but not JSON data)
        expect(output).not.toContain('"amount"')
    })

    it("should support withContext and include context in output", () => {
        const log = logger("test/ctx").withContext({ orgId: "org-12345678-abcd", chatId: "chat-abcdef12-3456" })
        log.info("contextualized message")

        const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        expect(output).toContain("org:org-1234")
        expect(output).toContain("chat:chat-abc")
        expect(output).toContain("contextualized message")
    })

    it("should redact API keys in log output", () => {
        const log = logger("test/redact")
        log.info("key found", { token: "sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890" })

        const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        expect(output).toContain("REDACTED")
        expect(output).not.toContain("abcdefghijklmnopqrstuvwxyz1234567890")
    })

    it("should redact JWTs in log output", () => {
        const log = logger("test/redact")
        const fakeJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
        log.info("auth", { jwt: fakeJwt })

        const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        expect(output).toContain("REDACTED")
        expect(output).not.toContain("dozjgNryP4J3jVmNHl0w5N")
    })

    it("should output JSON in production mode", () => {
        vi.stubEnv("NODE_ENV", "production")
        const log = logger("test/prod")
        log.info("prod message", { key: "value" })

        const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        const parsed = JSON.parse(output)
        expect(parsed.level).toBe("info")
        expect(parsed.src).toBe("test/prod")
        expect(parsed.msg).toBe("prod message")
        expect(parsed.data.key).toBe("value")
    })

    it("should filter debug logs in production", () => {
        vi.stubEnv("NODE_ENV", "production")
        const log = logger("test/filter")
        log.debug("should not appear")

        expect(console.debug).not.toHaveBeenCalled()
        expect(console.log).not.toHaveBeenCalled()
    })

    it("should have withContext method that returns a Logger", () => {
        const log = logger("test")
        const ctxLog = log.withContext({ orgId: "abc", channel: "whatsapp" })
        expect(ctxLog.info).toBeInstanceOf(Function)
        expect(ctxLog.withContext).toBeInstanceOf(Function)
    })
})
