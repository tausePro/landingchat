import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getClientIdentifier, getRateLimitHeaders, storeApiRateLimit } from "@/lib/rate-limit"
import { createServiceClient } from "@/lib/supabase/server"

const analyticsEventNameSchema = z.enum([
    "page_view",
    "view_content",
    "add_to_cart",
    "cart_opened",
    "cart_item_removed",
    "cart_quantity_changed",
    "cart_coupon_applied",
    "cart_coupon_failed",
    "checkout_started",
    "checkout_contact_submitted",
    "checkout_contact_validation_failed",
    "checkout_shipping_unavailable",
    "checkout_payment_method_selected",
    "checkout_order_created",
    "checkout_order_create_failed",
    "checkout_payment_redirect_started",
    "checkout_payment_instructions_shown",
    "checkout_gateway_load_failed",
    "payment_pending",
    "payment_failed",
    "payment_retry_clicked",
    "purchase",
])

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
}).strict()

const analyticsPropertiesSchema = z.object({
    contentName: z.string().min(1).max(200).optional(),
    paymentMethod: z.enum(["wompi", "epayco", "manual", "contraentrega", "cash_on_delivery"]).optional(),
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
        return NextResponse.json({ error: "No se pudo registrar el evento" }, { status: 500, headers })
    }

    return NextResponse.json({ success: true }, { headers })
}
