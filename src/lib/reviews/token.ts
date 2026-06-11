/**
 * Token de solicitud de reseña post-compra.
 *
 * HMAC-SHA256 determinístico derivado del id de la orden con ENCRYPTION_KEY:
 * el link enviado al cliente (`/resena/[orderId]?t=TOKEN`) solo es válido si
 * el token coincide — nadie puede reseñar órdenes ajenas adivinando UUIDs.
 * Sin estado en DB (no expira; la orden solo admite una reseña por producto).
 */

import crypto from "crypto"

function getSecret(): string {
    const secret = process.env.ENCRYPTION_KEY
    if (!secret) {
        throw new Error("ENCRYPTION_KEY is required to build review tokens")
    }
    return secret
}

export function buildReviewToken(orderId: string): string {
    return crypto
        .createHmac("sha256", getSecret())
        .update(`review-request:${orderId}`)
        .digest("hex")
}

export function verifyReviewToken(orderId: string, token: string | null | undefined): boolean {
    if (!token || typeof token !== "string") return false

    const expected = buildReviewToken(orderId)
    if (token.length !== expected.length) return false

    return crypto.timingSafeEqual(Buffer.from(token, "utf8"), Buffer.from(expected, "utf8"))
}
