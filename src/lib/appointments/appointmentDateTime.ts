export const APPOINTMENTS_TIME_ZONE = "America/Bogota"

type DateInput = Date | string

interface AppointmentDateParts {
    year: number
    month: number
    day: number
    hour: number
    minute: number
    second: number
}

function parseAppointmentDateKey(dateKey: string): { year: number; month: number; day: number } {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)

    if (!match) {
        throw new Error(`Invalid appointment date key: ${dateKey}`)
    }

    return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
    }
}

function normalizeDateInput(value: DateInput): Date {
    return value instanceof Date ? value : new Date(value)
}

function getAppointmentDateParts(value: DateInput): AppointmentDateParts {
    const date = normalizeDateInput(value)
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: APPOINTMENTS_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    })

    const parts = formatter.formatToParts(date)
    const values = new Map<string, string>()

    for (const part of parts) {
        if (part.type !== "literal") {
            values.set(part.type, part.value)
        }
    }

    return {
        year: Number(values.get("year")),
        month: Number(values.get("month")),
        day: Number(values.get("day")),
        hour: Number(values.get("hour")),
        minute: Number(values.get("minute")),
        second: Number(values.get("second")),
    }
}

function getReferenceDateForDateKey(dateKey: string): Date {
    const { year, month, day } = parseAppointmentDateKey(dateKey)
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0))
}

function formatDateKeyFromReference(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
}

function getAppointmentTimeZoneOffsetMs(date: Date): number {
    const parts = getAppointmentDateParts(date)
    const asUtc = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
        0,
    )

    return asUtc - date.getTime()
}

export function formatAppointmentDateTime(
    value: DateInput,
    options: Intl.DateTimeFormatOptions,
    locale: string = "es-CO",
): string {
    const date = normalizeDateInput(value)

    return new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: APPOINTMENTS_TIME_ZONE,
    }).format(date)
}

export function getAppointmentDateKey(value: DateInput): string {
    const parts = getAppointmentDateParts(value)

    return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`
}

export function addDaysToAppointmentDateKey(dateKey: string, days: number): string {
    const referenceDate = getReferenceDateForDateKey(dateKey)
    referenceDate.setUTCDate(referenceDate.getUTCDate() + days)

    return formatDateKeyFromReference(referenceDate)
}

export function getAppointmentWeekday(dateKey: string): number {
    return getReferenceDateForDateKey(dateKey).getUTCDay()
}

export function getAppointmentMinutesOfDay(value: DateInput): number {
    const parts = getAppointmentDateParts(value)
    return parts.hour * 60 + parts.minute
}

export function createAppointmentDate(dateKey: string, hour: number, minute: number): Date {
    const { year, month, day } = parseAppointmentDateKey(dateKey)
    const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0))
    const firstOffset = getAppointmentTimeZoneOffsetMs(utcGuess)
    const candidate = new Date(utcGuess.getTime() - firstOffset)
    const secondOffset = getAppointmentTimeZoneOffsetMs(candidate)

    if (secondOffset === firstOffset) {
        return candidate
    }

    return new Date(utcGuess.getTime() - secondOffset)
}
