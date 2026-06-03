import Link from "next/link"

const OPTIONS: Array<{ days: number; label: string }> = [
    { days: 7, label: "7 días" },
    { days: 14, label: "14 días" },
    { days: 30, label: "30 días" },
    { days: 90, label: "90 días" },
]

export function PeriodSelector({ active }: { active: number }) {
    return (
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {OPTIONS.map((opt) => {
                const isActive = opt.days === active
                return (
                    <Link
                        key={opt.days}
                        href={`/admin/ai-usage?days=${opt.days}`}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                            isActive
                                ? "bg-indigo-600 text-white"
                                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                    >
                        {opt.label}
                    </Link>
                )
            })}
        </div>
    )
}
