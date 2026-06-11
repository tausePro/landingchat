/**
 * Semana ISO 8601 en formato 'YYYY-Www' (ej. '2026-W24').
 *
 * Clave de idempotencia del cron semanal del copilot: el año es el
 * ISO week-numbering year (puede diferir del año calendario en los
 * bordes — ej. 2026-01-01 puede pertenecer a la W53 de 2025).
 */
export function computeIsoWeek(date: Date): string {
    // Algoritmo ISO 8601: la semana 1 es la que contiene el primer jueves del año.
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    // Mover al jueves de la semana actual (ISO: lunes=1 ... domingo=7)
    const isoDay = target.getUTCDay() === 0 ? 7 : target.getUTCDay()
    target.setUTCDate(target.getUTCDate() + 4 - isoDay)

    const isoYear = target.getUTCFullYear()
    const yearStart = new Date(Date.UTC(isoYear, 0, 1))
    const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)

    return `${isoYear}-W${String(week).padStart(2, "0")}`
}
