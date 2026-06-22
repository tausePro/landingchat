import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getClientIdentifier, getRateLimitHeaders, storeApiRateLimit } from "@/lib/rate-limit"
import { ANALYTICS_EVENT_NAMES } from "@/lib/analytics/event-names"
import { logger } from "@/lib/logger"
import { createServiceClient } from "@/lib/supabase/server"

const log = logger("api/store/analytics-events")

const analyticsEventNameSchema = z.enum(ANALYTICS_EVENT_NAMES)

const analyticsAttributionSchema = z.object({
    capturedAt: z.string().datetime().optional(),
    utmSource: z.string().min(1).max(120).optional(),
    utmMedium: z.string().min(1).max(120).optional(),
    utmCampaign: z.string().min(1).max(200).optional(),
    utmContent: z.string().min(1).max(200).optional(),
    utmTerm: z.string().min(1).max(200).optional(),
    utmId: z.string().min(1).max(120).optional(),
    utmSourcePlatform: z.string().min(1).max(120).optional(),
    campaignId: z.string().min(1).max(120).optional(),
    adsetId: z.string().min(1).max(120).optional(),
    adId: z.string().min(1).max(120).optional(),
    fbclid: z.string().min(1).max(500).optional(),
    fbc: z.string().min(1).max(255).optional(),
    fbp: z.string().min(1).max(255).optional(),
    referrer: z.string().min(1).max(500).optional(),
    entryPoint: z.enum(["proactive_nudge"]).optional(),
    proactiveNudgeId: z.string().min(1).max(200).optional(),
    proactiveNudgeProductId: z.string().min(1).max(200).optional(),
    proactiveNudgeProductName: z.string().min(1).max(200).optional(),
    proactiveNudgeDestination: z.enum(["web_chat", "whatsapp_fallback"]).optional(),
}).strict()

const analyticsPropertiesSchema = z.object({
    contentName: z.string().min(1).max(200).optional(),
    paymentMethod: z.enum(["wompi", "epayco", "bold", "manual", "contraentrega", "cash_on_delivery"]).optional(),
    gateway: z.enum(["wompi", "epayco"]).optional(),
    couponCode: z.string().min(1).max(80).optional(),
    failureReason: z.string().min(1).max(160).optional(),
    validationField: z.string().min(1).max(80).optional(),
    step: z.string().min(1).max(80).optional(),
    itemCount: z.number().int().nonnegative().optional(),
    cartValue: z.number().nonnegative().optional(),
    shippingCost: z.number().nonnegative().optional(),
    discountAmount: z.number().nonnegative().optional(),
    quantity: z.number().int().nonnegative().optional(),
    previousQuantity: z.number().int().nonnegative().optional(),
    newQuantity: z.number().int().nonnegative().optional(),
    hasCoupon: z.boolean().optional(),
    chatId: z.string().uuid().optional(),
    entryPoint: z.enum(["proactive_nudge"]).optional(),
    proactiveNudgeId: z.string().min(1).max(200).optional(),
    proactiveNudgeProductId: z.string().min(1).max(200).optional(),
    proactiveNudgeProductName: z.string().min(1).max(200).optional(),
    placement: z.enum(["pdp", "storefront", "home"]).optional(),
    trigger: z.enum(["time_on_page", "scroll", "exit_intent"]).optional(),
    destination: z.enum(["web_chat", "whatsapp_fallback"]).optional(),
    attribution: analyticsAttributionSchema.optional(),
}).strict().default({})

const analyticsEventSchema = z.object({
    eventName: analyticsEventNameSchema,
    sessionId: z.string().min(8).max(120).optional(),
    sourceChannel: z.enum(["web", "chat", "whatsapp", "instagram", "messenger"]).optional(),
    path: z.string().min(1).max(500).optional(),
    referrer: z.string().min(1).max(500).optional(),
    contentIds: z.array(z.string().min(1).max(200)).max(100).default([]),
    orderId: z.string().uuid().optional(),
    value: z.number().nonnegative().optional(),
    currency: z.string().min(3).max(3).default("COP"),
    properties: analyticsPropertiesSchema,
    occurredAt: z.string().datetime().optional(),
})

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params
    const clientId = getClientIdentifier(request)
    const rateLimitResult = await storeApiRateLimit.limit(`${clientId}:analytics-events:${slug}`)
    const headers = getRateLimitHeaders(rateLimitResult)

    if (!rateLimitResult.success) {
        return NextResponse.json(
            { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
            { status: 429, headers }
        )
    }

    let payload: unknown
    try {
        payload = await request.json()
    } catch {
        return NextResponse.json({ error: "Payload inválido" }, { status: 400, headers })
    }

    const validation = analyticsEventSchema.safeParse(payload)
    if (!validation.success) {
        return NextResponse.json(
            { error: validation.error.issues[0]?.message || "Payload inválido" },
            { status: 400, headers }
        )
    }

    const supabase = createServiceClient()
    const { data: org } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .single()

    if (!org) {
        return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404, headers })
    }

    const event = validation.data
    if (event.orderId) {
        const { data: order } = await supabase
            .from("orders")
            .select("id")
            .eq("id", event.orderId)
            .eq("organization_id", org.id)
            .maybeSingle()

        if (!order) {
            return NextResponse.json({ error: "Orden inválida para esta tienda" }, { status: 400, headers })
        }
    }

    const { error } = await supabase
        .from("analytics_events")
        .insert({
            organization_id: org.id,
            event_name: event.eventName,
            session_id: event.sessionId ?? null,
            source_channel: event.sourceChannel ?? "web",
            path: event.path ?? request.headers.get("referer") ?? null,
            referrer: event.referrer ?? null,
            content_ids: event.contentIds,
            order_id: event.orderId ?? null,
            value: event.value ?? null,
            currency: event.currency,
            properties: event.properties,
            occurred_at: event.occurredAt ?? new Date().toISOString(),
        })

    if (error) {
        log.error("Failed to persist analytics event", {
            slug,
            orgId: org.id,
            eventName: event.eventName,
            code: error.code,
            message: error.message,
        })
        return NextResponse.json({ error: "No se pudo registrar el evento" }, { status: 500, headers })
    }

    return NextResponse.json({ success: true }, { headers })
}
