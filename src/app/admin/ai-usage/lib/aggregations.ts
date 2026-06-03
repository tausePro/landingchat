/**
 * Helpers de agregación para el dashboard /admin/ai-usage.
 *
 * Son funciones puras (sin Supabase, sin Next) para que se puedan testear
 * en isolation con vitest. La server action `getAiUsageOverview` carga las
 * filas crudas de `ai_usage_events` y las pasa a estas funciones.
 *
 * Para v1 agregamos en JS (volumen esperado: < 100k filas/mes en arranque).
 * Si el volumen sube, se migra a un view SQL o RPC con percentile_cont.
 */

export interface AiUsageEventRow {
    organization_id: string
    model: string
    mode: string | null
    channel: string | null
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens: number
    cache_read_input_tokens: number
    cost_usd_cents: number
    latency_ms: number
    error_code: string | null
    created_at: string
}

export interface ModelBreakdown {
    model: string
    events: number
    cost_usd_cents: number
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens: number
    cache_read_input_tokens: number
    avg_latency_ms: number
    p50_latency_ms: number
    p95_latency_ms: number
}

export interface ChannelBreakdown {
    channel: string
    events: number
    cost_usd_cents: number
}

export interface ModeBreakdown {
    mode: string
    events: number
    cost_usd_cents: number
}

export interface OrgBreakdown {
    organization_id: string
    events: number
    cost_usd_cents: number
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens: number
    last_event_at: string
}

export interface HeroMetrics {
    total_events: number
    total_cost_usd_cents: number
    total_input_tokens: number
    total_output_tokens: number
    total_cache_creation_input_tokens: number
    total_cache_read_input_tokens: number
    cache_hit_rate: number          // 0..1 — cache_read / (cache_read + cache_creation + input)
    distinct_organizations: number
    error_rate: number              // 0..1 — events con error_code / total
}

export interface AiUsageOverview {
    hero: HeroMetrics
    by_model: ModelBreakdown[]
    by_channel: ChannelBreakdown[]
    by_mode: ModeBreakdown[]
    by_org_top: OrgBreakdown[]      // top 20 por costo
    recent_errors: AiUsageEventRow[]
}

/**
 * Computa percentil aproximado por interpolación lineal.
 * Funciona para arrays no vacíos; en arrays vacíos devuelve 0.
 *
 * Para v1 alcanza. Si el volumen crece, mover a SQL con `percentile_cont`.
 */
export function percentile(values: readonly number[], p: number): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    if (p <= 0) return sorted[0] ?? 0
    if (p >= 1) return sorted[sorted.length - 1] ?? 0
    const rank = p * (sorted.length - 1)
    const lo = Math.floor(rank)
    const hi = Math.ceil(rank)
    if (lo === hi) return sorted[lo] ?? 0
    const fraction = rank - lo
    const loVal = sorted[lo] ?? 0
    const hiVal = sorted[hi] ?? 0
    return loVal + (hiVal - loVal) * fraction
}

/**
 * Cache hit rate: porción del input que vino de cache.
 *
 * Si no hubo caching (cache_creation + cache_read = 0), devuelve 0
 * en lugar de NaN para que el UI muestre 0% legible.
 */
export function calculateCacheHitRate(
    cacheRead: number,
    cacheCreate: number,
    inputFresh: number,
): number {
    const totalInput = cacheRead + cacheCreate + inputFresh
    if (totalInput === 0) return 0
    return cacheRead / totalInput
}

/**
 * Agrega filas en breakdowns por modelo / channel / mode / org.
 * Devuelve estructuras listas para renderizar.
 */
