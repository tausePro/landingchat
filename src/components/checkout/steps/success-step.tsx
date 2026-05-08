"use client"

import { Button } from "@/components/ui/button"

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
    return (
        <div className="py-8 flex flex-col items-center text-center space-y-4">
            <div className="size-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-3xl">check</span>
            </div>
            <h3 className="text-xl font-bold">¡Gracias por tu compra!</h3>
            <p className="text-slate-500 max-w-xs">
                Hemos recibido tu orden correctamente. Te enviaremos un correo con los detalles y el número de guía.
            </p>
            <Button onClick={onCta} className="mt-4 min-w-[200px]">
                Ver Pedido
            </Button>
        </div>
    )
}
