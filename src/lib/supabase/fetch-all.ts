/**
 * Paginación obligatoria sobre PostgREST (auditoría 2026-06-12).
 *
 * PostgREST capa TODA respuesta en 1000 filas (`db-max-rows`) sin importar
 * `.limit(5000)` ni `.range(0, 4999)` — el exceso se descarta EN SILENCIO.
 * Ya mordió dos veces: Consumo IA (ventanas idénticas) y weeklyMetrics del
 * copilot (métricas subestimadas). Toda agregación que pueda superar 1000
 * filas debe usar este helper.
 *
 * Contrato: nunca lanza; `truncated=true` si se alcanzó maxRows (loguear
 * en el caller si la exactitud importa).
 */

export interface FetchAllResult<T> {
    rows: T[]
    truncated: boolean
    error: string | null
}

export interface FetchAllOptions {
    pageSize?: number
    /** Tope de seguridad para acotar tiempo/memoria (default 10k). */
    maxRows?: number
}

type PageQuery<T> = (from: number, to: number) => PromiseLike<{
    data: T[] | null
    error: { message: string } | null
}>

export async function fetchAllPages<T>(
    buildQuery: PageQuery<T>,
    options: FetchAllOptions = {}
): Promise<FetchAllResult<T>> {
    const pageSize = Math.min(Math.max(options.pageSize ?? 1000, 1), 1000)
    const maxRows = options.maxRows ?? 10_000

    const rows: T[] = []
    let from = 0

    while (rows.length < maxRows) {
        let page: T[]
        try {
            const { data, error } = await buildQuery(from, from + pageSize - 1)
            if (error) {
                return { rows, truncated: false, error: error.message }
            }
            page = data ?? []
        } catch (caught) {
            return {
                rows,
                truncated: false,
                error: caught instanceof Error ? caught.message : "unknown",
            }
        }

        rows.push(...page)
        if (page.length < pageSize) {
            return { rows, truncated: false, error: null }
        }
        from += pageSize
    }

    return { rows: rows.slice(0, maxRows), truncated: true, error: null }
}