export function buildOverview(rows: readonly AiUsageEventRow[]): AiUsageOverview {
    if (rows.length === 0) {
        return {
            hero: {
                total_events: 0,
                total_cost_usd_cents: 0,
                total_input_tokens: 0,
                total_output_tokens: 0,
                total_cache_creation_input_tokens: 0,
                total_cache_read_input_tokens: 0,
                cache_hit_rate: 0,
                distinct_organizations: 0,
                error_rate: 0,
            },
            by_model: [],
            by_channel: [],
            by_mode: [],
            by_org_top: [],
            recent_errors: [],
        }
    }

    // Totales del hero
    let totalCost = 0
    let totalInput = 0
    let totalOutput = 0
    let totalCacheCreate = 0
    let totalCacheRead = 0
    let totalErrors = 0
    const orgs = new Set<string>()

    // Buckets para breakdowns
    const modelMap = new Map<string, {
        events: number
        cost_usd_cents: number
        input_tokens: number
        output_tokens: number
        cache_creation_input_tokens: number
        cache_read_input_tokens: number
        latencies: number[]
    }>()
    const channelMap = new Map<string, { events: number; cost_usd_cents: number }>()
    const modeMap = new Map<string, { events: number; cost_usd_cents: number }>()
    const orgMap = new Map<string, {
        events: number
        cost_usd_cents: number
        input_tokens: number
        output_tokens: number
        cache_read_input_tokens: number
        last_event_at: string
    }>()

    for (const row of rows) {
        totalCost += row.cost_usd_cents
        totalInput += row.input_tokens
        totalOutput += row.output_tokens
        totalCacheCreate += row.cache_creation_input_tokens
        totalCacheRead += row.cache_read_input_tokens
        if (row.error_code !== null) totalErrors++
        orgs.add(row.organization_id)

        // Por modelo
        const modelBucket = modelMap.get(row.model) ?? {
            events: 0,
            cost_usd_cents: 0,
            input_tokens: 0,
            output_tokens: 0,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
            latencies: [],
        }
        modelBucket.events += 1
        modelBucket.cost_usd_cents += row.cost_usd_cents
        modelBucket.input_tokens += row.input_tokens
        modelBucket.output_tokens += row.output_tokens
        modelBucket.cache_creation_input_tokens += row.cache_creation_input_tokens
        modelBucket.cache_read_input_tokens += row.cache_read_input_tokens
        modelBucket.latencies.push(row.latency_ms)
        modelMap.set(row.model, modelBucket)

        // Por channel (NULL → 'unknown')
        const ch = row.channel ?? "unknown"
        const chBucket = channelMap.get(ch) ?? { events: 0, cost_usd_cents: 0 }
        chBucket.events += 1
        chBucket.cost_usd_cents += row.cost_usd_cents
        channelMap.set(ch, chBucket)

        // Por mode
        const mo = row.mode ?? "unknown"
        const moBucket = modeMap.get(mo) ?? { events: 0, cost_usd_cents: 0 }
        moBucket.events += 1
        moBucket.cost_usd_cents += row.cost_usd_cents
        modeMap.set(mo, moBucket)

        // Por org
        const orgBucket = orgMap.get(row.organization_id) ?? {
            events: 0,
            cost_usd_cents: 0,
            input_tokens: 0,
            output_tokens: 0,
            cache_read_input_tokens: 0,
            last_event_at: row.created_at,
        }
        orgBucket.events += 1
        orgBucket.cost_usd_cents += row.cost_usd_cents
        orgBucket.input_tokens += row.input_tokens
        orgBucket.output_tokens += row.output_tokens
        orgBucket.cache_read_input_tokens += row.cache_read_input_tokens
        if (row.created_at > orgBucket.last_event_at) orgBucket.last_event_at = row.created_at
        orgMap.set(row.organization_id, orgBucket)
    }

    const by_model: ModelBreakdown[] = Array.from(modelMap.entries())
        .map(([model, b]) => {
            const avg = b.latencies.length > 0
                ? b.latencies.reduce((s, n) => s + n, 0) / b.latencies.length
                : 0
            return {
                model,
                events: b.events,
                cost_usd_cents: b.cost_usd_cents,
                input_tokens: b.input_tokens,
                output_tokens: b.output_tokens,
                cache_creation_input_tokens: b.cache_creation_input_tokens,
                cache_read_input_tokens: b.cache_read_input_tokens,
                avg_latency_ms: Math.round(avg),
                p50_latency_ms: Math.round(percentile(b.latencies, 0.5)),
                p95_latency_ms: Math.round(percentile(b.latencies, 0.95)),
            }
        })
        .sort((a, b) => b.cost_usd_cents - a.cost_usd_cents)

    const by_channel: ChannelBreakdown[] = Array.from(channelMap.entries())
        .map(([channel, b]) => ({ channel, events: b.events, cost_usd_cents: b.cost_usd_cents }))
        .sort((a, b) => b.cost_usd_cents - a.cost_usd_cents)

    const by_mode: ModeBreakdown[] = Array.from(modeMap.entries())
        .map(([mode, b]) => ({ mode, events: b.events, cost_usd_cents: b.cost_usd_cents }))
        .sort((a, b) => b.cost_usd_cents - a.cost_usd_cents)

    const by_org_top: OrgBreakdown[] = Array.from(orgMap.entries())
        .map(([organization_id, b]) => ({
            organization_id,
            events: b.events,
            cost_usd_cents: b.cost_usd_cents,
            input_tokens: b.input_tokens,
            output_tokens: b.output_tokens,
            cache_read_input_tokens: b.cache_read_input_tokens,
            last_event_at: b.last_event_at,
        }))
        .sort((a, b) => b.cost_usd_cents - a.cost_usd_cents)
        .slice(0, 20)

    const recent_errors = rows
        .filter((r) => r.error_code !== null)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, 20)

    return {
        hero: {
            total_events: rows.length,
            total_cost_usd_cents: totalCost,
            total_input_tokens: totalInput,
            total_output_tokens: totalOutput,
            total_cache_creation_input_tokens: totalCacheCreate,
            total_cache_read_input_tokens: totalCacheRead,
            cache_hit_rate: calculateCacheHitRate(totalCacheRead, totalCacheCreate, totalInput),
            distinct_organizations: orgs.size,
            error_rate: totalErrors / rows.length,
        },
        by_model,
        by_channel,
        by_mode,
        by_org_top,
        recent_errors,
    }
}
