import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const BENCHMARKS = `
Benchmarks e-commerce LATAM (referencia):
- CTR promedio: 0.9% - 1.5% (bueno: >2%, excelente: >3%)
- CPC promedio Colombia: $300 - $800 COP
- CPM promedio: $3.000 - $8.000 COP
- Tasa de conversión esperada: 1% - 3%
- ROAS mínimo viable: 3x
`

function buildPrompt(data: CampaignAnalysisInput): string {
    const { campaign, summary, adSets, ads, dateRange } = data

    const topAds = [...(ads || [])].sort((a, b) => b.spend - a.spend).slice(0, 6)

    return `Eres un experto en Meta Ads especializado en e-commerce latinoamericano. Analiza los siguientes datos de campaña y da sugerencias accionables y directas en español. Sé conciso y práctico.

${BENCHMARKS}

CAMPAÑA: ${campaign?.name || summary?.campaign_name || 'Sin nombre'}
Estado: ${campaign?.status || 'Desconocido'}
Objetivo: ${campaign?.objective || 'No especificado'}
Período: ${dateRange}

MÉTRICAS GLOBALES:
- Inversión total: $${summary?.spend?.toLocaleString('es-CO') || 0} COP
- Impresiones: ${summary?.impressions?.toLocaleString('es-CO') || 0}
- Clics: ${summary?.clicks?.toLocaleString('es-CO') || 0}
- Alcance: ${summary?.reach?.toLocaleString('es-CO') || 0}
- CTR: ${summary?.ctr?.toFixed(2) || 0}%
- CPC: $${summary?.cpc?.toLocaleString('es-CO') || 0} COP
- CPM: $${summary?.cpm?.toFixed(0) || 0} COP
- Conversiones: ${summary?.conversions || 0}

CONJUNTOS DE ANUNCIOS (${adSets?.length || 0}):
${(adSets || []).map((a) =>
    `- ${a.adset_name}: $${a.spend?.toLocaleString('es-CO')} | ${a.impressions?.toLocaleString()} imp | CTR ${a.ctr?.toFixed(2)}% | CPC $${a.cpc?.toLocaleString('es-CO')}`
).join('\n') || 'Sin datos'}

CREATIVOS TOP (por inversión):
${topAds.map((ad) =>
    `- ${ad.ad_name}: $${ad.spend?.toLocaleString('es-CO')} | ${ad.impressions?.toLocaleString()} imp | ${ad.clicks} clics | CTR ${ad.ctr?.toFixed(2)}% | CPC $${ad.cpc?.toLocaleString('es-CO')}${ad.conversions ? ` | ${ad.conversions} conv.` : ''}`
).join('\n') || 'Sin datos'}

Responde con estas secciones usando markdown:

## 🎯 Diagnóstico general
(2-3 oraciones sobre el estado de la campaña vs benchmarks)

## ✅ Lo que está funcionando
(bullets concisos, máximo 3)

## ⚠️ Alertas y oportunidades
(bullets concisos, máximo 4, ordenados por impacto)

## 🚀 Próximos pasos recomendados
(bullets accionables y específicos, máximo 4, con números concretos cuando sea posible)

Sé directo, usa datos específicos de la campaña, no generes texto genérico.`
}

interface AdSetInput {
    adset_name: string
    spend: number
    impressions: number
    ctr: number
    cpc: number
}

interface AdInput {
    ad_name: string
    spend: number
    impressions: number
    clicks: number
    ctr: number
    cpc: number
    conversions: number
}

interface SummaryInput {
    campaign_name?: string
    spend: number
    impressions: number
    clicks: number
    reach: number
    ctr: number
    cpc: number
    cpm: number
    conversions: number
}

interface CampaignInput {
    name?: string
    status?: string
    objective?: string
}

interface CampaignAnalysisInput {
    campaign: CampaignInput | null
    summary: SummaryInput | null
    adSets: AdSetInput[]
    ads: AdInput[]
    dateRange: string
}

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()
    return profile?.organization_id ?? null
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: campaignId } = await params
    const url = new URL(_request.url)
    const datePreset = url.searchParams.get("date_preset") || "last_30d"

    try {
        const supabase = await createClient()
        const orgId = await getOrgId(supabase)
        if (!orgId) return NextResponse.json({ analysis: null })

        const { data } = await supabase
            .from("ai_campaign_analyses")
            .select("analysis_text, generated_at")
            .eq("org_id", orgId)
            .eq("campaign_id", campaignId)
            .eq("date_preset", datePreset)
            .single()

        if (!data) return NextResponse.json({ analysis: null })
        return NextResponse.json({ analysis: data.analysis_text, generated_at: data.generated_at })
    } catch {
        return NextResponse.json({ analysis: null })
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: campaignId } = await params
    const url = new URL(request.url)
    const datePreset = url.searchParams.get("date_preset") || "last_30d"

    try {
        const body = await request.json() as CampaignAnalysisInput
        const prompt = buildPrompt(body)

        const stream = await anthropic.messages.stream({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
        })

        const encoder = new TextEncoder()
        let fullText = ""

        const readable = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of stream) {
                        if (
                            chunk.type === "content_block_delta" &&
                            chunk.delta.type === "text_delta"
                        ) {
                            fullText += chunk.delta.text
                            controller.enqueue(encoder.encode(chunk.delta.text))
                        }
                    }
                    controller.close()

                    // Guardar en Supabase en background (no bloquea el stream)
                    try {
                        const supabase = await createClient()
                        const orgId = await getOrgId(supabase)
                        if (orgId) {
                            await supabase
                                .from("ai_campaign_analyses")
                                .upsert(
                                    {
                                        org_id: orgId,
                                        campaign_id: campaignId,
                                        date_preset: datePreset,
                                        analysis_text: fullText,
                                        generated_at: new Date().toISOString(),
                                    },
                                    { onConflict: "org_id,campaign_id,date_preset" }
                                )
                        }
                    } catch { /* no bloquear stream si falla el guardado */ }
                } catch (err) {
                    controller.error(err)
                }
            },
        })

        return new Response(readable, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Transfer-Encoding": "chunked",
                "Cache-Control": "no-cache",
            },
        })
    } catch (error) {
        console.error("[AI Campaign Analysis] Error:", error)
        return new Response(
            JSON.stringify({ error: "Error al generar análisis" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        )
    }
}
