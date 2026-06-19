"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency as formatTenantCurrency } from "@/lib/utils"
import { useTenantCurrency, useTenantLocale } from "@/lib/i18n/use-tenant-strings"

interface CampaignInsight {
    campaign_id: string
    campaign_name: string
    campaign_status?: string
    impressions: number
    clicks: number
    spend: number
    reach: number
    cpc: number
    cpm: number
    ctr: number
    date_start: string
    date_stop: string
}

interface MetaAdsData {
    totalSpend: number
    totalImpressions: number
    totalClicks: number
    totalReach: number
    avgCpc: number
    avgCtr: number
    campaigns: CampaignInsight[]
}

type DatePreset = "last_7d" | "last_14d" | "last_30d" | "last_month" | "last_90d" | "this_month" | "custom"

const datePresetLabels: Record<Exclude<DatePreset, "custom">, string> = {
    last_7d: "7d",
    last_14d: "14d",
    last_30d: "30d",
    last_month: "Mes anterior",
    last_90d: "90d",
    this_month: "Este mes",
}

export function MetaAdsCard() {
    const router = useRouter()
    const currency = useTenantCurrency()
    const locale = useTenantLocale()
    const [data, setData] = useState<MetaAdsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [configured, setConfigured] = useState(true)
    const [datePreset, setDatePreset] = useState<DatePreset>("last_30d")
    const [customStart, setCustomStart] = useState("")
    const [customEnd, setCustomEnd] = useState("")
    const [appliedCustomStart, setAppliedCustomStart] = useState("")
    const [appliedCustomEnd, setAppliedCustomEnd] = useState("")
    const [showCustom, setShowCustom] = useState(false)
    const [dateLabel, setDateLabel] = useState("30d")

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            setError(null)
            try {
                let url = `/api/analytics/meta-ads?date_preset=${datePreset}`
                if (datePreset === "custom" && appliedCustomStart && appliedCustomEnd) {
                    url = `/api/analytics/meta-ads?date_start=${appliedCustomStart}&date_end=${appliedCustomEnd}`
                }
                const res = await fetch(url)
                const json = await res.json()

                if (!res.ok) {
                    if (json.configured === false) {
                        setConfigured(false)
                        return
                    }
                    setError(json.error || "Error al obtener datos")
                    return
                }

                setConfigured(true)
                setData(json.data)
            } catch {
                setError("Error de conexión")
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [datePreset, appliedCustomStart, appliedCustomEnd])

    function handlePreset(preset: Exclude<DatePreset, "custom">) {
        setShowCustom(false)
        setDatePreset(preset)
        setDateLabel(datePresetLabels[preset])
    }

    function handleCustomApply() {
        if (customStart && customEnd) {
            setAppliedCustomStart(customStart)
            setAppliedCustomEnd(customEnd)
            setDatePreset("custom")
            setDateLabel(`${customStart} → ${customEnd}`)
        }
    }

    // Gasto de Meta Ads en la moneda del tenant (aproximacion: la moneda real de la
    // cuenta de ads aun no se propaga a este nivel).
    const formatCurrency = (amount: number) => formatTenantCurrency(amount, { currency, locale })

    const formatNumber = (n: number) =>
        new Intl.NumberFormat("es-CO").format(n)

    const sortedCampaigns = [...(data?.campaigns || [])].sort((a, b) => {
        if (a.campaign_status === "ACTIVE" && b.campaign_status !== "ACTIVE") return -1
        if (a.campaign_status !== "ACTIVE" && b.campaign_status === "ACTIVE") return 1
        return b.spend - a.spend
    })

    // Estado: No configurado
    if (!configured) {
        return (
            <Card className="relative overflow-hidden">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-500">campaign</span>
                        Meta Ads
                    </CardTitle>
                    <CardDescription>Conecta tu cuenta publicitaria para ver métricas</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <span className="material-symbols-outlined text-5xl mb-3 block text-blue-300">link_off</span>
                        <p className="font-medium">Meta Ads no configurado</p>
                        <p className="text-sm mt-2 max-w-md mx-auto">
                            Para ver tus campañas, configura tu <strong>Meta Marketing API Token</strong> y{" "}
                            <strong>Ad Account ID</strong> en Configuración &gt; Tracking.
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Estado: Cargando
    if (loading) {
        return (
            <Card className="relative overflow-hidden">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-500">campaign</span>
                        Meta Ads
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="animate-pulse space-y-2">
                                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-28" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Estado: Error
    if (error) {
        return (
            <Card className="relative overflow-hidden">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-500">campaign</span>
                        Meta Ads
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-6 text-muted-foreground">
                        <span className="material-symbols-outlined text-3xl mb-2 block text-red-400">error</span>
                        <p className="text-sm">{error}</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Estado: Sin datos
    if (!data || data.campaigns.length === 0) {
        return (
            <Card className="relative overflow-hidden">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-500">campaign</span>
                            Meta Ads
                        </CardTitle>
                        <div className="flex items-center gap-1 flex-wrap">
                            {(Object.keys(datePresetLabels) as Exclude<DatePreset, "custom">[]).map((preset) => (
                                <button
                                    key={preset}
                                    onClick={() => handlePreset(preset)}
                                    className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                                        datePreset === preset && !showCustom
                                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium"
                                            : "text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800"
                                    }`}
                                >
                                    {datePresetLabels[preset]}
                                </button>
                            ))}
                            <button
                                onClick={() => setShowCustom(!showCustom)}
                                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                                    showCustom || datePreset === "custom"
                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium"
                                        : "text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800"
                                }`}
                            >
                                <span className="material-symbols-outlined text-sm align-middle">date_range</span>
                            </button>
                        </div>
                    </div>
                    <CardDescription>Sin campañas disponibles</CardDescription>
                    {showCustom && (
                        <div className="flex items-center gap-2 mt-2">
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="px-2 py-1 text-xs border rounded-md bg-background"
                            />
                            <span className="text-xs text-muted-foreground">a</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="px-2 py-1 text-xs border rounded-md bg-background"
                            />
                            <button
                                onClick={handleCustomApply}
                                disabled={!customStart || !customEnd}
                                className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Aplicar
                            </button>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <span className="material-symbols-outlined text-4xl mb-2 block">info</span>
                        <p className="text-sm">No se encontraron campañas para el período: {dateLabel}.</p>
                        <p className="text-xs mt-1">Si hay campañas activas en Meta, revisa el token de Marketing API y el Ad Account ID.</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Estado: Con datos
    const kpis = [
        { label: "Inversión", value: formatCurrency(data.totalSpend), icon: "payments", color: "text-red-500" },
        { label: "Impresiones", value: formatNumber(data.totalImpressions), icon: "visibility", color: "text-blue-500" },
        { label: "Clics", value: formatNumber(data.totalClicks), icon: "ads_click", color: "text-green-500" },
        { label: "Alcance", value: formatNumber(data.totalReach), icon: "group", color: "text-purple-500" },
        { label: "CPC", value: formatCurrency(data.avgCpc), icon: "touch_app", color: "text-orange-500" },
        { label: "CTR", value: `${data.avgCtr.toFixed(2)}%`, icon: "percent", color: "text-teal-500" },
    ]

    return (
        <Card className="relative overflow-hidden">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-500">campaign</span>
                        Meta Ads
                    </CardTitle>
                    <div className="flex items-center gap-1 flex-wrap">
                        {(Object.keys(datePresetLabels) as Exclude<DatePreset, "custom">[]).map((preset) => (
                            <button
                                key={preset}
                                onClick={() => handlePreset(preset)}
                                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                                    datePreset === preset && !showCustom
                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium"
                                        : "text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800"
                                }`}
                            >
                                {datePresetLabels[preset]}
                            </button>
                        ))}
                        <button
                            onClick={() => setShowCustom(!showCustom)}
                            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                                showCustom || datePreset === "custom"
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium"
                                    : "text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800"
                            }`}
                        >
                            <span className="material-symbols-outlined text-sm align-middle">date_range</span>
                        </button>
                    </div>
                </div>
                <CardDescription>
                    Rendimiento de campañas — {dateLabel}
                </CardDescription>
                {showCustom && (
                    <div className="flex items-center gap-2 mt-2">
                        <input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="px-2 py-1 text-xs border rounded-md bg-background"
                        />
                        <span className="text-xs text-muted-foreground">a</span>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="px-2 py-1 text-xs border rounded-md bg-background"
                        />
                        <button
                            onClick={handleCustomApply}
                            disabled={!customStart || !customEnd}
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Aplicar
                        </button>
                    </div>
                )}
            </CardHeader>
            <CardContent className="space-y-6">
                {/* KPIs Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {kpis.map((kpi) => (
                        <div key={kpi.label} className="space-y-1">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <span className={`material-symbols-outlined text-base ${kpi.color}`}>{kpi.icon}</span>
                                <span className="text-xs">{kpi.label}</span>
                            </div>
                            <p className="text-lg font-semibold">{kpi.value}</p>
                        </div>
                    ))}
                </div>

                {/* Campaigns Table */}
                {data.campaigns.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-3">
                            Campañas ({data.campaigns.length})
                        </h4>
                        <div className="space-y-2">
                            {sortedCampaigns.map((campaign) => (
                                    <div
                                        key={campaign.campaign_id}
                                        onClick={() => router.push(`/dashboard/analytics/campaign/${campaign.campaign_id}`)}
                                        className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium truncate">{campaign.campaign_name}</p>
                                                {campaign.campaign_status === "ACTIVE" && (
                                                    <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                        Activa
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                                                <span>{formatCurrency(campaign.spend)}</span>
                                                <span>{formatNumber(campaign.impressions)} imp.</span>
                                                <span>{formatNumber(campaign.clicks)} clics</span>
                                                <span>{campaign.ctr.toFixed(2)}% CTR</span>
                                            </div>
                                        </div>
                                        {/* Spend bar relative to total */}
                                        <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 rounded-full"
                                                style={{
                                                    width: `${data.totalSpend > 0 ? (campaign.spend / data.totalSpend) * 100 : 0}%`,
                                                }}
                                            />
                                        </div>
                                        <span className="material-symbols-outlined text-base text-muted-foreground">chevron_right</span>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
