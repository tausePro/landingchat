import { createServiceClient } from "@/lib/supabase/server"
import { verifyReviewToken } from "@/lib/reviews/token"
import { getTenantLocale } from "@/lib/i18n/tenant-locale"
import { t } from "@/lib/i18n/storefront-strings"
import { getStoreLinkServer } from "@/lib/utils/store-urls-server"
import { ReviewRequestForm } from "./review-form"
import Link from "next/link"
import type { Metadata } from "next"

interface ReviewPageProps {
    params: Promise<{ slug: string; orderId: string }>
    searchParams: Promise<{ t?: string }>
}

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
    // Página tokenizada de un solo uso: nunca indexable
    robots: { index: false, follow: false },
}

/**
 * Página pública de reseña post-compra (link tokenizado enviado por
 * email/WhatsApp tras la compra). El token HMAC valida que el visitante
 * recibió el link de SU orden; las reseñas entran sin publicar
 * (moderación del merchant en el dashboard).
 */
export default async function ReviewRequestPage({ params, searchParams }: ReviewPageProps) {
    const { slug, orderId } = await params
    const { t: token } = await searchParams

    const supabase = createServiceClient()
    const { data: organization } = await supabase
        .from("organizations")
        .select("id, name, slug, logo_url, settings, locale, currency_code, country_code, custom_domain")
        .eq("slug", slug)
        .single()

    const tenantLocale = getTenantLocale(organization)
    const locale = tenantLocale.locale
    const storeLink = await getStoreLinkServer("/", slug)

    const invalidView = (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                <div className="text-5xl mb-4">🔗</div>
                <h1 className="text-xl font-bold text-slate-900 mb-2">
                    {t("store.review_request.invalid_link_title", locale)}
                </h1>
                <p className="text-sm text-slate-500 mb-6">
                    {t("store.review_request.invalid_link_body", locale)}
                </p>
                <Link href={storeLink} className="text-sm font-semibold text-primary hover:underline">
                    {t("store.review_request.back_to_store", locale)}
                </Link>
            </div>
        </div>
    )

    if (!organization || !verifyReviewToken(orderId, token)) {
        return invalidView
    }

    const { data: order } = await supabase
        .from("orders")
        .select("id, organization_id, customer_info, items, payment_status")
        .eq("id", orderId)
        .eq("organization_id", organization.id)
        .single()

    if (!order || order.payment_status !== "paid") {
        return invalidView
    }

    // Productos de la orden (dedupe por product_id) + reseñas ya dejadas.
    // El shape de items varía según versión del checkout: `product_name`
    // (actual) o `name` (legacy) — soportamos ambos.
    const rawItems = (order.items as Array<{ product_id?: string; name?: string; product_name?: string }>) ?? []
    const items = rawItems
        .map((item) => ({
            product_id: item.product_id,
            name: item.product_name || item.name,
        }))
        .filter((item): item is { product_id: string; name: string } =>
            typeof item.product_id === "string" && typeof item.name === "string" && item.name.length > 0)
    const uniqueProducts = Array.from(new Map(items.map((item) => [item.product_id, item])).values())

    const { data: existingReviews } = await supabase
        .from("product_reviews")
        .select("product_id")
        .eq("order_id", order.id)

    const reviewedIds = new Set((existingReviews ?? []).map((row: { product_id: string }) => row.product_id))
    const pendingProducts = uniqueProducts.filter((item) => !reviewedIds.has(item.product_id))

    // Imágenes de los productos pendientes (mejor UX del form)
    const { data: productRows } = pendingProducts.length > 0
        ? await supabase
            .from("products")
            .select("id, image_url")
            .in("id", pendingProducts.map((item) => item.product_id))
        : { data: [] }

    const imageByProduct = new Map(
        ((productRows ?? []) as Array<{ id: string; image_url: string | null }>).map((row) => [row.id, row.image_url])
    )

    const customerInfo = (order.customer_info as { name?: string } | null) ?? {}

    if (pendingProducts.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                    <div className="text-5xl mb-4">✅</div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">
                        {t("store.review_request.thanks_title", locale)}
                    </h1>
                    <p className="text-sm text-slate-500 mb-6">
                        {t("store.review_request.already_reviewed", locale)}
                    </p>
                    <Link href={storeLink} className="text-sm font-semibold text-primary hover:underline">
                        {t("store.review_request.back_to_store", locale)}
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-10">
            <div className="max-w-lg mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">{organization.name}</h1>
                    <h2 className="text-lg font-semibold text-slate-700 mt-4">
                        {t("store.review_request.title", locale)}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        {t("store.review_request.subtitle", locale)}
                    </p>
                </div>

                <ReviewRequestForm
                    orderId={order.id}
                    token={token as string}
                    locale={locale}
                    storeLink={storeLink}
                    defaultAuthorName={customerInfo.name || ""}
                    products={pendingProducts.map((item) => ({
                        productId: item.product_id,
                        name: item.name,
                        imageUrl: imageByProduct.get(item.product_id) || null,
                    }))}
                />
            </div>
        </div>
    )
}
