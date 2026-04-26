/**
 * Meta Marketing API - Lectura de campañas y métricas
 * https://developers.facebook.com/docs/marketing-api/insights
 * 
 * Permite obtener datos de campañas publicitarias de Meta Ads
 * para mostrar en el dashboard de analytics.
 */

export interface MetaAdAccount {
    id: string
    name: string
    currency: string
    account_status: number
}

type MetaCampaignStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'
export type MetaDatePreset = 'today' | 'yesterday' | 'this_week' | 'last_7d' | 'last_14d' | 'last_30d' | 'last_90d' | 'this_month' | 'last_month'
type MetaAction = {
    action_type: string
    value: string
}

export interface MetaCampaign {
    id: string
    name: string
    status: MetaCampaignStatus
    objective: string
    created_time: string
    updated_time: string
}

export interface MetaCampaignInsights {
    campaign_id: string
    campaign_name: string
    impressions: number
    clicks: number
    spend: number
    reach: number
    cpc: number
    cpm: number
    ctr: number
    actions?: MetaAction[]
    date_start: string
    date_stop: string
    campaign_status?: MetaCampaignStatus
    objective?: string
    created_time?: string
    updated_time?: string
}

export interface MetaDailyInsight {
    date: string // YYYY-MM-DD
    impressions: number
    clicks: number
    spend: number
    reach: number
    cpc: number
    cpm: number
    ctr: number
    conversions: number
}

