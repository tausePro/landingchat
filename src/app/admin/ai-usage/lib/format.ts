/**
 * Helpers de formateo para el dashboard /admin/ai-usage.
 *
 * Puros, testeables. Usados desde el page server component.
 */

const usdFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})

const usdFormatterCompact = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
})

const intFormatter = new Intl.NumberFormat("en-US")

/**
 * Formatea centavos USD como "$1,234.56" (precisión completa).
 */
export function formatCentsAsUsd(cents: number): string {
    return usdFormatter.format(cents / 100)
}

/**
 * Formatea centavos USD compacto (sin centavos) para hero cards: "$1,234".
 */
export function formatCentsAsUsdCompact(cents: number): string {
    return usdFormatterCompact.format(Math.round(cents / 100))
}

/**
 * Formatea cantidad de tokens con sufijo K/M para legibilidad:
 *   1234 → "1.2K"
 *   1234567 → "1.23M"
 *   < 1000 → "999"
 */
export function formatTokens(n: number): string {
    if (n < 1000) return intFormatter.format(n)
    if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`
    if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}M`
    return `${(n / 1_000_000_000).toFixed(2)}B`
}

/**
 * Formatea porcentaje 0..1 como "42.3%".
 */
export function formatPercent(ratio: number, fractionDigits = 1): string {
    return `${(ratio * 100).toFixed(fractionDigits)}%`
}

/**
 * Formatea ISO timestamp como fecha relativa corta en español-CO:
 *   "hace 3 min", "hace 2 horas", "hace 5 días", "hace > 30 días"
 */
export function formatRelativeTime(iso: string, nowMs: number = Date.now()): string {
    const ts = new Date(iso).getTime()
    if (Number.isNaN(ts)) return "—"
    const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000))
    if (diffSec < 60) return "hace segundos"
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `hace ${diffMin} min`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `hace ${diffHr} h`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 30) return `hace ${diffDay} d`
    return "hace > 30 d"
}

/**
 * Formatea latencia ms como "230 ms" o "1.4 s" si >= 1000.
 */
export function formatLatency(ms: number): string {
    if (ms < 1000) return `${ms} ms`
    return `${(ms / 1000).toFixed(1)} s`
}
