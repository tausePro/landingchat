/**
 * Precios de Anthropic (USD por 1M tokens) y calculador de costo.
 *
 * Snapshot manual — actualizar en cada release que cambie pricing.
 * Última actualización: 2026-05-28.
 *
 * Refs:
 *  - https://www.anthropic.com/pricing
 *  - docs-private/INFORME_2_OBSERVABILIDAD_TOKENS_MULTIAGENT.md §1.4
 */

export interface ModelPricingUsdPer1M {
    input: number          // tokens de input no cacheados
    output: number         // tokens de output
    cache_write: number    // primer write a cache (premium ~25% sobre input)
    cache_read: number     // lectura de cache (≈10% del input)
}

export const ANTHROPIC_PRICING_USD_PER_1M_TOKENS: Record<string, ModelPricingUsdPer1M> = {
    "claude-haiku-4-5-20251001": {
        input: 1.0,
        output: 5.0,
        cache_write: 1.25,
        cache_read: 0.10,
    },
    "claude-sonnet-4-5-20250929": {
        input: 3.0,
        output: 15.0,
        cache_write: 3.75,
        cache_read: 0.30,
    },
}

export interface UsageSnapshot {
    input_tokens: number
    output_tokens: number
    // El SDK de Anthropic tipa estos como `number | null` (no `| undefined`),
    // por eso aceptamos ambos para evitar narrowing extra en el caller.
    cache_creation_input_tokens?: number | null
    cache_read_input_tokens?: number | null
}

/**
 * Calcula el costo (en centavos USD, redondeado hacia arriba) de una respuesta
 * de Anthropic dado el modelo y los counters de `response.usage`.
 *
 * Retorna 0 si el modelo no está en la tabla (no rompe el insert, solo no se
 * computa costo). Esto es defensivo: si Anthropic saca un modelo nuevo y no
 * actualizamos la tabla, no perdemos la fila de telemetría.
 */
export function calculateCostCents(model: string, usage: UsageSnapshot): number {
    const price = ANTHROPIC_PRICING_USD_PER_1M_TOKENS[model]
    if (!price) return 0

    const inputUsd = (usage.input_tokens / 1_000_000) * price.input
    const outputUsd = (usage.output_tokens / 1_000_000) * price.output
    const cacheWriteUsd = ((usage.cache_creation_input_tokens ?? 0) / 1_000_000) * price.cache_write
    const cacheReadUsd = ((usage.cache_read_input_tokens ?? 0) / 1_000_000) * price.cache_read

    const totalUsd = inputUsd + outputUsd + cacheWriteUsd + cacheReadUsd
    return Math.ceil(totalUsd * 100)
}

/**
 * Lista de modelos soportados (para validación o UI de admin).
 */
export function getSupportedModels(): string[] {
    return Object.keys(ANTHROPIC_PRICING_USD_PER_1M_TOKENS)
}
