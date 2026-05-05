import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

const log = logger("api/dashboard/meta-tracking/health")

const META_API_VERSION = "v24.0"
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`

interface TrackingConfigShape {
    meta_pixel_id?: string
    meta_capi_access_token?: string
    meta_access_token?: string
    meta_marketing_access_token?: string
    meta_ad_account_id?: string
}

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

function previewToken(token: string | undefined | null): string | undefined {
    if (!token || token.length < 8) return undefined
    return `${token.slice(0, 8)}...`
}

async function pingCapiToken(token: string): Promise<ApiCheck> {
    try {
        const res = await fetch(`${META_API_BASE}/me?access_token=${token}`)
        const json = (await res.json()) as { id?: string; error?: { message?: string } }
        if (!res.ok || json.error) {
            return { ok: false, error: json.error?.message || "Token CAPI inválido" }
        }
        return { ok: true, detail: json.id ? `Token vinculado a ${json.id}` : undefined }
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Error contactando Meta" }
    }
}

async function pingPixel(pixelId: string, token: string): Promise<ApiCheck> {
    try {
        const res = await fetch(`${META_API_BASE}/${pixelId}?fields=id,name&access_token=${token}`)
        const json = (await res.json()) as { id?: string; name?: string; error?: { message?: string } }
        if (!res.ok || json.error) {
            return { ok: false, error: json.error?.message || "Pixel no accesible" }
        }
        return { ok: true, detail: json.name }
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Error contactando Meta" }
    }
}

async function pingAdAccount(adAccountId: string, token: string): Promise<ApiCheck> {
    try {
        const res = await fetch(`${META_API_BASE}/${adAccountId}?fields=id,name,account_status&access_token=${token}`)
        const json = (await res.json()) as { id?: string; name?: string; error?: { message?: string } }
        if (!res.ok || json.error) {
            return { ok: false, error: json.error?.message || "Ad Account no accesible" }
        }
        return { ok: true, detail: json.name }
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Error contactando Meta" }
    }
}

interface OrderRowForHealth {
    payment_status: string | null
    utm_data: Record<string, unknown> | null
}

function buildAttributionWindow(orders: OrderRowForHealth[]): AttributionWindow {
    let paidOrders = 0
    let ordersWithFbc = 0
    let ordersWithFbp = 0
    let ordersWithMetaUtm = 0

    for (const order of orders) {
        if (order.payment_status === "paid") paidOrders++
        const utm = order.utm_data
        if (utm && typeof utm === "object") {
            if (typeof utm.fbc === "string" && utm.fbc.length > 0) ordersWithFbc++
            if (typeof utm.fbp === "string" && utm.fbp.length > 0) ordersWithFbp++
            const source = typeof utm.utm_source === "string" ? utm.utm_source.toLowerCase() : ""
            if (source === "facebook" || source === "meta" || source === "fb" || source === "instagram" || source === "ig") {
                ordersWithMetaUtm++
            }
        }
    }

    return {
        totalOrders: orders.length,
        paidOrders,
        ordersWithFbc,
        ordersWithFbp,
        ordersWithMetaUtm,
    }
}

function buildRecommendations(report: Omit<HealthResponse, "recommendations">): string[] {
    const recs: string[] = []

    if (!report.config.metaPixelId.configured) {
        recs.push("Configurar Meta Dataset / Pixel ID en Configuración → Tracking.")
    }
    if (!report.config.metaCapiAccessToken.configured) {
        recs.push("Configurar Meta CAPI Access Token (con permiso ads_management sobre el dataset) para enviar compras server-side.")
    }
    if (report.config.metaCapiAccessToken.configured && !report.apiChecks.capiTokenValid.ok) {
        recs.push(`Token CAPI inválido o expirado: ${report.apiChecks.capiTokenValid.error || "verifica el token"}.`)
    }
    if (report.config.metaPixelId.configured && report.config.metaCapiAccessToken.configured && !report.apiChecks.pixelExists.ok) {
        recs.push(`No podemos acceder al Pixel ${report.config.metaPixelId.preview || ""}: ${report.apiChecks.pixelExists.error || "verifica permisos"}.`)
    }
    if (!report.config.metaMarketingAccessToken.configured) {
        recs.push("Configurar Meta Marketing API Token (permiso ads_read) para que el dashboard de campañas tenga datos completos.")
    }
    if (!report.config.metaAdAccountId.configured) {
        recs.push("Configurar Ad Account ID (formato act_XXXXXXXXX) para conectar la cuenta publicitaria.")
    }
    if (report.config.metaMarketingAccessToken.configured && !report.apiChecks.marketingTokenValid.ok) {
        recs.push(`Marketing API token inválido: ${report.apiChecks.marketingTokenValid.error || "verifica el token"}.`)
    }
    if (report.config.metaAdAccountId.configured && !report.apiChecks.adAccountAccessible.ok) {
        recs.push(`No podemos acceder al Ad Account: ${report.apiChecks.adAccountAccessible.error || "verifica permisos del token"}.`)
    }

    if (report.attribution.last30d.totalOrders > 0 && report.attribution.last30d.ordersWithMetaUtm === 0) {
        recs.push("0 órdenes con utm_source=meta en últimos 30 días. Agrega UTMs a las URLs de tus anuncios en Ads Manager: utm_source=meta&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}.")
    }
    if (report.attribution.last30d.totalOrders > 0 && report.attribution.last30d.ordersWithFbc === 0) {
        recs.push("0 órdenes capturaron fbc en últimos 30 días. Es posible que adblockers estén bloqueando el Pixel; el envío server-side por CAPI compensa, pero verifica que los compradores lleguen vía clic de Meta (URL con fbclid).")
    }

    return recs
}

export async function GET() {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) {
        return NextResponse.json({ error: "No organization found" }, { status: 404 })
    }

    const { data: org } = await supabase
        .from("organizations")
        .select("id, slug, name, tracking_config")
        .eq("id", profile.organization_id)
        .single()

    if (!org) {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    const trackingConfig = (org.tracking_config as TrackingConfigShape | null) ?? {}
    const capiToken = trackingConfig.meta_capi_access_token || trackingConfig.meta_access_token
    const marketingToken = trackingConfig.meta_marketing_access_token || trackingConfig.meta_access_token
    const pixelId = trackingConfig.meta_pixel_id
    const adAccountId = trackingConfig.meta_ad_account_id

    const config: HealthResponse["config"] = {
        metaPixelId: {
            configured: Boolean(pixelId),
            preview: pixelId,
        },
        metaCapiAccessToken: {
            configured: Boolean(capiToken),
            preview: previewToken(capiToken),
        },
        metaMarketingAccessToken: {
            configured: Boolean(trackingConfig.meta_marketing_access_token),
            preview: previewToken(trackingConfig.meta_marketing_access_token),
        },
        metaAdAccountId: {
            configured: Boolean(adAccountId),
            preview: adAccountId,
        },
    }

    const [capiTokenValid, pixelExists, marketingTokenValid, adAccountAccessible] = await Promise.all([
        capiToken ? pingCapiToken(capiToken) : Promise.resolve<ApiCheck>({ ok: false, error: "Token CAPI no configurado" }),
        pixelId && capiToken ? pingPixel(pixelId, capiToken) : Promise.resolve<ApiCheck>({ ok: false, error: "Falta Pixel ID o token CAPI" }),
        marketingToken ? pingCapiToken(marketingToken) : Promise.resolve<ApiCheck>({ ok: false, error: "Token Marketing API no configurado" }),
        adAccountId && marketingToken ? pingAdAccount(adAccountId, marketingToken) : Promise.resolve<ApiCheck>({ ok: false, error: "Falta Ad Account ID o token Marketing" }),
    ])

    const now = new Date()
    const last24h = new Date(now)
    last24h.setHours(last24h.getHours() - 24)
    const last30d = new Date(now)
    last30d.setDate(last30d.getDate() - 30)

    const { data: orders30d, error: ordersError } = await supabase
        .from("orders")
        .select("payment_status, utm_data, created_at")
        .eq("organization_id", org.id)
        .gte("created_at", last30d.toISOString())

    if (ordersError) {
        log.warn("Failed to read orders for tracking health", { error: ordersError.message })
    }

    const orders = (orders30d || []) as Array<OrderRowForHealth & { created_at: string }>
    const orders24h = orders.filter((order) => new Date(order.created_at) >= last24h)

    const attribution: HealthResponse["attribution"] = {
        last24h: buildAttributionWindow(orders24h),
        last30d: buildAttributionWindow(orders),
    }

    const baseReport: Omit<HealthResponse, "recommendations"> = {
        organizationId: org.id as string,
        organizationSlug: org.slug as string,
        organizationName: org.name as string,
        config,
        apiChecks: {
            capiTokenValid,
            pixelExists,
            marketingTokenValid,
            adAccountAccessible,
        },
        attribution,
    }

    const response: HealthResponse = {
        ...baseReport,
        recommendations: buildRecommendations(baseReport),
    }

    return NextResponse.json(response)
}
