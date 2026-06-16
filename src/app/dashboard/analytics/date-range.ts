// Rango de fechas del dashboard de analytics (compartido entre el server page
// y el picker cliente). Estado vivo en la URL (?range=30d o ?from=&to=).

export type RangeKey = "1d" | "7d" | "30d" | "90d" | "custom"

export interface RangePreset {
    key: RangeKey
    label: string
    days?: number
}

// Presets que ofrece el picker. "custom" no tiene days (usa from/to).
export const RANGE_PRESETS: RangePreset[] = [
    { key: "1d", label: "Hoy", days: 1 },
    { key: "7d", label: "7 días", days: 7 },
    { key: "30d", label: "30 días", days: 30 },
    { key: "90d", label: "90 días", days: 90 },
    { key: "custom", label: "Personalizado" },
]

export const DEFAULT_RANGE_KEY: RangeKey = "30d"

export interface ResolvedRange {
    startDate: Date
    endDate: Date
    // Período inmediatamente anterior de igual duración (para comparar Δ).
    prevStartDate: Date
    prevEndDate: Date
    rangeKey: RangeKey
    label: string
    days: number
}

export interface RawRangeParams {
    range?: string
    from?: string
    to?: string
}

const DAY_MS = 86_400_000

// Resuelve el rango a partir de los searchParams. Mantiene la semántica de
// "ventana rodante" del comportamiento previo (30d = ahora menos 30 días).
export function resolveDateRange(params: RawRangeParams): ResolvedRange {
    const now = new Date()

    // Rango personalizado: ?from=YYYY-MM-DD&to=YYYY-MM-DD (fechas de calendario)
    if (params.from && params.to) {
        const from = new Date(`${params.from}T00:00:00`)
        const to = new Date(`${params.to}T23:59:59.999`)
        if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from <= to) {
            const ms = to.getTime() - from.getTime()
            return {
                startDate: from,
                endDate: to,
                prevStartDate: new Date(from.getTime() - ms),
                prevEndDate: from,
                rangeKey: "custom",
                label: `${params.from} → ${params.to}`,
                days: Math.max(1, Math.round(ms / DAY_MS)),
            }
        }
    }

    // Preset (ventana rodante, default 30d)
    const preset =
        RANGE_PRESETS.find((p) => p.key === params.range && p.days) ??
        RANGE_PRESETS.find((p) => p.key === DEFAULT_RANGE_KEY)!
    const days = preset.days ?? 30
    const windowMs = days * DAY_MS
    const startDate = new Date(now.getTime() - windowMs)

    return {
        startDate,
        endDate: now,
        prevStartDate: new Date(now.getTime() - 2 * windowMs),
        prevEndDate: startDate,
        rangeKey: preset.key,
        label: days === 1 ? "últimas 24 horas" : `últimos ${days} días`,
        days,
    }
}
