"use client"

import { useEffect, useState } from "react"

interface ConfigCheck {
    configured: boolean
    preview?: string
}

interface ApiCheck {
    ok: boolean
    error?: string
    detail?: string
}

interface AttributionWindow {
    totalOrders: number
    paidOrders: number
    ordersWithFbc: number
    ordersWithFbp: number
    ordersWithMetaUtm: number
}

interface HealthResponse {
    organizationId: string
    organizationSlug: string
    organizationName: string
    config: {
        metaPixelId: ConfigCheck
        metaCapiAccessToken: ConfigCheck
        metaMarketingAccessToken: ConfigCheck
        metaAdAccountId: ConfigCheck
    }
    apiChecks: {
        capiTokenValid: ApiCheck
        pixelExists: ApiCheck
        marketingTokenValid: ApiCheck
        adAccountAccessible: ApiCheck
    }
    attribution: {
        last24h: AttributionWindow
        last30d: AttributionWindow
    }
    recommendations: string[]
}

function StatusDot({ ok }: { ok: boolean }) {
    return (
        <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`}
            aria-hidden="true"
        />
    )
}

function ConfigRow({
    label,
    check,
    description,
}: {
    label: string
    check: ConfigCheck
    description?: string
}) {
    return (
        <div className="flex items-start justify-between gap-3 py-2">
            <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                    <StatusDot ok={check.configured} />
                    <span className="text-sm font-medium">{label}</span>
                </div>
                {description && (
                    <p className="text-xs text-muted-foreground">{description}</p>
                )}
            </div>
            <div className="text-xs text-right text-muted-foreground font-mono">
                {check.configured ? check.preview || "configurado" : "no configurado"}
            </div>
        </div>
    )
}

function ApiRow({ label, check }: { label: string; check: ApiCheck }) {
    return (
        <div className="flex items-start justify-between gap-3 py-2">
            <div className="flex items-center gap-2">
                <StatusDot ok={check.ok} />
                <span className="text-sm font-medium">{label}</span>
            </div>
            <div className="text-xs text-right max-w-[60%]">
                {check.ok ? (
                    <span className="text-green-600 dark:text-green-400">
                        {check.detail || "OK"}
                    </span>
                ) : (
                    <span className="text-red-600 dark:text-red-400">
                        {check.error || "Error"}
                    </span>
                )}
            </div>
        </div>
    )
}

function AttributionWindowRow({
    label,
    window,
}: {
    label: string
    window: AttributionWindow
}) {
    return (
        <div className="rounded-md border border-border-light dark:border-border-dark p-3 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {label}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">Total órdenes</span>
                <span className="text-right font-mono">{window.totalOrders}</span>
                <span className="text-muted-foreground">Pagadas</span>
                <span className="text-right font-mono">{window.paidOrders}</span>
                <span className="text-muted-foreground">Con fbc</span>
                <span className="text-right font-mono">{window.ordersWithFbc}</span>
                <span className="text-muted-foreground">Con fbp</span>
                <span className="text-right font-mono">{window.ordersWithFbp}</span>
                <span className="text-muted-foreground">Con UTM Meta</span>
                <span className="text-right font-mono">{window.ordersWithMetaUtm}</span>
            </div>
        </div>
    )
}

export function MetaTrackingHealthCard() {
    const [data, setData] = useState<HealthResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function fetchHealth() {
            setLoading(true)
            setError(null)
            try {
                const res = await fetch("/api/dashboard/meta-tracking/health")
                if (!res.ok) {
                    const json = (await res.json().catch(() => ({}))) as { error?: string }
                    setError(json.error || `Error ${res.status}`)
                    return
                }
                const json = (await res.json()) as HealthResponse
                setData(json)
            } catch (err) {
                setError(err instanceof Error ? err.message : "Error de conexión")
            } finally {
                setLoading(false)
            }
        }
        fetchHealth()
    }, [])

    if (loading) {
        return (
            <div className="rounded-md border border-border-light dark:border-border-dark p-4 space-y-2">
                <p className="text-sm font-semibold">Salud del tracking de Meta</p>
                <p className="text-xs text-muted-foreground">Verificando configuración…</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 p-4 space-y-1">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                    No pudimos verificar la salud del tracking
                </p>
                <p className="text-xs text-red-600 dark:text-red-300">{error}</p>
            </div>
        )
    }

    if (!data) return null

    const allConfigured =
        data.config.metaPixelId.configured &&
        data.config.metaCapiAccessToken.configured &&
        data.config.metaMarketingAccessToken.configured &&
        data.config.metaAdAccountId.configured
    const allApiOk =
        data.apiChecks.capiTokenValid.ok &&
        data.apiChecks.pixelExists.ok &&
        data.apiChecks.marketingTokenValid.ok &&
        data.apiChecks.adAccountAccessible.ok
    const overallOk = allConfigured && allApiOk && data.recommendations.length === 0

    return (
        <div className="rounded-md border border-border-light dark:border-border-dark overflow-hidden">
            <div
                className={`px-4 py-3 border-b border-border-light dark:border-border-dark ${
                    overallOk
                        ? "bg-green-50 dark:bg-green-900/10"
                        : "bg-amber-50 dark:bg-amber-900/10"
                }`}
            >
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <p className="text-sm font-semibold">Salud del tracking de Meta</p>
                        <p className="text-xs text-muted-foreground">
                            Diagnóstico de la configuración para {data.organizationName}
                        </p>
                    </div>
                    <span
                        className={`px-2 py-1 rounded-full text-[10px] font-medium ${
                            overallOk
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}
                    >
                        {overallOk ? "Todo en orden" : "Requiere atención"}
                    </span>
                </div>
            </div>

            <div className="p-4 space-y-4">
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Configuración
                    </p>
                    <div className="divide-y divide-border-light dark:divide-border-dark">
                        <ConfigRow
                            label="Meta Dataset / Pixel ID"
                            check={data.config.metaPixelId}
                            description="Necesario para Pixel browser-side y CAPI server-side."
                        />
                        <ConfigRow
                            label="CAPI Access Token"
                            check={data.config.metaCapiAccessToken}
                            description="Envío de Purchase y eventos del funnel server-side."
                        />
                        <ConfigRow
                            label="Marketing API Token"
                            check={data.config.metaMarketingAccessToken}
                            description="Lectura de campañas, conjuntos, anuncios y métricas."
                        />
                        <ConfigRow
                            label="Ad Account ID"
                            check={data.config.metaAdAccountId}
                            description="Cuenta publicitaria conectada al dashboard."
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Verificación contra Meta
                    </p>
                    <div className="divide-y divide-border-light dark:divide-border-dark">
                        <ApiRow label="Token CAPI válido" check={data.apiChecks.capiTokenValid} />
                        <ApiRow label="Pixel accesible" check={data.apiChecks.pixelExists} />
                        <ApiRow
                            label="Token Marketing válido"
                            check={data.apiChecks.marketingTokenValid}
                        />
                        <ApiRow
                            label="Ad Account accesible"
                            check={data.apiChecks.adAccountAccessible}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Atribución de órdenes
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <AttributionWindowRow label="Últimas 24h" window={data.attribution.last24h} />
                        <AttributionWindowRow label="Últimos 30 días" window={data.attribution.last30d} />
                    </div>
                </div>

                {data.recommendations.length > 0 && (
                    <div className="space-y-2 pt-2">
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                            Recomendaciones
                        </p>
                        <ul className="text-xs space-y-1.5 list-disc list-inside text-amber-800 dark:text-amber-300">
                            {data.recommendations.map((rec, i) => (
                                <li key={i}>{rec}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    )
}
