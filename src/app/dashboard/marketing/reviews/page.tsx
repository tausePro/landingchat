"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { getReviewRequestSettings, updateReviewRequestSettings } from "./actions"

/**
 * Config de solicitud automática de reseñas post-compra (opt-in).
 * El cron diario envía a los clientes de órdenes pagadas un link
 * tokenizado para reseñar; las reseñas entran sin publicar y se
 * moderan desde el gestor de reseñas de cada producto.
 */
export default function ReviewRequestsConfigPage() {
    const [loading, setLoading] = useState(false)
    const [loaded, setLoaded] = useState(false)
    const [enabled, setEnabled] = useState(false)
    const [delayDays, setDelayDays] = useState("7")

    useEffect(() => {
        getReviewRequestSettings().then((result) => {
            if (result.success) {
                setEnabled(result.data.enabled)
                setDelayDays(result.data.delayDays.toString())
            }
            setLoaded(true)
        })
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const result = await updateReviewRequestSettings({
                enabled,
                delayDays: parseInt(delayDays) || 7,
            })
            if (result.success) {
                toast.success("Configuración guardada")
            } else {
                toast.error(result.error)
            }
        } catch {
            toast.error("Error al guardar la configuración")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/dashboard/marketing" className="text-text-light-secondary dark:text-text-dark-secondary hover:text-primary">
                    <span className="material-symbols-outlined">arrow_back</span>
                </Link>
                <div>
                    <h1 className="text-text-light-primary dark:text-text-dark-primary text-3xl font-bold tracking-tight">
                        Solicitud de Reseñas
                    </h1>
                    <p className="text-text-light-secondary dark:text-text-dark-secondary text-base mt-1">
                        Pide reseñas automáticamente a tus clientes después de cada compra
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                    <div className="space-y-6">
                        <div className="flex items-start justify-between gap-6">
                            <div className="max-w-2xl">
                                <h3 className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                    Habilitar solicitudes automáticas
                                </h3>
                                <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                    Tras cada compra pagada, el cliente recibe por email (y WhatsApp si tienes
                                    instancia conectada) un link para reseñar sus productos. Las reseñas llegan
                                    sin publicar: tú las apruebas desde cada producto. Más reseñas = estrellas
                                    en Google y mejores recomendaciones del agente AI.
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={enabled}
                                    disabled={!loaded}
                                    onChange={e => setEnabled(e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/50 dark:peer-focus:ring-primary/80 rounded-full peer dark:bg-border-dark peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                            </label>
                        </div>

                        {enabled && (
                            <div className="border-t border-border-light dark:border-border-dark pt-6">
                                <label
                                    htmlFor="review-delay-days"
                                    className="block text-sm font-medium text-text-light-primary dark:text-text-dark-primary mb-2"
                                >
                                    Días después del pago para enviar la solicitud
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        id="review-delay-days"
                                        type="number"
                                        min="1"
                                        max="60"
                                        placeholder="7"
                                        value={delayDays}
                                        onChange={e => setDelayDays(e.target.value)}
                                        className="w-24 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-text-light-primary dark:text-text-dark-primary text-center focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                        required
                                    />
                                    <span className="text-sm text-text-light-secondary dark:text-text-dark-secondary">días</span>
                                </div>
                                <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-2">
                                    Recomendado: 7 días — el cliente ya recibió y probó el producto
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        type="submit"
                        disabled={loading || !loaded}
                        className="flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-4 text-white text-sm font-bold shadow-sm hover:bg-primary/90 disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined text-lg">save</span>
                        <span>{loading ? "Guardando..." : "Guardar Configuración"}</span>
                    </button>
                    <Link
                        href="/dashboard/marketing"
                        className="flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark px-4 text-sm font-medium text-text-light-primary dark:text-text-dark-primary hover:bg-background-light dark:hover:bg-background-dark"
                    >
                        Cancelar
                    </Link>
                </div>
            </form>
        </div>
    )
}
