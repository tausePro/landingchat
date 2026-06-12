"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DollarSign, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
    getOperatingCostsOverview,
    saveOperatingCosts,
    type OperatingCostItem,
    type OperatingCostsOverview,
} from "./actions"

function formatUsd(amount: number): string {
    return amount.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

function formatCop(amount: number): string {
    return `$${amount.toLocaleString("es-CO")} COP`
}

/**
 * Costos de operar la plataforma: fijos manuales (Vercel, Supabase, VPS...)
 * + costo AI medido del mes, cruzado con el MRR real de subscriptions.
 */
export default function OperatingCostsPage() {
    const [overview, setOverview] = useState<OperatingCostsOverview | null>(null)
    const [items, setItems] = useState<OperatingCostItem[]>([])
    const [rate, setRate] = useState(4100)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        const result = await getOperatingCostsOverview()
        if (result.success) {
            setOverview(result.data)
            setItems(result.data.config.items)
            setRate(result.data.config.usd_to_cop_rate)
        } else {
            toast.error(result.error)
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        load()
    }, [load])

    const totals = useMemo(() => {
        const fixedUsd = items.reduce((sum, item) => sum + (Number(item.monthly_usd) || 0), 0)
        const aiUsd = (overview?.aiCostMonthUsdCents ?? 0) / 100
        const totalUsd = fixedUsd + aiUsd
        const mrrCop = overview?.mrr.find((entry) => entry.currency === "COP")?.amount ?? 0
        const mrrUsd = rate > 0 ? mrrCop / rate : 0
        const otherMrr = (overview?.mrr ?? []).filter((entry) => entry.currency !== "COP")
        const marginUsd = mrrUsd + otherMrr.reduce((sum, entry) => sum + entry.amount, 0) - totalUsd
        return { fixedUsd, aiUsd, totalUsd, mrrCop, mrrUsd, otherMrr, marginUsd }
    }, [items, overview, rate])

    const updateItem = (id: string, patch: Partial<OperatingCostItem>) =>
        setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item))

    const addItem = () =>
        setItems((prev) => [...prev, { id: `item-${Date.now()}`, name: "", monthly_usd: 0, notes: "" }])

    const removeItem = (id: string) =>
        setItems((prev) => prev.filter((item) => item.id !== id))

    const handleSave = async () => {
        const cleaned = items
            .map((item) => ({ ...item, name: item.name.trim(), monthly_usd: Number(item.monthly_usd) || 0 }))
            .filter((item) => item.name.length > 0)
        setSaving(true)
        try {
            const result = await saveOperatingCosts({ items: cleaned, usd_to_cop_rate: rate })
            if (result.success) {
                toast.success("Costos guardados")
                setItems(cleaned)
            } else {
                toast.error(result.error)
            }
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <div className="p-6 text-slate-500">Cargando costos operativos...</div>
    }

    return (
        <div className="space-y-6 p-6 max-w-4xl">
            <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5">
                    <DollarSign className="h-5 w-5 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Costos Operativos</h1>
                    <p className="text-slate-500">Cuánto cuesta operar LandingChat vs. cuánto factura</p>
                </div>
            </div>

            {/* Resumen */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Costo total / mes</CardDescription>
                        <CardTitle className="text-2xl">{formatUsd(totals.totalUsd)}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-slate-500">
                        {formatUsd(totals.fixedUsd)} fijos (manual) + {formatUsd(totals.aiUsd)} AI del mes (medido)
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>MRR (suscripciones activas)</CardDescription>
                        <CardTitle className="text-2xl">{formatCop(totals.mrrCop)}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-slate-500">
                        ≈ {formatUsd(totals.mrrUsd)} (TRM {rate.toLocaleString("es-CO")})
                        {overview && overview.trialingCount > 0 && ` · ${overview.trialingCount} en trial`}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Margen operativo / mes</CardDescription>
                        <CardTitle className={`text-2xl ${totals.marginUsd >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {formatUsd(totals.marginUsd)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-slate-500">
                        MRR convertido − costos totales
                    </CardContent>
                </Card>
            </div>

            {/* Costo AI medido */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        Costo AI del mes corriente
                        <Badge className="bg-blue-100 text-blue-800">medido</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                    {formatUsd(totals.aiUsd)} en {overview?.aiEventsMonth.toLocaleString("es-CO")} llamadas a Claude
                    (telemetría real de <code className="text-xs">ai_usage_events</code> — detalle en Consumo IA).
                </CardContent>
            </Card>

            {/* Costos fijos manuales */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        Costos fijos mensuales
                        <Badge variant="outline">manual</Badge>
                    </CardTitle>
                    <CardDescription>
                        Vercel, Supabase, VPS de Evolution, dominios, Upstash... (no exponen APIs de facturación — actualiza cuando cambie la factura)
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {items.map((item) => (
                        <div key={item.id} className="flex gap-2 items-center">
                            <Input
                                value={item.name}
                                onChange={(event) => updateItem(item.id, { name: event.target.value })}
                                placeholder="Proveedor (ej: Vercel Pro)"
                                className="flex-1"
                            />
                            <div className="relative w-32">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={item.monthly_usd}
                                    onChange={(event) => updateItem(item.id, { monthly_usd: Number(event.target.value) })}
                                    className="pl-7 font-mono"
                                />
                            </div>
                            <Input
                                value={item.notes ?? ""}
                                onChange={(event) => updateItem(item.id, { notes: event.target.value })}
                                placeholder="Notas"
                                className="flex-1 hidden sm:block"
                            />
                            <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}>
                                <Trash2 className="h-4 w-4 text-slate-400" />
                            </Button>
                        </div>
                    ))}

                    <div className="flex items-center justify-between pt-2">
                        <Button variant="outline" size="sm" onClick={addItem}>
                            <Plus className="h-4 w-4 mr-1" /> Agregar costo
                        </Button>
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-500">TRM USD→COP</span>
                            <Input
                                type="number"
                                min={1000}
                                value={rate}
                                onChange={(event) => setRate(Number(event.target.value))}
                                className="w-24 font-mono"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "Guardando..." : "Guardar"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
