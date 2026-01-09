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
 * Obtiene un resumen agregado de todas las campañas
 */
export async function getCampaignsSummary(
    config: MetaAdsConfig,
    datePreset: string = 'last_7d'
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
    const insightsResult = await getCampaignInsights(config, { datePreset: datePreset as any })
    
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
