"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getShippingSettings, updateShippingSettings, ShippingSettings } from "./actions"

export default function ShippingConfigPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [settings, setSettings] = useState<ShippingSettings | null>(null)

    // Form state
    const [freeShippingEnabled, setFreeShippingEnabled] = useState(false)
    const [freeShippingMinAmount, setFreeShippingMinAmount] = useState("")
    const [freeShippingZones, setFreeShippingZones] = useState("")
    const [defaultShippingRate, setDefaultShippingRate] = useState("")
    const [expressShippingRate, setExpressShippingRate] = useState("")
    const [estimatedDeliveryDays, setEstimatedDeliveryDays] = useState("3")
    const [expressDeliveryDays, setExpressDeliveryDays] = useState("1")

    useEffect(() => {
        async function loadSettings() {
            try {
                const data = await getShippingSettings()
                if (data) {
                    setSettings(data)
                    setFreeShippingEnabled(data.free_shipping_enabled)
                    setFreeShippingMinAmount(data.free_shipping_min_amount?.toString() || "")
                    setFreeShippingZones(data.free_shipping_zones?.join(", ") || "")
                    setDefaultShippingRate(data.default_shipping_rate?.toString() || "")
                    setExpressShippingRate(data.express_shipping_rate?.toString() || "")
                    setEstimatedDeliveryDays(data.estimated_delivery_days?.toString() || "3")
                    setExpressDeliveryDays(data.express_delivery_days?.toString() || "1")
                }
            } catch (error) {
                console.error("Error loading settings:", error)
            }
        }
        loadSettings()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            await updateShippingSettings({
                free_shipping_enabled: freeShippingEnabled,
                free_shipping_min_amount: freeShippingMinAmount ? parseFloat(freeShippingMinAmount) : null,
                free_shipping_zones: freeShippingZones ? freeShippingZones.split(",").map(z => z.trim()) : null,
                default_shipping_rate: parseFloat(defaultShippingRate) || 0,
                express_shipping_rate: expressShippingRate ? parseFloat(expressShippingRate) : null,
                estimated_delivery_days: parseInt(estimatedDeliveryDays) || 3,
                express_delivery_days: parseInt(expressDeliveryDays) || 1
            })

            alert("Configuración guardada exitosamente")
            router.push("/dashboard/marketing")
        } catch (error) {
            console.error("Error saving settings:", error)
            alert("Error al guardar la configuración")
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
                        Configuración de Envío
                    </h1>
                    <p className="text-text-light-secondary dark:text-text-dark-secondary text-base mt-1">
                        Configura las reglas de envío gratis y tarifas de envío
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Free Shipping Section */}
                <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                    <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary mb-6">
                        Envío Gratis
                    </h2>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                    Habilitar Envío Gratis
                                </h3>
                                <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                    Ofrece envío gratis cuando se cumplan las condiciones
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={freeShippingEnabled}
                                    onChange={e => setFreeShippingEnabled(e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/50 dark:peer-focus:ring-primary/80 rounded-full peer dark:bg-border-dark peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                            </label>
                        </div>

                        {freeShippingEnabled && (
                            <>
                                <div>
                                    <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                        Monto Mínimo de Compra (COP)
                                    </label>
                                    <div className="relative mt-2">
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-text-light-secondary dark:text-text-dark-secondary">$</span>
                                        <input
                                            type="number"
                                            step="100"
                                            placeholder="50000"
                                            value={freeShippingMinAmount}
                                            onChange={e => setFreeShippingMinAmount(e.target.value)}
                                            className="form-input w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent pl-7"
                                        />
                                    </div>
                                    <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                        Deja vacío para envío gratis sin mínimo
                                    </p>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                        Zonas Geográficas (separadas por coma)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Bogotá, Medellín, Cali"
                                        value={freeShippingZones}
                                        onChange={e => setFreeShippingZones(e.target.value)}
                                        className="form-input mt-2 w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent"
                                    />
                                    <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                        Deja vacío para aplicar en todas las zonas
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Shipping Rates Section */}
                <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                    <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary mb-6">
                        Tarifas de Envío
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                Tarifa Estándar (COP)
                            </label>
                            <div className="relative mt-2">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-text-light-secondary dark:text-text-dark-secondary">$</span>
                                <input
                                    type="number"
                                    step="100"
                                    placeholder="10000"
                                    value={defaultShippingRate}
                                    onChange={e => setDefaultShippingRate(e.target.value)}
                                    className="form-input w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent pl-7"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                Tarifa Express (COP)
                            </label>
                            <div className="relative mt-2">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-text-light-secondary dark:text-text-dark-secondary">$</span>
                                <input
                                    type="number"
                                    step="100"
                                    placeholder="20000"
                                    value={expressShippingRate}
                                    onChange={e => setExpressShippingRate(e.target.value)}
                                    className="form-input w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent pl-7"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                Días de Entrega Estándar
                            </label>
                            <input
                                type="number"
                                min="1"
                                placeholder="3"
                                value={estimatedDeliveryDays}
                                onChange={e => setEstimatedDeliveryDays(e.target.value)}
                                className="form-input mt-2 w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                Días de Entrega Express
                            </label>
                            <input
                                type="number"
                                min="1"
                                placeholder="1"
                                value={expressDeliveryDays}
                                onChange={e => setExpressDeliveryDays(e.target.value)}
                                className="form-input mt-2 w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent"
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                    <button
                        type="submit"
                        disabled={loading}
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
