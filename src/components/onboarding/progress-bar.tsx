"use client"

interface ProgressBarProps {
    currentStep: number
    totalSteps: number
    stepLabel?: string
}

export function ProgressBar({ currentStep, totalSteps, stepLabel }: ProgressBarProps) {
    const percentage = (currentStep / totalSteps) * 100

    return (
        <div className="flex flex-col gap-3">
            <div className="flex gap-6 justify-between items-center">
                <p className="text-slate-900 dark:text-slate-200 text-base font-medium leading-normal">
                    Progreso de Configuración
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                    Paso {currentStep} de {totalSteps}
                </p>
            </div>
            <div className="w-full rounded-full bg-slate-200 dark:bg-slate-700 h-2">
                <div
                    className="h-2 rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                />
            </div>
            {stepLabel && (
                <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">
                    {stepLabel}
                </p>
            )}
        </div>
    )
}
