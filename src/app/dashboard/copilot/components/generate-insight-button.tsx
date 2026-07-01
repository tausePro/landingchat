"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { generateOnDemandInsight } from "../actions"

/**
 * Botón "Generar reporte ahora" (insight on-demand). El insight aparece en el
 * feed como preview; el envío a WhatsApp/email es aparte (botón en el card).
 */
export function GenerateInsightButton({
    variant = "outline",
    label = "Generar reporte ahora",
}: {
    variant?: "default" | "outline"
    label?: string
}) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const handleClick = async () => {
        setLoading(true)
        try {
            const result = await generateOnDemandInsight()
            if (result.success) {
                toast.success("Reporte generado — lo ves abajo en Pendientes")
                router.refresh()
            } else {
                toast.error(result.error)
            }
        } catch {
            toast.error("Error al generar el reporte")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button variant={variant} onClick={handleClick} disabled={loading} className="gap-2">
            <span className="material-symbols-outlined text-lg">{loading ? "sync" : "auto_awesome"}</span>
            {loading ? "Generando..." : label}
        </Button>
    )
}
