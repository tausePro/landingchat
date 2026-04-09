"use client"

interface ProgressBarProps {
    currentStep: number
    totalSteps: number
    stepLabel?: string
}

export function ProgressBar({ currentStep, totalSteps, stepLabel }: ProgressBarProps) {
    const percentage = (currentStep / totalSteps) * 100

    return (
        <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/85 sm:p-5">
            <div className="flex flex-col gap-3">
                <div className="flex gap-6 justify-between items-center">
                    <p className="text-slate-900 dark:text-slate-100 text-sm font-semibold leading-normal sm:text-base">
                        Progreso de Configuración
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 text-sm font-semibold">
                        Paso {currentStep} de {totalSteps}
                    </p>
                </div>
                <div className="w-full rounded-full bg-slate-200 dark:bg-slate-800 h-2.5">
                    <div
                        className="h-2.5 rounded-full bg-primary transition-all duration-300 shadow-[0_0_20px_rgba(43,124,238,0.35)]"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                {stepLabel && (
                    <p className="text-slate-700 dark:text-slate-300 text-sm font-medium leading-normal">
                        {stepLabel}
                    </p>
                )}
            </div>
        </div>
    )
}
