"use client"

import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-tenant-strings"

interface SuccessStepProps {
    onCta: () => void
}

/**
 * Pantalla de confirmación tras crear la orden.
 *
 * Pure presentational. El parent maneja el handler del CTA (que puede
 * navegar al detalle de la orden, cerrar modal, etc.).
 */
export function SuccessStep({ onCta }: SuccessStepProps) {
    const t = useT()
    return (
        <div className="py-8 flex flex-col items-center text-center space-y-4">
            <div className="size-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-3xl">check</span>
            </div>
            <h3 className="text-xl font-bold">{t("store.checkout.success_title")}</h3>
            <p className="text-slate-500 max-w-xs">
                {t("store.checkout.success_message")}
            </p>
            <Button onClick={onCta} className="mt-4 min-w-[200px]">
                {t("store.checkout.success_cta")}
            </Button>
        </div>
    )
}
