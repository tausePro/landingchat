import { notFound } from "next/navigation"
import { getOrderDetails } from "../../actions"
import Link from "next/link"
import {
    Package,
    Truck,
    CheckCircle,
    Clock,
    MapPin,
    CreditCard,
    ShoppingBag,
    ArrowLeft,
    MessageCircle
} from "lucide-react"
import { CartCleaner } from "./components/cart-cleaner"
import { formatVariantInfo } from "@/lib/utils/variantInfo"
import { formatBogotaDateTime } from "@/lib/utils/date"
import { reconcileOrderPayment } from "@/lib/payments/epayco-reconciliation"
import { PurchaseTracker } from "@/components/analytics/purchase-tracker"
import { formatCurrency } from "@/lib/utils"
import { getTenantLocale } from "@/lib/i18n/tenant-locale"
import { t, type StorefrontStringKey } from "@/lib/i18n/storefront-strings"

interface OrderPageProps {
    params: Promise<{ slug: string; orderId: string }>
    searchParams: Promise<{ access?: string; ref_payco?: string }>
}

interface OrderItem {
    quantity: number
    product_name?: string
    name?: string
    variant_info?: unknown
    total_price: number
}

export default async function OrderTrackingPage({ params, searchParams }: OrderPageProps) {
    const { slug, orderId } = await params
    const { access, ref_payco: refPayco } = await searchParams
    const result = await getOrderDetails(slug, orderId, access)

    if (!result) return notFound()

    let { order, organization } = result

    // Auto-reconciliación al aterrizar en el seguimiento del pedido.
    // Aplica a Wompi y ePayco: cuando el webhook no llega o se atrasa
    // (común en sandbox), consultamos a la pasarela el estado real y
    // sincronizamos la orden + transacción + side effects (stock, etc).
    // Para ePayco aprovechamos el `ref_payco` del query string como hint;
    // para Wompi el gateway resuelve la transacción por reference=orderId.
    const supportsAutoReconcile =
        order.payment_method === "wompi" || order.payment_method === "epayco"

    if (supportsAutoReconcile && order.payment_status === "pending") {
        const reconciliation = await reconcileOrderPayment({
            organizationId: organization.id,
            orderId: order.id,
            expectedProvider: order.payment_method,
            providerTransactionId: order.payment_method === "epayco" ? refPayco : undefined,
        })

        if (reconciliation.reconciled) {
            const refreshed = await getOrderDetails(slug, orderId, access)
            if (refreshed) {
                order = refreshed.order
                organization = refreshed.organization
            }
        }
    }

    // Locale + currency del tenant. Tantor's House (en-US/USD) ve labels en
    // inglés y precios con formato Intl 'en-US' / 'USD'. Tenants sin config
    // explícita caen al default seguro 'es-CO' / 'COP'.
    const tenantLocale = getTenantLocale(organization)
    const { locale, currency } = tenantLocale

    // Format currency con el contexto del tenant (locale + currency code).
    const formatPrice = (amount: number) =>
        formatCurrency(amount, { locale, currency })

    // Helper centralizado `formatBogotaDateTime` forza America/Bogota
    // independiente de la timezone del server (UTC en Vercel).
    // TODO(i18n fase 2): timezone awareness por tenant.
    const formatDate = (dateString: string) => formatBogotaDateTime(dateString)

    // Status config — separa label (i18n key) de la presentación visual.
    // Mapeo a `StorefrontStringKey` permite ser type-safe contra el diccionario.
    interface StatusConfig {
        labelKey: StorefrontStringKey
        icon: typeof CheckCircle
        color: string
        bg: string
        step: number
    }
    const getStatusConfig = (status: string): StatusConfig => {
        switch (status) {
            case 'pending':
                return { labelKey: 'store.order_detail.status_pending', icon: CheckCircle, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/20', step: 1 }
            case 'processing': // equivalent to confirmed payments often
                return { labelKey: 'store.order_detail.status_processing', icon: Package, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/20', step: 2 }
            case 'shipped':
                return { labelKey: 'store.order_detail.status_shipped', icon: Truck, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/20', step: 3 }
            case 'completed':
            case 'delivered':
                return { labelKey: 'store.order_detail.status_delivered', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/20', step: 4 }
            case 'cancelled':
                return { labelKey: 'store.order_detail.status_cancelled', icon: Clock, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/20', step: 0 }
            default:
                return { labelKey: 'store.order_detail.status_unknown', icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800', step: 1 }
        }
    }

    const currentStatus = getStatusConfig(order.status)
    const primaryColor = organization.settings?.branding?.primaryColor || "#3b82f6"
    const orderItems = Array.isArray(order.items) ? order.items as OrderItem[] : []

    // Construct WhatsApp link for support (get phone from settings)
    const orgPhone = organization.settings?.whatsapp?.phone || organization.settings?.contact?.phone
    const whatsappNumber = orgPhone?.replace(/\D/g, '')
    const whatsappMessage = t("store.order_detail.whatsapp_message", locale, { number: order.order_number })
    const whatsappLink = whatsappNumber
        ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`
        : null

    // Progress bar steps: labels i18n, no incluye 'cancelled' (que tiene step=0)
    const progressSteps: StorefrontStringKey[] = [
        "store.order_detail.progress_confirmed",
        "store.order_detail.progress_preparing",
        "store.order_detail.progress_shipping",
        "store.order_detail.progress_delivered",
    ]

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
            {/* Limpiar el carrito al mostrar la página de orden */}
            <CartCleaner />
            {order.payment_status === "paid" && (
                <PurchaseTracker
                    orderId={order.id}
                    orderTotal={order.total}
                    orderItems={orderItems}
                    currency={currency}
                />
            )}
            
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <Link
                        href={`/store/${slug}`}
                        className="flex items-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {t("store.order_detail.back_to_store", locale)}
                    </Link>
                    <div className="text-right">
                        <p className="text-sm text-slate-500 dark:text-slate-400">{t("store.order_detail.order_date_label", locale)}</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{formatDate(order.created_at)}</p>
                    </div>
                </div>

                {/* Main Content */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">

                    {/* Status Header */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
                                    {t("store.order_detail.order_title", locale, { number: order.order_number })}
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${currentStatus.bg} ${currentStatus.color}`}>
                                        {t(currentStatus.labelKey, locale)}
                                    </span>
                                </h1>
                                <p className="text-slate-500 dark:text-slate-400 mt-1">
                                    {t("store.order_detail.thanks_message", locale, { name: organization.name })}
                                </p>
                            </div>
                            {whatsappLink && (
                                <a
                                    href={whatsappLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                                >
                                    <MessageCircle className="w-5 h-5" />
                                    {t("store.order_detail.whatsapp_cta", locale)}
                                </a>
                            )}
                        </div>

                        {/* Progress Bar (Simple) */}
                        <div className="mt-8 relative hidden sm:block">
                            <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full w-full absolute top-1/2 -translate-y-1/2"></div>
                            <div
                                className="h-2 rounded-full absolute top-1/2 -translate-y-1/2 transition-all duration-500"
                                style={{
                                    width: `${(currentStatus.step / 4) * 100}%`,
                                    backgroundColor: primaryColor
                                }}
                            ></div>
                            <div className="relative flex justify-between">
                                {/* Steps */}
                                {progressSteps.map((labelKey, index) => {
                                    const stepNum = index + 1
                                    const completed = stepNum <= currentStatus.step
                                    return (
                                        <div key={labelKey} className="flex flex-col items-center gap-2">
                                            <div
                                                className={`w-4 h-4 rounded-full border-2 transition-colors duration-300 z-10 ${completed
                                                        ? 'bg-white border-primary'
                                                        : 'bg-slate-200 dark:bg-slate-800 border-transparent'
                                                    }`}
                                                style={{ borderColor: completed ? primaryColor : undefined }}
                                            />
                                            <span className={`text-xs font-medium ${completed ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'
                                                }`}>
                                                {t(labelKey, locale)}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Order Items (Left - 2cols) */}
                        <div className="md:col-span-2 space-y-8">
                            <div>
                                <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 mb-4">
                                    <ShoppingBag className="w-5 h-5 text-slate-400" />
                                    {t("store.order_detail.section_products", locale)}
                                </h3>
                                <div className="space-y-4">
                                    {orderItems.map((item, i: number) => (
                                        <div key={i} className="flex justify-between items-start py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                            <div>
                                                {(() => {
                                                    const variantLabel = formatVariantInfo(item.variant_info ?? item)

                                                    return (
                                                        <>
                                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                                    {item.quantity}x {item.product_name || item.name || t("store.order_detail.product_fallback_name", locale)}
                                                </p>
                                                {variantLabel && (
                                                    <p className="text-sm text-slate-500">{variantLabel}</p>
                                                )}
                                                        </>
                                                    )
                                                })()}
                                            </div>
                                            <span className="font-medium text-slate-900 dark:text-slate-100">
                                                {formatPrice(item.total_price)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Customer Info (Right - 1col) */}
                        <div className="space-y-8">
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
                                <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 mb-3">
                                    <MapPin className="w-5 h-5 text-slate-400" />
                                    {t("store.order_detail.section_shipping_address", locale)}
                                </h3>
                                <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                                    <p className="font-medium text-slate-900 dark:text-slate-100">
                                        {order.customer_info.name}
                                    </p>
                                    <p>{order.customer_info.address}</p>
                                    <p>{[order.customer_info.city, order.customer_info.state].filter(Boolean).join(', ')}</p>
                                    <p>{order.customer_info.phone}</p>
                                    {order.customer_info.email && (
                                        <p>{order.customer_info.email}</p>
                                    )}
                                </div>
                            </div>

                            {order.customer_info.document_number && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
                                    <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 mb-3">
                                        <CreditCard className="w-5 h-5 text-slate-400" />
                                        {t("store.order_detail.section_billing", locale)}
                                    </h3>
                                    <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                                        <p>
                                            <span className="font-medium text-slate-900 dark:text-slate-100">
                                                {order.customer_info.document_type || 'CC'}
                                            </span>{' '}
                                            {order.customer_info.document_number}
                                        </p>
                                        <p>{order.customer_info.person_type === 'Jurídica'
                                            ? t("store.order_detail.person_legal", locale)
                                            : t("store.order_detail.person_natural", locale)}</p>
                                        {order.customer_info.business_name && (
                                            <p className="font-medium text-slate-900 dark:text-slate-100">
                                                {order.customer_info.business_name}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
                                <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 mb-3">
                                    <CreditCard className="w-5 h-5 text-slate-400" />
                                    {t("store.order_detail.section_payment_summary", locale)}
                                </h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>{t("store.order_detail.summary_subtotal", locale)}</span>
                                        <span>{formatPrice(order.subtotal)}</span>
                                    </div>
                                    {order.tax > 0 && (
                                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                            <span>{t("store.order_detail.summary_tax", locale)}</span>
                                            <span>{formatPrice(order.tax)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>{t("store.order_detail.summary_shipping", locale)}</span>
                                        <span>{order.shipping_cost === 0 ? t("store.order_detail.summary_shipping_free", locale) : formatPrice(order.shipping_cost)}</span>
                                    </div>
                                    {order.customer_info?.payment_method_fee > 0 && (
                                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                            <span>{t("store.order_detail.summary_cod_fee", locale)}</span>
                                            <span>{formatPrice(order.customer_info.payment_method_fee)}</span>
                                        </div>
                                    )}
                                    {order.customer_info?.discount_amount > 0 && (
                                        <div className="flex justify-between text-green-600">
                                            <span>{t("store.order_detail.summary_discount", locale)} {order.customer_info?.coupon_code && <span className="font-mono text-xs">({order.customer_info.coupon_code})</span>}</span>
                                            <span>-{formatPrice(order.customer_info.discount_amount)}</span>
                                        </div>
                                    )}
                                    <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-slate-900 dark:text-slate-100 text-lg">
                                        <span>{t("store.order_detail.summary_total", locale)}</span>
                                        <span>{formatPrice(order.total)}</span>
                                    </div>
                                    <div className="mt-4 pt-2">
                                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${order.payment_status === 'paid'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {order.payment_status === 'paid'
                                                ? t("store.order_detail.payment_status_paid", locale)
                                                : t("store.order_detail.payment_status_pending", locale)}
                                        </span>
                                        <span className="text-xs text-slate-500 ml-2 uppercase">
                                            {order.payment_method}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
