import { createServiceClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { XCircle } from "lucide-react"
import { RetryPaymentButton } from "./retry-payment-button"

interface ErrorPageProps {
    params: Promise<{ slug: string; orderId: string }>
}

export default async function OrderErrorPage({ params }: ErrorPageProps) {
    const { slug, orderId } = await params
    const supabase = createServiceClient()

    // Get organization
    const { data: org } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("slug", slug)
        .single()

    if (!org) notFound()

    // Get order
    const { data: order } = await supabase
        .from("orders")
        .select("id, order_number, total, items, customer_info, status, payment_status, payment_method")
        .eq("id", orderId)
        .eq("organization_id", org.id)
        .single()

    if (!order) notFound()

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount)
    }

    // Determine error message based on payment status
    const getErrorMessage = () => {
        if (order.payment_status === 'failed') {
            return "El pago fue rechazado por la pasarela de pagos. Por favor, verifica tus datos e intenta nuevamente."
        }
        return "Hubo un problema al procesar tu pago. Por favor, intenta nuevamente."
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
                        Pago No Completado
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
                                    Número de Pedido
                                </span>
                                <span className="font-mono font-semibold text-text-light-primary dark:text-text-dark-primary">
                                    {order.order_number || `#${order.id.slice(0, 8)}`}
                                </span>
                            </div>

                            <div className="flex justify-between items-center pb-4 border-b border-border-light dark:border-border-dark">
                                <span className="text-text-light-secondary dark:text-text-dark-secondary">
                                    Monto
                                </span>
                                <span className="text-2xl font-bold text-text-light-primary dark:text-text-dark-primary">
                                    {formatCurrency(order.total)}
                                </span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-text-light-secondary dark:text-text-dark-secondary">
                                    Estado del Pago
                                </span>
                                <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                                    {order.payment_status === 'failed' ? 'Rechazado' : 'Error'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Help Section */}
                    <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-8 text-left">
                        <h2 className="font-semibold text-text-light-primary dark:text-text-dark-primary mb-3">
                            ¿Qué puedes hacer?
                        </h2>
                        <ul className="space-y-2 text-sm text-text-light-secondary dark:text-text-dark-secondary">
                            <li className="flex items-start gap-2">
                                <span className="text-yellow-600 dark:text-yellow-400 mt-0.5">•</span>
                                <span>Verifica que los datos de tu tarjeta sean correctos</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-yellow-600 dark:text-yellow-400 mt-0.5">•</span>
                                <span>Asegúrate de tener fondos suficientes</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-yellow-600 dark:text-yellow-400 mt-0.5">•</span>
                                <span>Contacta a tu banco si el problema persiste</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-yellow-600 dark:text-yellow-400 mt-0.5">•</span>
                                <span>Intenta con otro método de pago</span>
                            </li>
                        </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <RetryPaymentButton
                            orderId={orderId}
                            slug={slug}
                            paymentMethod={order.payment_method}
                        />
                        <Link
                            href={`/store/${slug}`}
                            className="px-6 py-3 rounded-lg border border-border-light dark:border-border-dark text-text-light-primary dark:text-text-dark-primary font-medium hover:bg-background-light dark:hover:bg-background-dark transition-colors"
                        >
                            Volver a la Tienda
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
