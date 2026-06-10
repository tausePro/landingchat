import type { ReactNode } from "react"

/**
 * Card de métrica destacada del hero del dashboard.
 *
 * Diseño: bordes redondeados, sombra sutil, icono accent en la esquina.
 * Coincide con el estilo de `src/app/admin/page.tsx` y subscriptions.
 */
export function MetricCard({
    label,
    value,
    subValue,
    icon,
    tone = "indigo",
}: {
    label: string
    value: string
    subValue?: string
    icon: ReactNode
    tone?: "indigo" | "green" | "blue" | "amber" | "purple" | "rose"
}) {
    const toneClasses: Record<typeof tone, string> = {
        indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
        green: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
        blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
        amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
        purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
        rose: "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400",
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between">
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
                    <h3 className="mt-2 truncate text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
                    {subValue ? (
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{subValue}</p>
                    ) : null}
                </div>
                <div className={`flex-shrink-0 rounded-full p-3 ${toneClasses[tone]}`}>
                    {icon}
                </div>
            </div>
        </div>
    )
}