export interface MetaAdSet {
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

export interface MetaAd {
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
    // Campos de creativo (obtenidos via Batch API)
    thumbnail_url?: string  // preview baja resolución (video)
    image_url?: string      // imagen full-res (image ads)
    creative_title?: string
    creative_body?: string
    call_to_action?: string
}

export interface MetaAdsConfig {
    accessToken: string
    adAccountId: string // Format: act_XXXXXXXXX
}

const META_API_VERSION = 'v22.0'
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`

interface MetaCampaignInsightApiItem {
    campaign_id?: string
    campaign_name?: string
    impressions?: string
    clicks?: string
    spend?: string
    reach?: string
    cpc?: string
    cpm?: string
    ctr?: string
    actions?: MetaAction[]
    date_start?: string
    date_stop?: string
}

const parseIntegerMetric = (value: string | undefined) => parseInt(value || '0')
const parseDecimalMetric = (value: string | undefined) => parseFloat(value || '0')

export function isMetaConversionAction(actionType: string): boolean {
    const normalized = actionType.toLowerCase()
    return normalized.includes('purchase') || normalized.includes('lead') || normalized.includes('complete_registration')
}

function sumConversionActions(actions: MetaAction[] | undefined): number {
    return (actions || [])
        .filter((action) => isMetaConversionAction(action.action_type))
        .reduce((sum, action) => sum + parseIntegerMetric(action.value), 0)
}

export function createEmptyCampaignInsight(
    campaign: MetaCampaign,
    dates: { dateStart?: string; dateEnd?: string } = {}
): MetaCampaignInsights {
    return {
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        impressions: 0,
        clicks: 0,
        spend: 0,
        reach: 0,
        cpc: 0,
        cpm: 0,
        ctr: 0,
        actions: [],
        date_start: dates.dateStart || '',
        date_stop: dates.dateEnd || '',
        campaign_status: campaign.status,
        objective: campaign.objective,
        created_time: campaign.created_time,
        updated_time: campaign.updated_time,
    }
}

function mergeCampaignMetadata(insight: MetaCampaignInsights, campaign: MetaCampaign): MetaCampaignInsights {
    return {
        ...insight,
        campaign_name: insight.campaign_name || campaign.name,
        campaign_status: campaign.status,
        objective: campaign.objective,
        created_time: campaign.created_time,
        updated_time: campaign.updated_time,
    }
}

/**
 * Obtiene las cuentas publicitarias del usuario
 */
export async function getAdAccounts(accessToken: string): Promise<{
    success: boolean
    data?: MetaAdAccount[]
    error?: string
}> {
    try {
        const url = `${META_API_BASE}/me/adaccounts?fields=id,name,currency,account_status&access_token=${accessToken}`
        
        const response = await fetch(url)
        const result = await response.json()

        if (!response.ok || result.error) {
            return { 
                success: false, 
                error: result.error?.message || 'Error fetching ad accounts' 
            }
        }

        return { success: true, data: result.data }
    } catch (error) {
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
        }
    }
}

/**
 * Obtiene las campañas de una cuenta publicitaria
 */
export async function getCampaigns(config: MetaAdsConfig): Promise<{
    success: boolean
    data?: MetaCampaign[]
    error?: string
}> {
    try {
        const { accessToken, adAccountId } = config
        const url = `${META_API_BASE}/${adAccountId}/campaigns?fields=id,name,status,objective,created_time,updated_time&access_token=${accessToken}`
        
        const response = await fetch(url)
        const result = await response.json()

        if (!response.ok || result.error) {
            return { 
                success: false, 
                error: result.error?.message || 'Error fetching campaigns' 
            }
        }

        return { success: true, data: result.data }
    } catch (error) {
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
        }
    }
}

/**
 * Obtiene insights (métricas) de campañas
 */
export async function getCampaignInsights(
    config: MetaAdsConfig,
    options?: {
        datePreset?: MetaDatePreset
        dateStart?: string // YYYY-MM-DD
        dateEnd?: string   // YYYY-MM-DD
        campaignIds?: string[]
    }
): Promise<{
    success: boolean
    data?: MetaCampaignInsights[]
    error?: string
}> {
    try {
        const { accessToken, adAccountId } = config
        const { datePreset = 'last_7d', dateStart, dateEnd, campaignIds } = options || {}

        // Construir filtros de fecha
        let timeRange = ''
        if (dateStart && dateEnd) {
            timeRange = `&time_range={'since':'${dateStart}','until':'${dateEnd}'}`
        } else {
            timeRange = `&date_preset=${datePreset}`
        }

        // Filtrar por campañas específicas si se proporcionan
        let filtering = ''
        if (campaignIds && campaignIds.length > 0) {
            filtering = `&filtering=[{"field":"campaign.id","operator":"IN","value":${JSON.stringify(campaignIds)}}]`
        }

        const fields = 'campaign_id,campaign_name,impressions,clicks,spend,reach,cpc,cpm,ctr,actions'
        const url = `${META_API_BASE}/${adAccountId}/insights?fields=${fields}&level=campaign${timeRange}${filtering}&access_token=${accessToken}`
        
        const response = await fetch(url)
        const result = await response.json()

        if (!response.ok || result.error) {
            return { 
                success: false, 
                error: result.error?.message || 'Error fetching insights' 
            }
        }

        // Transformar datos
        const insights: MetaCampaignInsights[] = ((result.data || []) as MetaCampaignInsightApiItem[]).map((item) => ({
            campaign_id: item.campaign_id || '',
            campaign_name: item.campaign_name || '',
            impressions: parseIntegerMetric(item.impressions),
            clicks: parseIntegerMetric(item.clicks),
            spend: parseDecimalMetric(item.spend),
            reach: parseIntegerMetric(item.reach),
            cpc: parseDecimalMetric(item.cpc),
            cpm: parseDecimalMetric(item.cpm),
            ctr: parseDecimalMetric(item.ctr),
            actions: item.actions,
            date_start: item.date_start || '',
            date_stop: item.date_stop || '',
        }))

        return { success: true, data: insights }
    } catch (error) {
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
        }
    }
}

/**
 * Obtiene insights diarios de una campaña específica (para gráficos de tendencia)
 */
export async function getCampaignDailyInsights(
    config: MetaAdsConfig,
    campaignId: string,
    options?: {
        datePreset?: MetaDatePreset
        dateStart?: string
        dateEnd?: string
    }
): Promise<{
    success: boolean
    data?: MetaDailyInsight[]
    error?: string
}> {
    try {
        const { accessToken, adAccountId } = config
        const { datePreset = 'last_30d', dateStart, dateEnd } = options || {}

        let timeRange = ''
        if (dateStart && dateEnd) {
            timeRange = `&time_range={'since':'${dateStart}','until':'${dateEnd}'}`
        } else {
            timeRange = `&date_preset=${datePreset}`
        }

        const filtering = `&filtering=[{"field":"campaign.id","operator":"EQUAL","value":"${campaignId}"}]`
        const fields = 'impressions,clicks,spend,reach,cpc,cpm,ctr,actions,date_start,date_stop'
        const url = `${META_API_BASE}/${adAccountId}/insights?fields=${fields}&level=campaign&time_increment=1${timeRange}${filtering}&access_token=${accessToken}`

        const response = await fetch(url)
        const result = await response.json()

        if (!response.ok || result.error) {
            return { success: false, error: result.error?.message || 'Error fetching daily insights' }
        }

        const data: MetaDailyInsight[] = (result.data || []).map((item: Record<string, string | Array<{action_type: string, value: string}>>) => {
            const actions = (item.actions as Array<{action_type: string, value: string}> | undefined) || []
            const conversions = sumConversionActions(actions)
            return {
                date: item.date_start as string,
                impressions: parseIntegerMetric(item.impressions as string | undefined),
                clicks: parseIntegerMetric(item.clicks as string | undefined),
                spend: parseDecimalMetric(item.spend as string | undefined),
                reach: parseIntegerMetric(item.reach as string | undefined),
                cpc: parseDecimalMetric(item.cpc as string | undefined),
                cpm: parseDecimalMetric(item.cpm as string | undefined),
                ctr: parseDecimalMetric(item.ctr as string | undefined),
                conversions,
            }
        })

        return { success: true, data: data.sort((a, b) => a.date.localeCompare(b.date)) }
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
}

/**
 * Obtiene los ad sets de una campaña con sus métricas
 */
export async function getCampaignAdSets(
    config: MetaAdsConfig,
    campaignId: string,
    options?: {
        datePreset?: MetaDatePreset
        dateStart?: string
        dateEnd?: string
    }
): Promise<{
    success: boolean
    data?: MetaAdSet[]
    error?: string
}> {
    try {
        const { accessToken, adAccountId } = config
        const { datePreset = 'last_30d', dateStart, dateEnd } = options || {}

        let timeRange = ''
        if (dateStart && dateEnd) {
            timeRange = `&time_range={'since':'${dateStart}','until':'${dateEnd}'}`
        } else {
            timeRange = `&date_preset=${datePreset}`
        }

        const filtering = `&filtering=[{"field":"campaign.id","operator":"EQUAL","value":"${campaignId}"}]`
        const fields = 'adset_id,adset_name,impressions,clicks,spend,reach,cpc,ctr,actions'
        const url = `${META_API_BASE}/${adAccountId}/insights?fields=${fields}&level=adset${timeRange}${filtering}&access_token=${accessToken}`

        const response = await fetch(url)
        const result = await response.json()

        if (!response.ok || result.error) {
            return { success: false, error: result.error?.message || 'Error fetching ad sets' }
        }

        const data: MetaAdSet[] = (result.data || []).map((item: Record<string, string | Array<{action_type: string, value: string}>>) => {
            const actions = (item.actions as Array<{action_type: string, value: string}> | undefined) || []
            const conversions = sumConversionActions(actions)
            return {
                adset_id: item.adset_id as string,
                adset_name: item.adset_name as string,
                impressions: parseIntegerMetric(item.impressions as string | undefined),
                clicks: parseIntegerMetric(item.clicks as string | undefined),
                spend: parseDecimalMetric(item.spend as string | undefined),
                reach: parseIntegerMetric(item.reach as string | undefined),
                cpc: parseDecimalMetric(item.cpc as string | undefined),
                ctr: parseDecimalMetric(item.ctr as string | undefined),
                conversions,
            }
        })

        return { success: true, data: data.sort((a, b) => b.spend - a.spend) }
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
}

/**
 * Obtiene los anuncios (creativos) de una campaña con sus métricas
 */
export async function getCampaignAds(
    config: MetaAdsConfig,
    campaignId: string,
    options?: {
        datePreset?: MetaDatePreset
        dateStart?: string
        dateEnd?: string
    }
): Promise<{
    success: boolean
    data?: MetaAd[]
    error?: string
}> {
    try {
        const { accessToken, adAccountId } = config
        const { datePreset = 'last_30d', dateStart, dateEnd } = options || {}

        let timeRange = ''
        if (dateStart && dateEnd) {
            timeRange = `&time_range={'since':'${dateStart}','until':'${dateEnd}'}`
        } else {
            timeRange = `&date_preset=${datePreset}`
        }

        const filtering = `&filtering=[{"field":"campaign.id","operator":"EQUAL","value":"${campaignId}"}]`
        const fields = 'ad_id,ad_name,adset_name,impressions,clicks,spend,reach,cpc,ctr,actions'
        const url = `${META_API_BASE}/${adAccountId}/insights?fields=${fields}&level=ad${timeRange}${filtering}&access_token=${accessToken}`

        const response = await fetch(url)
        const result = await response.json()

        if (!response.ok || result.error) {
            return { success: false, error: result.error?.message || 'Error fetching ads' }
        }

        const data: MetaAd[] = (result.data || []).map((item: Record<string, string | Array<{action_type: string, value: string}>>) => {
            const actions = (item.actions as Array<{action_type: string, value: string}> | undefined) || []
            const conversions = sumConversionActions(actions)
            return {
                ad_id: item.ad_id as string,
                ad_name: item.ad_name as string,
                adset_name: item.adset_name as string,
                impressions: parseIntegerMetric(item.impressions as string | undefined),
                clicks: parseIntegerMetric(item.clicks as string | undefined),
                spend: parseDecimalMetric(item.spend as string | undefined),
                reach: parseIntegerMetric(item.reach as string | undefined),
                cpc: parseDecimalMetric(item.cpc as string | undefined),
                ctr: parseDecimalMetric(item.ctr as string | undefined),
                conversions,
            }
        })

        return { success: true, data: data.sort((a, b) => b.spend - a.spend) }
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
}

/**
 * Obtiene datos de creativos para una lista de ads.
 * - IMG: usa image_hash → /adimages (imagen nativa, máxima resolución)
 * - VID: usa video_id → /thumbnails (frame HD)
 * Máximo 3 llamadas HTTP totales (batch x3)
 */
export async function getAdCreatives(
    accessToken: string,
    adIds: string[],
    adAccountId: string
): Promise<Record<string, { thumbnail_url?: string; image_url?: string; creative_title?: string; creative_body?: string; call_to_action?: string }>> {
    if (adIds.length === 0) return {}

    try {
        const batch = adIds.map((id) => ({
            method: 'GET',
            relative_url: `${id}?fields=creative{thumbnail_url,image_hash,video_id,title,body,call_to_action_type}`,
        }))

        const url = `${META_API_BASE}`
        const body = new URLSearchParams({
            access_token: accessToken,
            batch: JSON.stringify(batch),
            include_headers: 'false',
        })

        const response = await fetch(url, { method: 'POST', body })
        const results: Array<{ code: number; body: string }> = await response.json()

        const creativeMap: Record<string, { thumbnail_url?: string; image_url?: string; creative_title?: string; creative_body?: string; call_to_action?: string }> = {}
        const videoIdMap: Record<string, string> = {} // adId -> video_id
        const imageHashMap: Record<string, string> = {} // adId -> image_hash

        adIds.forEach((adId, i) => {
            const item = results[i]
            if (!item || item.code !== 200) return
            try {
                const parsed = JSON.parse(item.body) as {
                    id: string
                    creative?: {
                        thumbnail_url?: string
                        image_hash?: string
                        video_id?: string
                        title?: string
                        body?: string
                        call_to_action_type?: string
                        id: string
                    }
                }
                if (parsed.creative) {
                    creativeMap[adId] = {
                        thumbnail_url: parsed.creative.thumbnail_url,
                        image_url: undefined,
                        creative_title: parsed.creative.title,
                        creative_body: parsed.creative.body,
                        call_to_action: parsed.creative.call_to_action_type,
                    }
                    if (parsed.creative.video_id) {
                        videoIdMap[adId] = parsed.creative.video_id
                    } else if (parsed.creative.image_hash) {
                        imageHashMap[adId] = parsed.creative.image_hash
                    }
                }
            } catch {
                // ignorar si falla el parse de un item individual
            }
        })

        // Segunda llamada: imagen nativa via /adimages (máxima resolución)
        const imageAdIds = Object.keys(imageHashMap)
        if (imageAdIds.length > 0) {
            try {
                const hashes = imageAdIds.map((id) => imageHashMap[id])
                const hashesParam = JSON.stringify(hashes)
                const imgResponse = await fetch(
                    `${META_API_BASE}/${adAccountId}/adimages?hashes=${encodeURIComponent(hashesParam)}&fields=hash,url&access_token=${accessToken}`
                )
                const imgData = await imgResponse.json() as {
                    data?: Array<{ hash: string; url: string }>
                }
                if (imgData.data) {
                    const hashToUrl: Record<string, string> = {}
                    imgData.data.forEach((img) => { hashToUrl[img.hash] = img.url })
                    imageAdIds.forEach((adId) => {
                        const imgUrl = hashToUrl[imageHashMap[adId]]
                        if (imgUrl && creativeMap[adId]) {
                            creativeMap[adId].image_url = imgUrl
                        }
                    })
                }
            } catch { /* ignorar errores en adimages */ }
        }

        // Tercera batch call: obtener thumbnails HD para ads con video_id
        const videoAdIds = Object.keys(videoIdMap)
        if (videoAdIds.length > 0) {
            try {
                const videoBatch = videoAdIds.map((adId) => ({
                    method: 'GET',
                    relative_url: `${videoIdMap[adId]}/thumbnails?fields=uri&limit=1`,
                }))
                const videoBody = new URLSearchParams({
                    access_token: accessToken,
                    batch: JSON.stringify(videoBatch),
                    include_headers: 'false',
                })
                const videoResponse = await fetch(url, { method: 'POST', body: videoBody })
                const videoResults: Array<{ code: number; body: string }> = await videoResponse.json()

                videoAdIds.forEach((adId, i) => {
                    const item = videoResults[i]
                    if (!item || item.code !== 200) return
                    try {
                        const parsed = JSON.parse(item.body) as { data?: Array<{ uri: string }> }
                        const hdUri = parsed.data?.[0]?.uri
                        if (hdUri && creativeMap[adId]) {
                            creativeMap[adId].thumbnail_url = hdUri
                        }
                    } catch { /* ignorar */ }
                })
            } catch { /* ignorar errores en batch de video */ }
        }

        return creativeMap
    } catch {
        return {}
    }
}

/**
 * Obtiene un resumen agregado de todas las campañas
 */
export async function getCampaignsSummary(
    config: MetaAdsConfig,
    datePreset: MetaDatePreset = 'last_7d',
    options?: { dateStart?: string; dateEnd?: string }
): Promise<{
    success: boolean
    data?: {
        totalSpend: number
        totalImpressions: number
        totalClicks: number
        totalReach: number
        avgCpc: number
        avgCtr: number
        campaigns: MetaCampaignInsights[]
    }
    error?: string
}> {
    const insightOptions = options?.dateStart && options?.dateEnd
        ? { dateStart: options.dateStart, dateEnd: options.dateEnd }
        : { datePreset }
    const [campaignsResult, insightsResult] = await Promise.all([
        getCampaigns(config),
        getCampaignInsights(config, insightOptions),
    ])
    
    if (!insightsResult.success || !insightsResult.data) {
        return { success: false, error: insightsResult.error }
    }

    if (!campaignsResult.success || !campaignsResult.data) {
        return { success: false, error: campaignsResult.error }
    }

    const insightsByCampaignId = new Map(
        insightsResult.data
            .filter((insight) => insight.campaign_id)
            .map((insight) => [insight.campaign_id, insight])
    )
    const campaignsById = new Map(campaignsResult.data.map((campaign) => [campaign.id, campaign]))
    const activeOrMeasuredCampaigns = campaignsResult.data
        .filter((campaign) => campaign.status === 'ACTIVE' || insightsByCampaignId.has(campaign.id))
        .map((campaign) => {
            const insight = insightsByCampaignId.get(campaign.id)
            return insight
                ? mergeCampaignMetadata(insight, campaign)
                : createEmptyCampaignInsight(campaign, options)
        })
    const insightsWithoutCampaignMetadata = insightsResult.data.filter(
        (insight) => insight.campaign_id && !campaignsById.has(insight.campaign_id)
    )
    const campaigns = [...activeOrMeasuredCampaigns, ...insightsWithoutCampaignMetadata]
        .sort((a, b) => {
            if (a.campaign_status === 'ACTIVE' && b.campaign_status !== 'ACTIVE') return -1
            if (a.campaign_status !== 'ACTIVE' && b.campaign_status === 'ACTIVE') return 1
            return b.spend - a.spend
        })
    
    const summary = {
        totalSpend: campaigns.reduce((sum, c) => sum + c.spend, 0),
        totalImpressions: campaigns.reduce((sum, c) => sum + c.impressions, 0),
        totalClicks: campaigns.reduce((sum, c) => sum + c.clicks, 0),
        totalReach: campaigns.reduce((sum, c) => sum + c.reach, 0),
        avgCpc: 0,
        avgCtr: 0,
        campaigns,
    }

    // Calcular promedios
    if (summary.totalClicks > 0) {
        summary.avgCpc = summary.totalSpend / summary.totalClicks
    }
    if (summary.totalImpressions > 0) {
        summary.avgCtr = (summary.totalClicks / summary.totalImpressions) * 100
    }

    return { success: true, data: summary }
}
