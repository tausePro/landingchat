import crypto from "crypto"
import { cookies } from "next/headers"

const CUSTOMER_SESSION_COOKIE_PREFIX = "lc_storefront_customer_"
const CUSTOMER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
const ORDER_ACCESS_TTL_SECONDS = 60 * 60 * 24 * 14

interface StorefrontTokenBase {
    v: 1
    slug: string
    organizationId: string
    exp: number
}

export interface StorefrontCustomerSessionPayload extends StorefrontTokenBase {
    kind: "customer-session"
    customerId: string
}

export interface StorefrontOrderAccessPayload extends StorefrontTokenBase {
    kind: "order-access"
    orderId: string
    customerId: string | null
}

function getStorefrontSecret() {
    const secret = process.env.NEXTAUTH_SECRET || process.env.ENCRYPTION_KEY

    if (!secret) {
        throw new Error("Falta NEXTAUTH_SECRET o ENCRYPTION_KEY para firmar el acceso público del storefront")
    }

    return secret
}

function nowInSeconds() {
    return Math.floor(Date.now() / 1000)
}

function sanitizeSlug(slug: string) {
    return slug.replace(/[^a-zA-Z0-9_-]/g, "_")
}

function encodePayload(value: string) {
    return Buffer.from(value).toString("base64url")
}

function decodePayload(value: string) {
    return Buffer.from(value, "base64url").toString("utf8")
}

function signPayload(value: string) {
    return crypto.createHmac("sha256", getStorefrontSecret()).update(value).digest("base64url")
}

function createSignedToken<T extends { exp: number }>(payload: T) {
    const encodedPayload = encodePayload(JSON.stringify(payload))
    const signature = signPayload(encodedPayload)

    return `${encodedPayload}.${signature}`
}

function verifySignedToken<T extends { exp: number }>(token: string) {
    const [encodedPayload, signature] = token.split(".")

    if (!encodedPayload || !signature) {
        return null
    }

    const expectedSignature = signPayload(encodedPayload)

    try {
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            return null
        }
    } catch {
        return null
    }

    try {
        const payload = JSON.parse(decodePayload(encodedPayload)) as T

        if (!payload.exp || payload.exp < nowInSeconds()) {
            return null
        }

        return payload
    } catch {
        return null
    }
}

export function getStorefrontCustomerSessionCookieName(slug: string) {
    return `${CUSTOMER_SESSION_COOKIE_PREFIX}${sanitizeSlug(slug)}`
}

export function getStorefrontCustomerSessionCookieOptions(maxAge = CUSTOMER_SESSION_TTL_SECONDS) {
    return {
        httpOnly: true,
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge,
    }
}

export function createStorefrontCustomerSessionToken(input: {
    slug: string
    organizationId: string
    customerId: string
}) {
    return createSignedToken<StorefrontCustomerSessionPayload>({
        kind: "customer-session",
        v: 1,
        slug: input.slug,
        organizationId: input.organizationId,
        customerId: input.customerId,
        exp: nowInSeconds() + CUSTOMER_SESSION_TTL_SECONDS,
    })
}

export function verifyStorefrontCustomerSessionToken(
    token: string,
    expected: {
        slug?: string
        organizationId?: string
        customerId?: string
    } = {}
) {
    const payload = verifySignedToken<StorefrontCustomerSessionPayload>(token)

    if (!payload || payload.kind !== "customer-session" || payload.v !== 1) {
        return null
    }

    if (expected.slug && payload.slug !== expected.slug) {
        return null
    }

    if (expected.organizationId && payload.organizationId !== expected.organizationId) {
        return null
    }

    if (expected.customerId && payload.customerId !== expected.customerId) {
        return null
    }

    return payload
}

export function createStorefrontOrderAccessToken(input: {
    slug: string
    organizationId: string
    orderId: string
    customerId: string | null
}) {
    return createSignedToken<StorefrontOrderAccessPayload>({
        kind: "order-access",
        v: 1,
        slug: input.slug,
        organizationId: input.organizationId,
        orderId: input.orderId,
        customerId: input.customerId,
        exp: nowInSeconds() + ORDER_ACCESS_TTL_SECONDS,
    })
}

export function verifyStorefrontOrderAccessToken(
    token: string,
    expected: {
        slug?: string
        organizationId?: string
        orderId?: string
        customerId?: string | null
    } = {}
) {
    const payload = verifySignedToken<StorefrontOrderAccessPayload>(token)

    if (!payload || payload.kind !== "order-access" || payload.v !== 1) {
        return null
    }

    if (expected.slug && payload.slug !== expected.slug) {
        return null
    }

    if (expected.organizationId && payload.organizationId !== expected.organizationId) {
        return null
    }

    if (expected.orderId && payload.orderId !== expected.orderId) {
        return null
    }

    if (expected.customerId !== undefined && payload.customerId !== expected.customerId) {
        return null
    }

    return payload
}

export async function getStorefrontCustomerSession(slug: string) {
    const cookieStore = await cookies()
    const token = cookieStore.get(getStorefrontCustomerSessionCookieName(slug))?.value

    if (!token) {
        return null
    }

    return verifyStorefrontCustomerSessionToken(token, { slug })
}

export async function getValidatedStorefrontCustomerSession(input: {
    slug: string
    organizationId: string
    customerId?: string | null
}) {
    const session = await getStorefrontCustomerSession(input.slug)

    if (!session || session.organizationId !== input.organizationId) {
        return null
    }

    if (input.customerId && session.customerId !== input.customerId) {
        return null
    }

    return session
}

export async function setStorefrontCustomerSession(input: {
    slug: string
    organizationId: string
    customerId: string
}) {
    const cookieStore = await cookies()

    cookieStore.set(
        getStorefrontCustomerSessionCookieName(input.slug),
        createStorefrontCustomerSessionToken(input),
        getStorefrontCustomerSessionCookieOptions()
    )
}

export function appendStorefrontAccessParam(urlString: string, accessToken: string) {
    const isAbsoluteUrl = /^https?:\/\//i.test(urlString)
    const url = new URL(urlString, "http://localhost")

    url.searchParams.set("access", accessToken)

    if (isAbsoluteUrl) {
        return url.toString()
    }

    return `${url.pathname}${url.search}${url.hash}`
}
