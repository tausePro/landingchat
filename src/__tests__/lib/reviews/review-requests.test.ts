/**
 * Tests del slice de solicitud de reseñas post-compra:
 * - Token HMAC del link (determinístico, verificación timing-safe)
 * - Config por tenant (opt-in, clamping del delay)
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

describe("review token", () => {
    beforeEach(() => {
        vi.stubEnv("ENCRYPTION_KEY", "test-secret-key-for-reviews")
    })

    it("genera tokens determinísticos por orden y verifica el correcto", async () => {
        const { buildReviewToken, verifyReviewToken } = await import("@/lib/reviews/token")
        const orderId = "3f2c9a10-0000-4000-8000-000000000001"

        const token = buildReviewToken(orderId)
        expect(token).toBe(buildReviewToken(orderId))
        expect(token).toMatch(/^[a-f0-9]{64}$/)
        expect(verifyReviewToken(orderId, token)).toBe(true)
    })

    it("rechaza tokens inválidos, vacíos o de otra orden", async () => {
        const { buildReviewToken, verifyReviewToken } = await import("@/lib/reviews/token")
        const orderId = "3f2c9a10-0000-4000-8000-000000000001"
        const otherOrder = "3f2c9a10-0000-4000-8000-000000000002"

        expect(verifyReviewToken(orderId, buildReviewToken(otherOrder))).toBe(false)
        expect(verifyReviewToken(orderId, "abc")).toBe(false)
        expect(verifyReviewToken(orderId, null)).toBe(false)
        expect(verifyReviewToken(orderId, undefined)).toBe(false)
    })
})

describe("resolveReviewRequestConfig", () => {
    it("default: deshabilitado con delay 7 (opt-in explícito)", async () => {
        const { resolveReviewRequestConfig } = await import("@/lib/reviews/request-config")

        expect(resolveReviewRequestConfig(null)).toEqual({ enabled: false, delayDays: 7 })
        expect(resolveReviewRequestConfig({})).toEqual({ enabled: false, delayDays: 7 })
        expect(resolveReviewRequestConfig({ reviews: {} })).toEqual({ enabled: false, delayDays: 7 })
    })

    it("lee la config del tenant y clampa el delay a 1-60", async () => {
        const { resolveReviewRequestConfig } = await import("@/lib/reviews/request-config")

        expect(resolveReviewRequestConfig({ reviews: { request_enabled: true, request_delay_days: 14 } }))
            .toEqual({ enabled: true, delayDays: 14 })
        expect(resolveReviewRequestConfig({ reviews: { request_enabled: true, request_delay_days: 500 } }).delayDays).toBe(60)
        expect(resolveReviewRequestConfig({ reviews: { request_enabled: true, request_delay_days: 0 } }).delayDays).toBe(1)
        // Solo `true` literal habilita (datos sucios no activan envíos)
        expect(resolveReviewRequestConfig({ reviews: { request_enabled: "yes" } }).enabled).toBe(false)
    })
})
