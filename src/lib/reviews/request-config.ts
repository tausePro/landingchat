/**
 * Config de solicitud de reseñas post-compra por tenant.
 *
 * Vive en `organizations.settings.reviews` (JSONB) — opt-in explícito:
 * enviar mensajes automáticos a clientes es decisión del merchant.
 * Builder puro, testeable sin Next/Supabase.
 */

export interface ReviewRequestConfig {
    /** Opt-in explícito del merchant. Default false. */
    enabled: boolean
    /** Días después del pago para enviar la solicitud. Default 7, rango 1-60. */
    delayDays: number
}

export const DEFAULT_REVIEW_REQUEST_DELAY_DAYS = 7

/** Ventana máxima hacia atrás: nunca contactar órdenes pagadas hace más de 30 días. */
export const REVIEW_REQUEST_MAX_AGE_DAYS = 30

export function resolveReviewRequestConfig(settings: unknown): ReviewRequestConfig {
    const reviews =
        settings && typeof settings === "object"
            ? (settings as { reviews?: { request_enabled?: unknown; request_delay_days?: unknown } }).reviews
            : undefined

    const rawDelay = reviews?.request_delay_days
    const delayDays =
        typeof rawDelay === "number" && Number.isFinite(rawDelay)
            ? Math.min(60, Math.max(1, Math.round(rawDelay)))
            : DEFAULT_REVIEW_REQUEST_DELAY_DAYS

    return {
        enabled: reviews?.request_enabled === true,
        delayDays,
    }
}
