/**
 * Horario de atención para booking, configurable por tenant.
 *
 * Vive en `organizations.settings.booking` (JSONB, mismo patrón que
 * settings.reviews). Builder puro y null-safe: cualquier valor ausente o
 * inválido cae al default histórico (9-18, domingos cerrados) para no
 * cambiar el comportamiento de tenants existentes.
 */

export interface BookingHoursConfig {
    /** Hora de apertura (0-23). */
    dayStartHour: number
    /** Hora de cierre (1-24, exclusiva — el último slot termina aquí). */
    dayEndHour: number
    /** Si true, no se ofrecen domingos. */
    skipSundays: boolean
}

export const DEFAULT_BOOKING_HOURS: BookingHoursConfig = Object.freeze({
    dayStartHour: 9,
    dayEndHour: 18,
    skipSundays: true,
})

function readHour(value: unknown, fallback: number, min: number, max: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback
    const rounded = Math.round(value)
    return rounded >= min && rounded <= max ? rounded : fallback
}

export function resolveBookingHours(settings: unknown): BookingHoursConfig {
    const booking =
        settings && typeof settings === "object"
            ? (settings as { booking?: { day_start_hour?: unknown; day_end_hour?: unknown; skip_sundays?: unknown } }).booking
            : undefined

    const dayStartHour = readHour(booking?.day_start_hour, DEFAULT_BOOKING_HOURS.dayStartHour, 0, 23)
    const dayEndHour = readHour(booking?.day_end_hour, DEFAULT_BOOKING_HOURS.dayEndHour, 1, 24)

    // Rango inválido (cierre antes de apertura) → default completo
    if (dayEndHour <= dayStartHour) {
        return { ...DEFAULT_BOOKING_HOURS }
    }

    return {
        dayStartHour,
        dayEndHour,
        skipSundays: booking?.skip_sundays !== false,
    }
}
