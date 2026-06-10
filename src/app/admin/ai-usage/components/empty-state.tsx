/**
 * Empty state cuando ai_usage_events no tiene datos en el período.
 *
 * Explica el porqué (flag OFF, sin tráfico todavía) y guía al usuario
 * a la configuración correcta sin asumir que ya están activadas las env vars.
 */
export function AiUsageEmptyState({ periodDays }: { periodDays: number }) {
    return (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center dark:border-slate-700 dark:bg-slate-900/30">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/20">
                <svg className="size-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Sin eventos de consumo en los últimos {periodDays} días
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                La tabla <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-800 dark:bg-slate-800 dark:text-slate-200">ai_usage_events</code> está vacía para este rango.
                Verifica que <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-800 dark:bg-slate-800 dark:text-slate-200">AI_USAGE_TRACKING_ENABLED=true</code> esté configurada en Vercel y que el chat haya recibido tráfico desde entonces.
            </p>
            <p className="mx-auto mt-3 max-w-md text-xs text-slate-500 dark:text-slate-400">
                Una vez activado, una fila se inserta por cada llamada a Claude (fire-and-forget).
            </p>
        </div>
    )
}
