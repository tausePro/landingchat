import { notFound } from "next/navigation"
import Link from "next/link"
import { CheckCircle } from "lucide-react"
import { PurchaseTracker } from "@/components/analytics/purchase-tracker"
import { getOrderDetails } from "../../../actions"
import { appendStorefrontAccessParam } from "@/lib/storefrontAccess"
import { formatCurrency } from "@/lib/utils"
import { getTenantLocale } from "@/lib/i18n/tenant-locale"
import { t } from "@/lib/i18n/storefront-strings"

interface SuccessPageProps {
    params: Promise<{ slug: string; orderId: string }>
    searchParams: Promise<{ access?: string }>
}

export default async function OrderSuccessPage({ params, searchParams }: SuccessPageProps) {
    const { slug, orderId } = await params
    const { access } = await searchParams
    const result = await getOrderDetails(slug, orderId, access)

    if (!result) notFound()

    const { order, organization } = result
    const orderDetailsHref = access
        ? appendStorefrontAccessParam(`/store/${slug}/order/${orderId}`, access)
        : `/store/${slug}/order/${orderId}`

    // i18n Fase 1 (T1.2 + T1.3): formato de moneda y strings parametrizados por
    // contexto del tenant. Para tenants en COP/es-CO (default) el output es idéntico
    // al legacy. Tantors (USD/en-US) verá precios en USD y strings en inglés.
    const tenantLocale = getTenantLocale(organization)
    const locale = tenantLocale.locale

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
            {order.payment_status === "paid" && (
                <PurchaseTracker
                    orderId={order.id}
                    orderTotal={order.total}
                    orderItems={order.items || []}
                    currency="COP"
                />
            )}
            
            <div className="max-w-2xl w-full">
                <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-8 text-center">
                    {/* Success Icon */}
                    <div className="flex justify-center mb-6">
                        <div className="size-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                            <CheckCircle className="size-12 text-green-600 dark:text-green-400" />
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-3xl font-bold text-text-light-primary dark:text-text-dark-primary mb-3">
                        {t("order.success.title", locale)}
                    </h1>

                    {/* Message */}
                    <p className="text-lg text-text-light-secondary dark:text-text-dark-secondary mb-8">
                        {t("order.success.message", locale)}
                    </p>

                    {/* Order Details */}
                    <div className="bg-background-light dark:bg-background-dark rounded-lg p-6 mb-8 text-left">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-4 border-b border-border-light dark:border-border-dark">
                                <span className="text-text-light-secondary dark:text-text-dark-secondary">
                                    {t("order.common.order_number", locale)}
                                </span>
                                <span className="font-mono font-semibold text-text-light-primary dark:text-text-dark-primary">
                                    {order.order_number || `#${order.id.slice(0, 8)}`}
                                </span>
                            </div>

                            <div className="flex justify-between items-center pb-4 border-b border-border-light dark:border-border-dark">
                                <span className="text-text-light-secondary dark:text-text-dark-secondary">
                                    {t("order.common.total_paid", locale)}
                                </span>
                                <span className="text-2xl font-bold text-text-light-primary dark:text-text-dark-primary">
                                    {formatCurrency(order.total, tenantLocale)}
                                </span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-text-light-secondary dark:text-text-dark-secondary">
                                    {t("order.common.order_status", locale)}
                                </span>
                                <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                                    {order.status === 'confirmed' ? t("order.status.confirmed", locale) : t("order.status.processing", locale)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Instructions for Manual Payment */}
                    {order.payment_status === 'pending' && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-8 text-left">
                            <h2 className="font-semibold text-text-light-primary dark:text-text-dark-primary mb-3">
                                Información para Transferencia
                            </h2>
                            <div className="space-y-3 text-sm">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-text-light-secondary dark:text-text-dark-secondary">Banco:</span>
                                        <p className="font-medium text-text-light-primary dark:text-text-dark-primary">Bancolombia</p>
                                    </div>
                                    <div>
                                        <span className="text-text-light-secondary dark:text-text-dark-secondary">Tipo de Cuenta:</span>
                                        <p className="font-medium text-text-light-primary dark:text-text-dark-primary">Ahorros</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-text-light-secondary dark:text-text-dark-secondary">Número de Cuenta:</span>
                                        <p className="font-mono font-medium text-text-light-primary dark:text-text-dark-primary">60100000000</p>
                                    </div>
                                    <div>
                                        <span className="text-text-light-secondary dark:text-text-dark-secondary">Nequi:</span>
                                        <p className="font-mono font-medium text-text-light-primary dark:text-text-dark-primary">3001234567</p>
                                    </div>
                                </div>
                                <div>
                                    <span className="text-text-light-secondary dark:text-text-dark-secondary">Titular:</span>
                                    <p className="font-medium text-text-light-primary dark:text-text-dark-primary">LANDINGCHAT SAS</p>
                                </div>
                                <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                        <strong>Importante:</strong> Envía el comprobante de pago por WhatsApp al +57 301 234 5678 
                                        con el número de pedido <strong>{order.order_number}</strong>
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Next Steps */}
                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8 text-left">
                        <h2 className="font-semibold text-text-light-primary dark:text-text-dark-primary mb-3">
                            {t("order.success.next_steps_title", locale)}
                        </h2>
                        <ul className="space-y-2 text-sm text-text-light-secondary dark:text-text-dark-secondary">
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                                <span>{t("order.success.next_step_email", locale)}</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                                <span>{t("order.success.next_step_shipping", locale)}</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                                <span>{t("order.success.next_step_tracking", locale)}</span>
                            </li>
                        </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                            href={orderDetailsHref}
                            className="px-6 py-3 rounded-lg bg-primary-light dark:bg-primary-dark text-white font-medium hover:opacity-90 transition-opacity"
                        >
                            {t("order.common.view_order_details", locale)}
                        </Link>
                        <Link
                            href={`/store/${slug}`}
                            className="px-6 py-3 rounded-lg border border-border-light dark:border-border-dark text-text-light-primary dark:text-text-dark-primary font-medium hover:bg-background-light dark:hover:bg-background-dark transition-colors"
                        >
                            {t("order.common.back_to_store", locale)}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
