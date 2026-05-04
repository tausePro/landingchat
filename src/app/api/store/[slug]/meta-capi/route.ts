import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { sendMetaCapiEvent, type MetaCapiEventName } from "@/lib/analytics/meta-conversions-api"
import { logger } from "@/lib/logger"
import { getClientIdentifier, getRateLimitHeaders, storeApiRateLimit } from "@/lib/rate-limit"
import { createServiceClient } from "@/lib/supabase/server"

const log = logger("api/store/meta-capi")

const metaCapiEventSchema = z.object({
    eventName: z.enum(["ViewContent", "AddToCart", "InitiateCheckout", "Purchase"]),
    eventId: z.string().min(8).max(160),
    eventSourceUrl: z.string().url().optional(),
    fbc: z.string().min(1).max(500).optional(),
    fbp: z.string().min(1).max(500).optional(),
    customData: z.object({
        currency: z.string().min(3).max(3).default("COP"),
        value: z.number().nonnegative().default(0),
        contentIds: z.array(z.string().min(1).max(200)).max(100).optional(),
        contents: z.array(z.object({
            id: z.string().min(1).max(200),
            quantity: z.number().int().positive(),
            item_price: z.number().nonnegative().optional(),
        })).max(100).optional(),
        contentType: z.string().min(1).max(50).default("product"),
        orderId: z.string().min(1).max(200).optional(),
        numItems: z.number().int().nonnegative().optional(),
    }),
})

interface TrackingConfigForMetaCapi {
    meta_pixel_id?: string
    meta_capi_access_token?: string
    meta_access_token?: string
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params
    const clientId = getClientIdentifier(request)
    const rateLimitResult = await storeApiRateLimit.limit(`${clientId}:meta-capi:${slug}`)
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

    const validation = metaCapiEventSchema.safeParse(payload)
    if (!validation.success) {
        return NextResponse.json(
            { error: validation.error.issues[0]?.message || "Payload inválido" },
            { status: 400, headers }
        )
    }

    const supabase = createServiceClient()
    const { data: org } = await supabase
        .from("organizations")
        .select("tracking_config")
        .eq("slug", slug)
        .single()

    const trackingConfig = org?.tracking_config as TrackingConfigForMetaCapi | null
    const capiAccessToken = trackingConfig?.meta_capi_access_token || trackingConfig?.meta_access_token

    if (!trackingConfig?.meta_pixel_id || !capiAccessToken) {
        return NextResponse.json({ success: true, skipped: true }, { headers })
    }

    const eventSourceUrl = validation.data.eventSourceUrl || request.headers.get("referer") || undefined
    const clientIpAddress = clientId === "anonymous" ? undefined : clientId
    const result = await sendMetaCapiEvent(
        {
            pixelId: trackingConfig.meta_pixel_id,
            accessToken: capiAccessToken,
        },
        {
            eventName: validation.data.eventName as MetaCapiEventName,
            eventId: validation.data.eventId,
            eventTime: Math.floor(Date.now() / 1000),
            eventSourceUrl,
            userData: {
                clientIpAddress,
                clientUserAgent: request.headers.get("user-agent") || undefined,
                fbc: validation.data.fbc,
                fbp: validation.data.fbp,
            },
            customData: validation.data.customData,
        }
    )

    if (!result.success) {
        log.warn("Meta CAPI funnel event failed", {
            slug,
            eventName: validation.data.eventName,
            error: result.error,
        })
        return NextResponse.json({ success: false, error: result.error }, { status: 502, headers })
    }

    return NextResponse.json({ success: true }, { headers })
}
