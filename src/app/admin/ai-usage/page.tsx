import { DollarSign, Activity, Zap, Database, AlertTriangle, TrendingDown } from "lucide-react"
import { getAiUsageOverview, type AiUsageOverviewWithOrgs } from "./actions"
import { MetricCard } from "./components/metric-card"
import { AiUsageEmptyState } from "./components/empty-state"
import { PeriodSelector } from "./components/period-selector"
import {
    formatCentsAsUsd,
    formatCentsAsUsdCompact,
    formatLatency,
    formatPercent,
    formatRelativeTime,
    formatTokens,
} from "./lib/format"

export const dynamic = "force-dynamic"

interface PageProps {
    searchParams: Promise<{ days?: string }>
}

const DEFAULT_DAYS = 30

export default async function AiUsagePage({ searchParams }: PageProps) {
    const params = await searchParams
    const daysParam = Number(params.days)
    const days = [7, 14, 30, 90].includes(daysParam) ? daysParam : DEFAULT_DAYS

    const result = await getAiUsageOverview(days)

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Consumo IA
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Telemetría LLM por tenant, agente, modelo y canal. Lectura sobre <code className="font-mono">ai_usage_events</code>.
                    </p>
                </div>
                <PeriodSelector active={days} />
            </div>

            {!result.success ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
                    <p className="text-sm text-red-700 dark:text-red-300">
                        Error al cargar datos: {result.error}
                    </p>
                </div>
            ) : result.data.hero.total_events === 0 ? (
                <AiUsageEmptyState periodDays={days} />
            ) : (
                <AiUsageOverviewView data={result.data} />
            )}
        </div>
    )
}

