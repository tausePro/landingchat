import { notFound } from "next/navigation"
import Link from "next/link"
import { XCircle } from "lucide-react"
import { getOrderDetails } from "../../../actions"
import { RetryPaymentButton } from "./retry-payment-button"
import { formatCurrency } from "@/lib/utils"
import { getTenantLocale } from "@/lib/i18n/tenant-locale"
import { t } from "@/lib/i18n/storefront-strings"
import { getStoreLinkServer } from "@/lib/utils/store-urls-server"

interface ErrorPageProps {
    params: Promise<{ slug: string; orderId: string }>
    searchParams: Promise<{ access?: string }>
}

export default async function OrderErrorPage({ params, searchParams }: ErrorPageProps) {
    const { slug, orderId } = await params
    const { access } = await searchParams
    const result = await getOrderDetails(slug, orderId, access)

    if (!result) notFound()

    const { order, organization } = result

    const storeHref = await getStoreLinkServer("/", slug)

    // i18n Fase 1 (T1.2 + T1.3): contexto del tenant para moneda y strings.
    const tenantLocale = getTenantLocale(organization)
    const locale = tenantLocale.locale

    // Determine error message based on payment status
    const getErrorMessage = () => {
        if (order.payment_status === 'failed') {
            return t("order.error.message_failed", locale)
        }
        return t("order.error.message_generic", locale)
    }

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
            <div className="max-w-2xl w-full">
                <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-8 text-center">
                    {/* Error Icon */}
                    <div className="flex justify-center mb-6">
                        <div className="size-20 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                            <XCircle className="size-12 text-red-600 dark:text-red-400" />
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-3xl font-bold text-text-light-primary dark:text-text-dark-primary mb-3">
                        {t("order.error.title", locale)}
                    </h1>

                    {/* Message */}
                    <p className="text-lg text-text-light-secondary dark:text-text-dark-secondary mb-8">
                        {getErrorMessage()}
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
                                <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                                    {order.payment_status === 'failed' ? t("order.status.rejected", locale) : t("order.status.error", locale)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Help Section */}
                    <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-8 text-left">
                        <h2 className="font-semibold text-text-light-primary dark:text-text-dark-primary mb-3">
                            {t("order.error.help_title", locale)}
                        </h2>
                        <ul className="space-y-2 text-sm text-text-light-secondary dark:text-text-dark-secondary">
                            <li className="flex items-start gap-2">
                                <span className="text-yellow-600 dark:text-yellow-400 mt-0.5">•</span>
                                <span>{t("order.error.help_verify_card", locale)}</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-yellow-600 dark:text-yellow-400 mt-0.5">•</span>
                                <span>{t("order.error.help_check_funds", locale)}</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-yellow-600 dark:text-yellow-400 mt-0.5">•</span>
                                <span>{t("order.error.help_contact_bank", locale)}</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-yellow-600 dark:text-yellow-400 mt-0.5">•</span>
                                <span>{t("order.error.help_try_other_method", locale)}</span>
                            </li>
                        </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <RetryPaymentButton
                            orderId={orderId}
                            slug={slug}
                            accessToken={access}
                        />
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
