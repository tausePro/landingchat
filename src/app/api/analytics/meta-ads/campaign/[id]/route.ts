import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createEmptyCampaignInsight, getCampaigns, getCampaignInsights, getCampaignDailyInsights, getCampaignAdSets, getCampaignAds, getAdCreatives, type MetaDatePreset } from "@/lib/analytics/meta-marketing-api"

interface OrderAttributionRow {
    id: string
    total: number | string | null
    status: string | null
    payment_status: string | null
    utm_data: Record<string, unknown> | null
    created_at: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getStringValue(record: Record<string, unknown> | null, key: string) {
    const value = record?.[key]
    return typeof value === "string" && value.length > 0 ? value : undefined
}

function toNumber(value: number | string | null) {
    if (typeof value === "number") return value
    if (typeof value === "string") {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
}

function matchesCampaignAttribution(order: OrderAttributionRow, campaignId: string, campaignName?: string) {
    const utmData = isRecord(order.utm_data) ? order.utm_data : null
    const campaignIdValue =
        getStringValue(utmData, "campaign_id") ||
        getStringValue(utmData, "campaignId") ||
        getStringValue(utmData, "utm_campaign_id") ||
        getStringValue(utmData, "utmCampaignId")
    const utmCampaign =
        getStringValue(utmData, "utm_campaign") ||
        getStringValue(utmData, "utmCampaign")

    return campaignIdValue === campaignId || utmCampaign === campaignId || Boolean(campaignName && utmCampaign === campaignName)
}

async function getMetaConfig(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", userId)
        .single()

    if (!profile?.organization_id) return null

    const { data: org } = await supabase
        .from("organizations")
        .select("tracking_config")
        .eq("id", profile.organization_id)
        .single()

    const trackingConfig = org?.tracking_config as {
        meta_access_token?: string
        meta_marketing_access_token?: string
        meta_ad_account_id?: string
    } | null
    const marketingAccessToken = trackingConfig?.meta_marketing_access_token || trackingConfig?.meta_access_token

    if (!marketingAccessToken || !trackingConfig?.meta_ad_account_id) return null

    return {
        organizationId: profile.organization_id,
        accessToken: marketingAccessToken,
        adAccountId: trackingConfig.meta_ad_account_id,
    }
}

async function getRealCampaignCommerce(
    supabase: Awaited<ReturnType<typeof createClient>>,
    organizationId: string,
    campaignId: string,
    campaignName: string | undefined,
    dateOptions: { dateStart?: string; dateEnd?: string; datePreset?: MetaDatePreset }
) {
    const end = dateOptions.dateEnd ? new Date(`${dateOptions.dateEnd}T23:59:59.999-05:00`) : new Date()
    const start = dateOptions.dateStart ? new Date(`${dateOptions.dateStart}T00:00:00.000-05:00`) : new Date(end)

    if (!dateOptions.dateStart) {
        const presetDays: Partial<Record<MetaDatePreset, number>> = {
            today: 0,
            yesterday: 1,
            last_7d: 7,
            last_14d: 14,
            last_30d: 30,
            last_90d: 90,
            this_week: 7,
            this_month: 31,
            last_month: 31,
        }
        start.setDate(end.getDate() - (presetDays[dateOptions.datePreset || "last_30d"] ?? 30))
    }

    const { data } = await supabase
        .from("orders")
        .select("id, total, status, payment_status, utm_data, created_at")
        .eq("organization_id", organizationId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())

    const attributedOrders = ((data || []) as OrderAttributionRow[])
        .filter((order) => matchesCampaignAttribution(order, campaignId, campaignName))

    const paidOrders = attributedOrders.filter((order) => order.payment_status === "paid")
    const pendingOrders = attributedOrders.filter((order) => order.payment_status === "pending" || order.status === "pending")
    const failedOrders = attributedOrders.filter((order) =>
        order.payment_status === "failed" ||
        order.status === "cancelled" ||
        order.status === "canceled"
    )

    return {
        paidOrders: paidOrders.length,
        paidRevenue: paidOrders.reduce((sum, order) => sum + toNumber(order.total), 0),
        pendingOrders: pendingOrders.length,
        failedOrders: failedOrders.length,
        attributedOrders: attributedOrders.length,
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const config = await getMetaConfig(supabase, user.id)
        if (!config) {
            return NextResponse.json({ error: "Meta Ads not configured", configured: false }, { status: 400 })
        }

        const { id: campaignId } = await params
        const searchParams = request.nextUrl.searchParams
        const datePreset = searchParams.get("date_preset") || "last_30d"
        const dateStart = searchParams.get("date_start") || undefined
        const dateEnd = searchParams.get("date_end") || undefined

        const typedPreset = datePreset as MetaDatePreset
        const dateOptions = dateStart && dateEnd ? { dateStart, dateEnd } : { datePreset: typedPreset }

        // Obtener datos en paralelo
        const [campaignsResult, summaryResult, dailyResult, adSetsResult, adsResult] = await Promise.all([
            getCampaigns(config),
            getCampaignInsights(config, { ...dateOptions, campaignIds: [campaignId] }),
            getCampaignDailyInsights(config, campaignId, dateOptions),
            getCampaignAdSets(config, campaignId, dateOptions),
            getCampaignAds(config, campaignId, dateOptions),
        ])

        // Buscar info básica de la campaña
        const campaign = campaignsResult.data?.find((c) => c.id === campaignId) || null
        const summary = summaryResult.data?.[0] || (campaign ? createEmptyCampaignInsight(campaign, { dateStart, dateEnd }) : null)
        const rawAds = adsResult.data || []

        // Enriquecer ads con creativos via Batch API (1 sola request)
        let adsWithCreatives = rawAds
        if (rawAds.length > 0) {
            const adIds = rawAds.map((a) => a.ad_id)
            const creativeMap = await getAdCreatives(config.accessToken, adIds, config.adAccountId)
            adsWithCreatives = rawAds.map((ad) => ({
                ...ad,
                ...creativeMap[ad.ad_id],
            }))
        }

        const realCommerce = await getRealCampaignCommerce(
            supabase,
            config.organizationId,
            campaignId,
            campaign?.name || summary?.campaign_name,
            dateOptions
        )

        return NextResponse.json({
            success: true,
            data: {
                campaign,
                summary,
                daily: dailyResult.data || [],
                adSets: adSetsResult.data || [],
                ads: adsWithCreatives,
                realCommerce: {
                    ...realCommerce,
                    realRoas: summary?.spend ? realCommerce.paidRevenue / summary.spend : null,
                },
            },
        })
    } catch (error) {
        console.error("[Meta Ads Campaign Detail] Error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
