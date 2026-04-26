"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import ReactMarkdown from "react-markdown"
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatBogotaDayKey, formatBogotaDateLong, formatBogotaTime } from "@/lib/utils/date"

interface DailyInsight {
    date: string
    impressions: number
    clicks: number
    spend: number
    reach: number
    cpc: number
    cpm: number
    ctr: number
    conversions: number
}

interface AdSet {
    adset_id: string
    adset_name: string
    impressions: number
    clicks: number
    spend: number
    reach: number
    cpc: number
    ctr: number
    conversions: number
}

interface Ad {
    ad_id: string
    ad_name: string
    adset_name: string
    impressions: number
    clicks: number
    spend: number
    reach: number
    cpc: number
    ctr: number
    conversions: number
    thumbnail_url?: string
    image_url?: string
    creative_title?: string
    creative_body?: string
    call_to_action?: string
}

interface CampaignSummary {
    campaign_id: string
    campaign_name: string
    impressions: number
    clicks: number
    spend: number
    reach: number
    cpc: number
    cpm: number
    ctr: number
    actions?: Array<{ action_type: string; value: string }>
}

interface Campaign {
    id: string
    name: string
    status: string
    objective: string
    created_time: string
    updated_time: string
}

interface CampaignDetailData {
    campaign: Campaign | null
    summary: CampaignSummary | null
    daily: DailyInsight[]
    adSets: AdSet[]
    ads: Ad[]
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

const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    PAUSED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    DELETED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    ARCHIVED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

const objectiveLabels: Record<string, string> = {
    OUTCOME_TRAFFIC: "Tráfico",
    OUTCOME_AWARENESS: "Reconocimiento",
    OUTCOME_ENGAGEMENT: "Interacción",
    OUTCOME_LEADS: "Clientes potenciales",
    OUTCOME_SALES: "Ventas",
    OUTCOME_APP_PROMOTION: "Promoción de app",
    LINK_CLICKS: "Clics en enlace",
    REACH: "Alcance",
    BRAND_AWARENESS: "Reconocimiento de marca",
    CONVERSIONS: "Conversiones",
    LEAD_GENERATION: "Generación de leads",
    PAGE_LIKES: "Likes de página",
    POST_ENGAGEMENT: "Interacción con publicación",
    VIDEO_VIEWS: "Vistas de video",
}

function isMetaConversionAction(actionType: string): boolean {
    const normalized = actionType.toLowerCase()
    return normalized.includes("purchase") || normalized.includes("lead") || normalized.includes("complete_registration")
}

export function CampaignDetailView({ campaignId }: { campaignId: string }) {
    const router = useRouter()
    const [data, setData] = useState<CampaignDetailData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [datePreset, setDatePreset] = useState<DatePreset>("last_30d")
    const [customStart, setCustomStart] = useState("")
    const [customEnd, setCustomEnd] = useState("")
    const [showCustom, setShowCustom] = useState(false)
    const [activeMetric, setActiveMetric] = useState<"spend" | "impressions" | "clicks">("spend")
    const [aiAnalysis, setAiAnalysis] = useState<string>("")
    const [aiGeneratedAt, setAiGeneratedAt] = useState<string | null>(null)
    const [aiLoading, setAiLoading] = useState(false)
    const [aiError, setAiError] = useState<string | null>(null)
    const [aiDone, setAiDone] = useState(false)

    const analyzeWithAI = useCallback(async () => {
        if (!data) return
        setAiLoading(true)
        setAiError(null)
        setAiAnalysis("")
        setAiDone(false)

        const dateRange =
            datePreset === "custom" && customStart && customEnd
                ? `${customStart} al ${customEnd}`
                : `Últimos ${datePreset.replace("last_", "").replace("d", " días").replace("_month", " mes")}`

        const conversions = data.summary?.actions
            ?.filter((a) => isMetaConversionAction(a.action_type))
            .reduce((sum, a) => sum + parseInt(a.value || "0"), 0) || 0

        try {
            const res = await fetch(`/api/analytics/meta-ads/campaign/${campaignId}/ai-analysis?date_preset=${datePreset}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    campaign: data.campaign,
                    summary: { ...data.summary, cpm: data.summary?.cpm || 0, conversions },
                    adSets: data.adSets,
                    ads: data.ads,
                    dateRange,
                }),
            })

            if (!res.ok || !res.body) {
                setAiError("No se pudo generar el análisis")
                return
            }

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                setAiAnalysis((prev) => prev + decoder.decode(value, { stream: true }))
            }
            setAiDone(true)
            setAiGeneratedAt(new Date().toISOString())
        } catch {
            setAiError("Error de conexión al analizar")
        } finally {
            setAiLoading(false)
        }
    }, [data, campaignId, datePreset, customStart, customEnd])

    // Cargar análisis guardado cuando los datos de la campaña estén listos
    const loadSavedAnalysis = useCallback(async () => {
        try {
            const res = await fetch(
                `/api/analytics/meta-ads/campaign/${campaignId}/ai-analysis?date_preset=${datePreset}`
            )
            const json = await res.json() as { analysis: string | null; generated_at?: string }
            if (json.analysis) {
                setAiAnalysis(json.analysis)
                setAiGeneratedAt(json.generated_at || null)
                setAiDone(true)
            } else {
                setAiAnalysis("")
                setAiGeneratedAt(null)
                setAiDone(false)
            }
        } catch { /* ignorar */ }
    }, [campaignId, datePreset])

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            let url = `/api/analytics/meta-ads/campaign/${campaignId}?date_preset=${datePreset}`
            if (datePreset === "custom" && customStart && customEnd) {
                url = `/api/analytics/meta-ads/campaign/${campaignId}?date_start=${customStart}&date_end=${customEnd}`
            }
            const res = await fetch(url)
            const json = await res.json()
            if (!res.ok) {
                setError(json.error || "Error al obtener datos")
                return
            }
            setData(json.data)
        } catch {
            setError("Error de conexión")
        } finally {
            setLoading(false)
        }
    }, [campaignId, datePreset, customStart, customEnd])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    useEffect(() => {
        loadSavedAnalysis()
    }, [loadSavedAnalysis])

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(amount)

    const formatNumber = (n: number) => new Intl.NumberFormat("es-CO").format(n)

    // El endpoint Meta Ads devuelve fechas como "2026-04-21" (day only); al
    // concatenar "T00:00:00" y pasar por new Date(), el server las interpreta
    // como hora local del server (UTC en Vercel) y eso mueve 5h en el chart.
    // formatBogotaDayKey ya formatea en hora Colombia.
    const formatDate = (dateStr: string) => formatBogotaDayKey(dateStr + "T00:00:00")

    const totalConversions = data?.summary?.actions
        ?.filter((a) => isMetaConversionAction(a.action_type))
        .reduce((sum, a) => sum + parseInt(a.value || "0"), 0) || 0

    const chartData = data?.daily.map((d) => ({
        date: formatDate(d.date),
        Inversión: d.spend,
        Impresiones: d.impressions,
        Clics: d.clicks,
    })) || []

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-72" />
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                    ))}
                </div>
                <div className="h-72 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="text-center py-16">
                <span className="material-symbols-outlined text-5xl text-red-400 mb-3 block">error</span>
                <p className="font-medium text-lg">{error}</p>
                <button onClick={() => router.back()} className="mt-4 text-sm text-blue-600 hover:underline">
                    ← Volver a Analytics
                </button>
            </div>
        )
    }

    const campaign = data?.campaign
    const summary = data?.summary

    const kpis = [
        { label: "Inversión", value: formatCurrency(summary?.spend || 0), icon: "payments", color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/20" },
        { label: "Impresiones", value: formatNumber(summary?.impressions || 0), icon: "visibility", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/20" },
        { label: "Clics", value: formatNumber(summary?.clicks || 0), icon: "ads_click", color: "text-green-500", bg: "bg-green-50 dark:bg-green-950/20" },
        { label: "Alcance", value: formatNumber(summary?.reach || 0), icon: "group", color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/20" },
        { label: "CPC", value: formatCurrency(summary?.cpc || 0), icon: "touch_app", color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/20" },
        { label: "CTR", value: `${(summary?.ctr || 0).toFixed(2)}%`, icon: "percent", color: "text-teal-500", bg: "bg-teal-50 dark:bg-teal-950/20" },
        { label: "CPM", value: formatCurrency(summary?.cpm || 0), icon: "bar_chart", color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950/20" },
        { label: "Conversiones", value: formatNumber(totalConversions), icon: "check_circle", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
    ]

    const metricConfig = {
        spend: { key: "Inversión", color: "#ef4444", label: "Inversión (COP)" },
        impressions: { key: "Impresiones", color: "#3b82f6", label: "Impresiones" },
        clicks: { key: "Clics", color: "#22c55e", label: "Clics" },
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
                    >
                        <span className="material-symbols-outlined text-base">arrow_back</span>
                        Analytics
                    </button>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl font-bold">
                            {campaign?.name || data?.summary?.campaign_name || "Campaña"}
                        </h1>
                        {campaign?.status && (
                            <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${statusColors[campaign.status] || statusColors.ARCHIVED}`}>
                                {campaign.status}
                            </span>
                        )}
                        {campaign?.objective && (
                            <Badge variant="outline" className="text-xs">
                                {objectiveLabels[campaign.objective] || campaign.objective}
                            </Badge>
                        )}
                    </div>
                    {campaign?.created_time && (
                        <p className="text-sm text-muted-foreground mt-1">
                            Creada {formatBogotaDateLong(campaign.created_time)}
                        </p>
                    )}
                </div>

                {/* Acciones: Analizar con IA + Date selector */}
                <div className="flex flex-col items-end gap-2">
                    <button
                        onClick={analyzeWithAI}
                        disabled={aiLoading || !data}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        {aiLoading ? (
                            <>
                                <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                Analizando...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-base">auto_awesome</span>
                                Analizar con IA
                            </>
                        )}
                    </button>
                <div className="flex items-center gap-1 flex-wrap justify-end">
                    {(Object.keys(datePresetLabels) as Exclude<DatePreset, "custom">[]).map((preset) => (
                        <button
                            key={preset}
                            onClick={() => { setShowCustom(false); setDatePreset(preset) }}
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
                    {showCustom && (
                        <div className="flex items-center gap-2 w-full mt-1">
                            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                                className="px-2 py-1 text-xs border rounded-md bg-background" />
                            <span className="text-xs text-muted-foreground">a</span>
                            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                                className="px-2 py-1 text-xs border rounded-md bg-background" />
                            <button
                                onClick={() => { if (customStart && customEnd) { setDatePreset("custom"); setShowCustom(false); fetchData() } }}
                                disabled={!customStart || !customEnd}
                                className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                                Aplicar
                            </button>
                        </div>
                    )}
                </div>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                {kpis.map((kpi) => (
                    <Card key={kpi.label} className="border-0 shadow-sm">
                        <CardContent className={`p-4 rounded-lg ${kpi.bg}`}>
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                                <span className={`material-symbols-outlined text-base ${kpi.color}`}>{kpi.icon}</span>
                                <span className="text-xs">{kpi.label}</span>
                            </div>
                            <p className="text-xl font-bold">{kpi.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Análisis IA */}
            {(aiAnalysis || aiLoading || aiError) && (
                <Card className="border-purple-200 dark:border-purple-800/50 bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between w-full">
                            <CardTitle className="text-base flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg text-purple-500">auto_awesome</span>
                                Análisis IA
                                {aiLoading && (
                                    <span className="inline-block w-3 h-3 border-2 border-purple-400/40 border-t-purple-500 rounded-full animate-spin ml-1" />
                                )}
                            </CardTitle>
                            <div className="flex items-center gap-3">
                                {aiGeneratedAt && !aiLoading && (
                                    <span className="text-xs text-muted-foreground">
                                        Generado {formatBogotaDayKey(aiGeneratedAt)} · {formatBogotaTime(aiGeneratedAt)}
                                    </span>
                                )}
                                {aiDone && !aiLoading && (
                                    <button
                                        onClick={analyzeWithAI}
                                        className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-sm">refresh</span>
                                        Actualizar
                                    </button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {aiError ? (
                            <p className="text-sm text-red-500">{aiError}</p>
                        ) : (
                            <div className="prose prose-sm dark:prose-invert max-w-none
                                prose-headings:text-foreground prose-headings:font-semibold prose-headings:text-sm prose-headings:mt-4 prose-headings:mb-2
                                prose-p:text-muted-foreground prose-p:text-sm prose-p:leading-relaxed
                                prose-ul:text-muted-foreground prose-ul:text-sm prose-li:my-0.5
                                prose-strong:text-foreground">
                                <ReactMarkdown>{aiAnalysis || "Generando análisis..."}</ReactMarkdown>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Trend Chart */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base">Rendimiento diario</CardTitle>
                            <CardDescription>
                                {chartData.length > 0 ? `${chartData.length} días con datos` : "Sin datos en el período"}
                            </CardDescription>
                        </div>
                        <div className="flex gap-1">
                            {(["spend", "impressions", "clicks"] as const).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setActiveMetric(m)}
                                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                                        activeMetric === m
                                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium"
                                            : "text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800"
                                    }`}
                                >
                                    {{ spend: "Inversión", impressions: "Impresiones", clicks: "Clics" }[m]}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {chartData.length === 0 ? (
                        <div className="flex items-center justify-center h-48 text-muted-foreground">
                            <div className="text-center">
                                <span className="material-symbols-outlined text-4xl mb-2 block">bar_chart</span>
                                <p className="text-sm">Sin datos diarios para este período</p>
                            </div>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    tick={{ fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) =>
                                        activeMetric === "spend"
                                            ? `$${(v / 1000).toFixed(0)}k`
                                            : formatNumber(v)
                                    }
                                    width={55}
                                />
                                <Tooltip
                                    formatter={(value: number) =>
                                        activeMetric === "spend"
                                            ? [formatCurrency(value), metricConfig[activeMetric].label]
                                            : [formatNumber(value), metricConfig[activeMetric].label]
                                    }
                                    contentStyle={{
                                        borderRadius: "8px",
                                        fontSize: "12px",
                                        border: "1px solid hsl(var(--border))",
                                        background: "hsl(var(--card))",
                                        color: "hsl(var(--card-foreground))",
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey={metricConfig[activeMetric].key}
                                    stroke={metricConfig[activeMetric].color}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {/* Ad Sets Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg text-blue-500">layers</span>
                        Conjuntos de anuncios
                        {data?.adSets.length ? (
                            <span className="ml-1 px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded-full text-muted-foreground">
                                {data.adSets.length}
                            </span>
                        ) : null}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {!data?.adSets.length ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <span className="material-symbols-outlined text-4xl mb-2 block">layers_clear</span>
                            <p className="text-sm">No se encontraron conjuntos de anuncios con datos en este período</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-xs text-muted-foreground">
                                        <th className="text-left py-2 pr-4 font-medium">Conjunto de anuncios</th>
                                        <th className="text-right py-2 pr-4 font-medium">Inversión</th>
                                        <th className="text-right py-2 pr-4 font-medium">Impresiones</th>
                                        <th className="text-right py-2 pr-4 font-medium">Clics</th>
                                        <th className="text-right py-2 pr-4 font-medium">CTR</th>
                                        <th className="text-right py-2 pr-4 font-medium">CPC</th>
                                        <th className="text-right py-2 font-medium">Conversiones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {data.adSets.map((adset) => (
                                        <tr key={adset.adset_id} className="hover:bg-muted/30 transition-colors">
                                            <td className="py-3 pr-4">
                                                <p className="font-medium truncate max-w-[260px]" title={adset.adset_name}>
                                                    {adset.adset_name}
                                                </p>
                                            </td>
                                            <td className="py-3 pr-4 text-right tabular-nums">{formatCurrency(adset.spend)}</td>
                                            <td className="py-3 pr-4 text-right tabular-nums">{formatNumber(adset.impressions)}</td>
                                            <td className="py-3 pr-4 text-right tabular-nums">{formatNumber(adset.clicks)}</td>
                                            <td className="py-3 pr-4 text-right tabular-nums">{adset.ctr.toFixed(2)}%</td>
                                            <td className="py-3 pr-4 text-right tabular-nums">{formatCurrency(adset.cpc)}</td>
                                            <td className="py-3 text-right tabular-nums">
                                                {adset.conversions > 0 ? (
                                                    <span className="text-emerald-600 font-medium">{adset.conversions}</span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {data.adSets.length > 1 && (
                                    <tfoot>
                                        <tr className="border-t-2 font-semibold text-sm bg-muted/20">
                                            <td className="py-2 pr-4">Total</td>
                                            <td className="py-2 pr-4 text-right tabular-nums">
                                                {formatCurrency(data.adSets.reduce((s, a) => s + a.spend, 0))}
                                            </td>
                                            <td className="py-2 pr-4 text-right tabular-nums">
                                                {formatNumber(data.adSets.reduce((s, a) => s + a.impressions, 0))}
                                            </td>
                                            <td className="py-2 pr-4 text-right tabular-nums">
                                                {formatNumber(data.adSets.reduce((s, a) => s + a.clicks, 0))}
                                            </td>
                                            <td className="py-2 pr-4" />
                                            <td className="py-2 pr-4" />
                                            <td className="py-2 text-right tabular-nums text-emerald-600">
                                                {data.adSets.reduce((s, a) => s + a.conversions, 0) || "—"}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Creativos (Ads) — Grid de tarjetas con thumbnail */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg text-purple-500">image</span>
                        Creativos
                        {data?.ads.length ? (
                            <span className="ml-1 px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded-full text-muted-foreground">
                                {data.ads.length}
                            </span>
                        ) : null}
                    </CardTitle>
                    <CardDescription>Rendimiento individual de cada anuncio en este período</CardDescription>
                </CardHeader>
                <CardContent>
                    {!data?.ads.length ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <span className="material-symbols-outlined text-4xl mb-2 block">hide_image</span>
                            <p className="text-sm">No se encontraron creativos con datos en este período</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {data.ads.map((ad) => {
                                const adType = ad.ad_name.match(/^(A\d+)\s*-\s*(VID|IMG|VIDEO|IMAGE)/i)
                                const typeLabel = adType ? adType[2].toUpperCase() : null
                                const isVideo = typeLabel === 'VID' || typeLabel === 'VIDEO'
                                return (
                                    <div
                                        key={ad.ad_id}
                                        className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow"
                                    >
                                        {/* Thumbnail — usa image_url (full-res) para IMG, thumbnail_url para VID */}
                                        <div className="relative w-full aspect-square bg-gray-100 dark:bg-gray-800">
                                            {(ad.image_url || ad.thumbnail_url) ? (
                                                <Image
                                                    src={ad.image_url || ad.thumbnail_url!}
                                                    alt={ad.ad_name}
                                                    fill
                                                    className="object-cover"
                                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                                    unoptimized
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-full">
                                                    <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600">
                                                        {isVideo ? 'play_circle' : 'image'}
                                                    </span>
                                                </div>
                                            )}
                                            {/* Type badge */}
                                            {typeLabel && (
                                                <span className={`absolute top-2 left-2 px-1.5 py-0.5 text-xs font-bold rounded ${
                                                    isVideo
                                                        ? 'bg-purple-600 text-white'
                                                        : 'bg-blue-600 text-white'
                                                }`}>
                                                    {isVideo ? '▶ VID' : '🖼 IMG'}
                                                </span>
                                            )}
                                            {/* Spend badge */}
                                            <span className="absolute top-2 right-2 px-1.5 py-0.5 text-xs font-semibold bg-black/70 text-white rounded">
                                                {formatCurrency(ad.spend)}
                                            </span>
                                        </div>

                                        {/* Info */}
                                        <div className="p-3 space-y-2">
                                            <div>
                                                <p className="text-sm font-semibold leading-tight line-clamp-2" title={ad.creative_title || ad.ad_name}>
                                                    {ad.creative_title || ad.ad_name}
                                                </p>
                                                {ad.creative_body && (
                                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ad.creative_body}</p>
                                                )}
                                                <p className="text-xs text-muted-foreground mt-0.5 truncate" title={ad.adset_name}>
                                                    {ad.adset_name}
                                                </p>
                                            </div>

                                            {/* Metrics */}
                                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 border-t">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Impresiones</p>
                                                    <p className="text-sm font-medium">{formatNumber(ad.impressions)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Clics</p>
                                                    <p className="text-sm font-medium">{formatNumber(ad.clicks)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">CTR</p>
                                                    <p className="text-sm font-medium">{ad.ctr.toFixed(2)}%</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">CPC</p>
                                                    <p className="text-sm font-medium">{formatCurrency(ad.cpc)}</p>
                                                </div>
                                            </div>

                                            {/* CTA + Conversiones */}
                                            <div className="flex items-center justify-between pt-1">
                                                {ad.call_to_action ? (
                                                    <span className="px-2 py-0.5 text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800">
                                                        {ad.call_to_action.replace(/_/g, ' ')}
                                                    </span>
                                                ) : <span />}
                                                {ad.conversions > 0 && (
                                                    <span className="text-xs text-emerald-600 font-semibold">
                                                        ✓ {ad.conversions} conv.
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
