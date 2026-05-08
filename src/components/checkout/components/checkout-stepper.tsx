"use client"

import { cn } from "@/lib/utils"
import type { CheckoutStepKey } from "../types"

interface CheckoutStep {
    key: CheckoutStepKey
    label: string
}

interface CheckoutStepperProps {
    steps: ReadonlyArray<CheckoutStep>
    currentStep: CheckoutStepKey
    title: string
    description: string
}

/**
 * Indicador visual de pasos del checkout (Datos → Pago → Listo).
 *
 * Componente puramente presentacional. Recibe `steps` y `currentStep`
 * y renderiza el header con el círculo numerado, label y línea entre steps.
 */
export function CheckoutStepper({ steps, currentStep, title, description }: CheckoutStepperProps) {
    const currentStepIndex = steps.findIndex(item => item.key === currentStep)

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">{title}</h2>
            <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {steps.map((item, index) => (
                        <div key={item.key} className="flex flex-1 items-center gap-2">
                            <div
                                className={cn(
                                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                                    index <= currentStepIndex
                                        ? "border-primary bg-primary text-white"
                                        : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800",
                                )}
                            >
                                {index + 1}
                            </div>
                            <span className={index <= currentStepIndex ? "text-slate-900 dark:text-white" : ""}>
                                {item.label}
                            </span>
                            {index < steps.length - 1 && (
                                <div className="hidden h-px flex-1 bg-slate-200 dark:bg-slate-700 sm:block" />
                            )}
                        </div>
                    ))}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
            </div>
        </div>
    )
}
