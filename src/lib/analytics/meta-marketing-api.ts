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

export interface MetaCampaign {
    id: string
    name: string
    status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'
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
    actions?: Array<{
        action_type: string
        value: string
    }>
    date_start: string
    date_stop: string
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
        datePreset?: 'today' | 'yesterday' | 'this_week' | 'last_7d' | 'last_14d' | 'last_30d' | 'this_month' | 'last_month'
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
        const insights: MetaCampaignInsights[] = (result.data || []).map((item: any) => ({
            campaign_id: item.campaign_id,
            campaign_name: item.campaign_name,
            impressions: parseInt(item.impressions || '0'),
            clicks: parseInt(item.clicks || '0'),
            spend: parseFloat(item.spend || '0'),
            reach: parseInt(item.reach || '0'),
            cpc: parseFloat(item.cpc || '0'),
            cpm: parseFloat(item.cpm || '0'),
            ctr: parseFloat(item.ctr || '0'),
            actions: item.actions,
            date_start: item.date_start,
            date_stop: item.date_stop,
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
        datePreset?: string
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
            const conversions = actions
                .filter((a) => ['purchase', 'complete_registration', 'lead'].includes(a.action_type))
                .reduce((sum, a) => sum + parseInt(a.value || '0'), 0)
            return {
                date: item.date_start as string,
                impressions: parseInt((item.impressions as string) || '0'),
                clicks: parseInt((item.clicks as string) || '0'),
                spend: parseFloat((item.spend as string) || '0'),
                reach: parseInt((item.reach as string) || '0'),
                cpc: parseFloat((item.cpc as string) || '0'),
                cpm: parseFloat((item.cpm as string) || '0'),
                ctr: parseFloat((item.ctr as string) || '0'),
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
        datePreset?: string
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
            const conversions = actions
                .filter((a) => ['purchase', 'complete_registration', 'lead'].includes(a.action_type))
                .reduce((sum, a) => sum + parseInt(a.value || '0'), 0)
            return {
                adset_id: item.adset_id as string,
                adset_name: item.adset_name as string,
                impressions: parseInt((item.impressions as string) || '0'),
                clicks: parseInt((item.clicks as string) || '0'),
                spend: parseFloat((item.spend as string) || '0'),
                reach: parseInt((item.reach as string) || '0'),
                cpc: parseFloat((item.cpc as string) || '0'),
                ctr: parseFloat((item.ctr as string) || '0'),
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
        datePreset?: string
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
            const conversions = actions
                .filter((a) => ['purchase', 'complete_registration', 'lead'].includes(a.action_type))
                .reduce((sum, a) => sum + parseInt(a.value || '0'), 0)
            return {
                ad_id: item.ad_id as string,
                ad_name: item.ad_name as string,
                adset_name: item.adset_name as string,
                impressions: parseInt((item.impressions as string) || '0'),
                clicks: parseInt((item.clicks as string) || '0'),
                spend: parseFloat((item.spend as string) || '0'),
                reach: parseInt((item.reach as string) || '0'),
                cpc: parseFloat((item.cpc as string) || '0'),
                ctr: parseFloat((item.ctr as string) || '0'),
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
    datePreset: string = 'last_7d',
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
        : { datePreset: datePreset as any }
    const insightsResult = await getCampaignInsights(config, insightOptions)
    
    if (!insightsResult.success || !insightsResult.data) {
        return { success: false, error: insightsResult.error }
    }

    const campaigns = insightsResult.data
    
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