function AiUsageOverviewView({ data }: { data: AiUsageOverviewWithOrgs }) {
    const { hero, by_model, by_channel, by_mode, by_org_top, recent_errors, organizations, truncated, period_days } = data

    return (
        <div className="space-y-8">
            {truncated ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                    Truncado a 50.000 filas. Bajá el rango para ver detalle más fino o pedí mover este dashboard a SQL views.
                </div>
            ) : null}

            {/* Hero — top row: lo más importante */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    label="Costo total"
                    value={formatCentsAsUsdCompact(hero.total_cost_usd_cents)}
                    subValue={`${formatCentsAsUsd(hero.total_cost_usd_cents)} en ${period_days} días`}
                    icon={<DollarSign className="size-6" />}
                    tone="green"
                />
                <MetricCard
                    label="Llamadas a Claude"
                    value={hero.total_events.toLocaleString("en-US")}
                    subValue={`${hero.distinct_organizations} organizaciones activas`}
                    icon={<Activity className="size-6" />}
                    tone="blue"
                />
                <MetricCard
                    label="Cache hit rate"
                    value={formatPercent(hero.cache_hit_rate)}
                    subValue={hero.cache_hit_rate > 0 ? "Prompt caching ON" : "Sin caché aún (activar AI_PROMPT_CACHING_ENABLED)"}
                    icon={<Zap className="size-6" />}
                    tone={hero.cache_hit_rate > 0.3 ? "green" : "amber"}
                />
                <MetricCard
                    label="Tasa de error"
                    value={formatPercent(hero.error_rate)}
                    subValue={hero.error_rate === 0 ? "Sin errores en período" : "Revisar tabla de errores"}
                    icon={<AlertTriangle className="size-6" />}
                    tone={hero.error_rate > 0.01 ? "rose" : "indigo"}
                />
            </div>

            {/* Hero — segunda fila: detalle de tokens */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    label="Tokens de input"
                    value={formatTokens(hero.total_input_tokens)}
                    subValue="(sin contar cache)"
                    icon={<Database className="size-6" />}
                    tone="purple"
                />
                <MetricCard
                    label="Tokens de output"
                    value={formatTokens(hero.total_output_tokens)}
                    subValue="generados por Claude"
                    icon={<Database className="size-6" />}
                    tone="purple"
                />
                <MetricCard
                    label="Cache reads"
                    value={formatTokens(hero.total_cache_read_input_tokens)}
                    subValue="ahorro vs. input fresh ≈ 90%"
                    icon={<TrendingDown className="size-6" />}
                    tone="green"
                />
                <MetricCard
                    label="Cache writes"
                    value={formatTokens(hero.total_cache_creation_input_tokens)}
                    subValue="primer write (premium ~25%)"
                    icon={<Database className="size-6" />}
                    tone="amber"
                />
            </div>

            {/* Top tenants por costo */}
            <section>
                <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
                    Top tenants por costo
                </h2>
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                <th className="px-4 py-3 text-left font-medium">Organización</th>
                                <th className="px-4 py-3 text-right font-medium">Costo</th>
                                <th className="px-4 py-3 text-right font-medium">Llamadas</th>
                                <th className="px-4 py-3 text-right font-medium">Input</th>
                                <th className="px-4 py-3 text-right font-medium">Output</th>
                                <th className="px-4 py-3 text-right font-medium">Cache reads</th>
                                <th className="px-4 py-3 text-left font-medium">Último evento</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {by_org_top.map((org) => {
                                const lookup = organizations[org.organization_id]
                                const label = lookup?.name ?? lookup?.subdomain ?? org.organization_id.slice(0, 8)
                                return (
                                    <tr key={org.organization_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-slate-900 dark:text-white">{label}</div>
                                            {lookup?.subdomain ? (
                                                <div className="text-xs text-slate-500 dark:text-slate-400">{lookup.subdomain}</div>
                                            ) : null}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-white">
                                            {formatCentsAsUsd(org.cost_usd_cents)}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                                            {org.events.toLocaleString("en-US")}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                                            {formatTokens(org.input_tokens)}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                                            {formatTokens(org.output_tokens)}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                                            {formatTokens(org.cache_read_input_tokens)}
                                        </td>
                                        <td className="px-4 py-3 text-left text-slate-500 dark:text-slate-400">
                                            {formatRelativeTime(org.last_event_at)}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Por modelo */}
            <section>
                <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
                    Distribución por modelo
                </h2>
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                <th className="px-4 py-3 text-left font-medium">Modelo</th>
                                <th className="px-4 py-3 text-right font-medium">Costo</th>
                                <th className="px-4 py-3 text-right font-medium">Llamadas</th>
                                <th className="px-4 py-3 text-right font-medium">Input</th>
                                <th className="px-4 py-3 text-right font-medium">Output</th>
                                <th className="px-4 py-3 text-right font-medium">Cache reads</th>
                                <th className="px-4 py-3 text-right font-medium" title="Latencia mediana">P50</th>
                                <th className="px-4 py-3 text-right font-medium" title="Latencia p95">P95</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {by_model.map((m) => (
                                <tr key={m.model}>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-900 dark:text-white">{m.model}</td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-white">{formatCentsAsUsd(m.cost_usd_cents)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{m.events.toLocaleString("en-US")}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{formatTokens(m.input_tokens)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{formatTokens(m.output_tokens)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{formatTokens(m.cache_read_input_tokens)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{formatLatency(m.p50_latency_ms)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{formatLatency(m.p95_latency_ms)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Por canal + por mode — dos columnas */}
            <div className="grid gap-6 lg:grid-cols-2">
                <section>
                    <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
                        Por canal
                    </h2>
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                    <th className="px-4 py-3 text-left font-medium">Canal</th>
                                    <th className="px-4 py-3 text-right font-medium">Costo</th>
                                    <th className="px-4 py-3 text-right font-medium">Llamadas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {by_channel.map((c) => (
                                    <tr key={c.channel}>
                                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{c.channel}</td>
                                        <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">{formatCentsAsUsd(c.cost_usd_cents)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{c.events.toLocaleString("en-US")}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
                        Por modo
                    </h2>
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                    <th className="px-4 py-3 text-left font-medium">Modo</th>
                                    <th className="px-4 py-3 text-right font-medium">Costo</th>
                                    <th className="px-4 py-3 text-right font-medium">Llamadas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {by_mode.map((m) => (
                                    <tr key={m.mode}>
                                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{m.mode}</td>
                                        <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">{formatCentsAsUsd(m.cost_usd_cents)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{m.events.toLocaleString("en-US")}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            {/* Errores recientes (solo si hay) */}
            {recent_errors.length > 0 ? (
                <section>
                    <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
                        Errores recientes
                    </h2>
                    <div className="overflow-x-auto rounded-xl border border-rose-200 bg-rose-50/40 shadow-sm dark:border-rose-900/40 dark:bg-rose-900/10">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-rose-200 text-xs uppercase tracking-wider text-rose-700 dark:border-rose-900/50 dark:text-rose-300">
                                    <th className="px-4 py-3 text-left font-medium">Cuándo</th>
                                    <th className="px-4 py-3 text-left font-medium">Org</th>
                                    <th className="px-4 py-3 text-left font-medium">Modelo</th>
                                    <th className="px-4 py-3 text-left font-medium">Canal</th>
                                    <th className="px-4 py-3 text-left font-medium">Error</th>
                                    <th className="px-4 py-3 text-right font-medium">Latencia</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-rose-200 dark:divide-rose-900/40">
                                {recent_errors.map((e, idx) => {
                                    const lookup = organizations[e.organization_id]
                                    const orgLabel = lookup?.name ?? lookup?.subdomain ?? e.organization_id.slice(0, 8)
                                    return (
                                        <tr key={`${e.organization_id}-${e.created_at}-${idx}`}>
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatRelativeTime(e.created_at)}</td>
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{orgLabel}</td>
                                            <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{e.model}</td>
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{e.channel ?? "—"}</td>
                                            <td className="px-4 py-3 font-mono text-xs text-rose-700 dark:text-rose-300">{e.error_code}</td>
                                            <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{formatLatency(e.latency_ms)}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            ) : null}

            <p className="text-xs text-slate-500 dark:text-slate-400">
                Mostrando {hero.total_events.toLocaleString("en-US")} evento(s) en los últimos {period_days} días.
                Una fila por llamada a Claude (un mensaje del usuario puede generar varias filas por el loop de tools).
            </p>
        </div>
    )
}
