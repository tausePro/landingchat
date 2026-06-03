import { notFound } from "next/navigation"
import Link from "next/link"
import { Clock } from "lucide-react"
import { getOrderDetails } from "../../../actions"
import { CheckStatusButton } from "./check-status-button"
import { OrderStatusTracker } from "@/components/analytics/order-status-tracker"
import { formatCurrency } from "@/lib/utils"
import { getTenantLocale } from "@/lib/i18n/tenant-locale"
import { t } from "@/lib/i18n/storefront-strings"
import { getStoreLinkServer } from "@/lib/utils/store-urls-server"

interface PendingPageProps {
    params: Promise<{ slug: string; orderId: string }>
    searchParams: Promise<{ access?: string }>
}

export default async function OrderPendingPage({ params, searchParams }: PendingPageProps) {
    const { slug, orderId } = await params
    const { access } = await searchParams
    const result = await getOrderDetails(slug, orderId, access)

    if (!result) notFound()

    const { order, organization } = result

    const storeHref = await getStoreLinkServer("/", slug)

    // i18n Fase 1 (T1.2 + T1.3): contexto del tenant para moneda y strings.
    const tenantLocale = getTenantLocale(organization)
    const locale = tenantLocale.locale

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
            <OrderStatusTracker
                eventName="payment_pending"
                orderId={order.id}
                orderTotal={order.total}
                paymentMethod={order.payment_method}
            />
            <div className="max-w-2xl w-full">
                <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-8 text-center">
                    {/* Pending Icon */}
                    <div className="flex justify-center mb-6">
                        <div className="size-20 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                            <Clock className="size-12 text-yellow-600 dark:text-yellow-400" />
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-3xl font-bold text-text-light-primary dark:text-text-dark-primary mb-3">
                        {t("order.pending.title", locale)}
                    </h1>

                    {/* Message */}
                    <p className="text-lg text-text-light-secondary dark:text-text-dark-secondary mb-8">
                        {t("order.pending.message", locale)}
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
                                    {t("order.common.amount", locale)}
                                </span>
                                <span className="text-2xl font-bold text-text-light-primary dark:text-text-dark-primary">
                                    {formatCurrency(order.total, tenantLocale)}
                                </span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-text-light-secondary dark:text-text-dark-secondary">
                                    {t("order.common.payment_status", locale)}
                                </span>
                                <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400">
                                    {t("order.status.pending", locale)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8 text-left">
                        <h2 className="font-semibold text-text-light-primary dark:text-text-dark-primary mb-3">
                            {t("order.pending.what_means_title", locale)}
                        </h2>
                        <ul className="space-y-2 text-sm text-text-light-secondary dark:text-text-dark-secondary">
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                                <span>{t("order.pending.what_means_verifying", locale)}</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                                <span>{t("order.pending.what_means_notification", locale)}</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                                <span>{t("order.pending.what_means_check_anytime", locale)}</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                                <span>{t("order.pending.what_means_24h_expiry", locale)}</span>
                            </li>
                        </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <CheckStatusButton />
                        <Link
                            href={storeHref}
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
