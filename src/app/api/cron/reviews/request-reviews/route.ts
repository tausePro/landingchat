import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { buildReviewToken } from "@/lib/reviews/token"
import {
    resolveReviewRequestConfig,
    REVIEW_REQUEST_MAX_AGE_DAYS,
} from "@/lib/reviews/request-config"
import { buildStoreCanonicalUrl } from "@/lib/seo/site-discovery"
import { sendReviewRequestEmail } from "@/lib/notifications/email"
import { sendWhatsAppMessage } from "@/lib/whatsapp/provider"
import { getTenantLocale } from "@/lib/i18n/tenant-locale"
import { t } from "@/lib/i18n/storefront-strings"

export const dynamic = "force-dynamic"

const BATCH_LIMIT = 100
const DAY_MS = 24 * 60 * 60 * 1000

interface CandidateOrder {
    id: string
    organization_id: string
    customer_id: string | null
    customer_info: { name?: string; email?: string; phone?: string } | null
    payment_confirmed_at: string
}

interface OrgRow {
    id: string
    name: string
    slug: string
    custom_domain: string | null
    settings: unknown
    locale: string | null
    currency_code: string | null
    country_code: string | null
}

/**
 * Cron diario: solicita reseñas a clientes de órdenes pagadas hace
 * `delayDays` (config por tenant, opt-in en settings.reviews).
 *
 * Idempotente por orden (`review_request_sent_at`). Ventana máxima de 30
 * días hacia atrás: nunca contacta órdenes viejas (protege el primer run).
 * `createServiceClient()` justificado: cron sin sesión, organization_id
 * siempre derivado de la orden (nunca hardcodeado).
 */
export async function GET(request: Request) {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServiceClient()
    const now = Date.now()
    const maxAge = new Date(now - REVIEW_REQUEST_MAX_AGE_DAYS * DAY_MS).toISOString()
    const minDelay = new Date(now - 1 * DAY_MS).toISOString()

    // Candidatas: pagadas hace 1-30 días sin solicitud previa. El delay
    // exacto por tenant se filtra después (varía por organización).
    const { data: candidates, error: candidatesError } = await supabase
        .from("orders")
        .select("id, organization_id, customer_id, customer_info, payment_confirmed_at")
        .eq("payment_status", "paid")
        .is("review_request_sent_at", null)
        .gte("payment_confirmed_at", maxAge)
        .lte("payment_confirmed_at", minDelay)
        .order("payment_confirmed_at", { ascending: true })
        .limit(BATCH_LIMIT)

    if (candidatesError) {
        console.error("[reviews/request] Error fetching candidate orders:", candidatesError)
        return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
    }

    const orders = (candidates ?? []) as CandidateOrder[]
    if (orders.length === 0) {
        return NextResponse.json({ message: "No candidate orders", processed: 0 })
    }

    // Cargar las organizaciones involucradas una sola vez
    const orgIds = Array.from(new Set(orders.map((order) => order.organization_id)))
    const { data: orgRows } = await supabase
        .from("organizations")
        .select("id, name, slug, custom_domain, settings, locale, currency_code, country_code")
        .in("id", orgIds)

    const orgById = new Map(((orgRows ?? []) as OrgRow[]).map((org) => [org.id, org]))

    let sent = 0
    let skippedDisabled = 0
    let skippedDelay = 0
    let skippedNoContact = 0
    let failures = 0

    for (const order of orders) {
        const org = orgById.get(order.organization_id)
        if (!org) continue

        const config = resolveReviewRequestConfig(org.settings)
        if (!config.enabled) {
            skippedDisabled++
            continue
        }

        const paidAt = new Date(order.payment_confirmed_at).getTime()
        if (now - paidAt < config.delayDays * DAY_MS) {
            skippedDelay++
            continue
        }

        const customerInfo = order.customer_info ?? {}
        let email = typeof customerInfo.email === "string" ? customerInfo.email.trim() : ""
        let phone = typeof customerInfo.phone === "string" ? customerInfo.phone.trim() : ""
        const customerName = typeof customerInfo.name === "string" && customerInfo.name.trim()
            ? customerInfo.name.trim()
            : "Cliente"

        // Fallback al CRM si el snapshot no trae contacto
        if ((!email || !phone) && order.customer_id) {
            const { data: customer } = await supabase
                .from("customers")
                .select("email, phone")
                .eq("id", order.customer_id)
                .single()
            email = email || (customer?.email ?? "")
            phone = phone || (customer?.phone ?? "")
        }

        if (!email && !phone) {
            // Sin canal de contacto: marcar como procesada para no re-escanear
            await supabase
                .from("orders")
                .update({ review_request_sent_at: new Date().toISOString() })
                .eq("id", order.id)
            skippedNoContact++
            continue
        }

        const tenantLocale = getTenantLocale(org)
        const token = buildReviewToken(order.id)
        const reviewUrl = buildStoreCanonicalUrl(org, `/resena/${order.id}?t=${token}`)

        let delivered = false

        if (email) {
            const ok = await sendReviewRequestEmail({
                customerName,
                customerEmail: email,
                organizationName: org.name,
                reviewUrl,
                locale: tenantLocale.locale,
            })
            delivered = delivered || ok
        }

        if (phone) {
            try {
                await sendWhatsAppMessage(
                    org.id,
                    phone,
                    t("store.review_request.whatsapp_message", tenantLocale.locale, {
                        customerName,
                        organizationName: org.name,
                        reviewUrl,
                    })
                )
                delivered = true
            } catch (error) {
                // Sin instancia conectada o fallo del provider: el email puede
                // haber salido igual; no es fatal
                console.log(`[reviews/request] WhatsApp send skipped/failed for order ${order.id}:`, error instanceof Error ? error.message : error)
            }
        }

        if (delivered) {
            await supabase
                .from("orders")
                .update({ review_request_sent_at: new Date().toISOString() })
                .eq("id", order.id)
            sent++
            console.log(`[reviews/request] Sent review request for order ${order.id} (org ${org.slug})`)
        } else {
            // Fallo transitorio: queda NULL y se reintenta en el próximo run
            failures++
        }
    }

    return NextResponse.json({
        message: "Review requests processed",
        candidates: orders.length,
        sent,
        skippedDisabled,
        skippedDelay,
        skippedNoContact,
        failures,
    })
}
