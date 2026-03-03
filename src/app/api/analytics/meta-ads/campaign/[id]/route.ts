import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCampaigns, getCampaignInsights, getCampaignDailyInsights, getCampaignAdSets, getCampaignAds, getAdCreatives, MetaAdsConfig } from "@/lib/analytics/meta-marketing-api"

type DatePresetValue = 'today' | 'yesterday' | 'this_week' | 'last_7d' | 'last_14d' | 'last_30d' | 'this_month' | 'last_month'

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
        meta_ad_account_id?: string
    } | null

    if (!trackingConfig?.meta_access_token || !trackingConfig?.meta_ad_account_id) return null

    return {
        accessToken: trackingConfig.meta_access_token,
        adAccountId: trackingConfig.meta_ad_account_id,
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

        const typedPreset = datePreset as DatePresetValue
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
        const summary = summaryResult.data?.[0] || null
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

        return NextResponse.json({
            success: true,
            data: {
                campaign,
                summary,
                daily: dailyResult.data || [],
                adSets: adSetsResult.data || [],
                ads: adsWithCreatives,
            },
        })
    } catch (error) {
        console.error("[Meta Ads Campaign Detail] Error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
