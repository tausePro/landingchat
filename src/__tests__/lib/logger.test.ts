/**
 * Tests for the structured logger utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { logger } from "@/lib/logger"

describe("Logger", () => {
    const originalEnv = process.env.NODE_ENV

    beforeEach(() => {
        vi.spyOn(console, "log").mockImplementation(() => {})
        vi.spyOn(console, "error").mockImplementation(() => {})
        vi.spyOn(console, "warn").mockImplementation(() => {})
        vi.spyOn(console, "debug").mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
        process.env.NODE_ENV = originalEnv
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
        expect(output).not.toContain("{")
    })
})
