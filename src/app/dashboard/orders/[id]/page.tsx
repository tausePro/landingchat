import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { getOrderDetail } from "./actions"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { OrderStatusBadge } from "./order-status-badge"
import { OrderActions } from "./order-actions"
import { CustomerJourney } from "./customer-journey"

export const dynamic = 'force-dynamic'

interface OrderDetailPageProps {
    params: Promise<{ id: string }>
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
    const { id } = await params

    let order
    try {
        order = await getOrderDetail(id)
    } catch (error) {
        console.error("[OrderDetailPage] Error loading order:", error)
        // Si es error de autenticación, redirigir a login
        if (error instanceof Error && error.message.includes("Unauthorized")) {
            redirect("/login")
        }
        // Para otros errores, mostrar 404
        notFound()
    }

    if (!order) {
        notFound()
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount)
    }

    return (
        <DashboardLayout>
            <div className="space-y-6 p-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Link
                                href="/dashboard/orders"
                                className="text-text-light-secondary dark:text-text-dark-secondary hover:text-text-light-primary dark:hover:text-text-dark-primary"
                            >
                                <span className="material-symbols-outlined">arrow_back</span>
                            </Link>
                            <h1 className="text-text-light-primary dark:text-text-dark-primary text-3xl font-bold tracking-tight">
                                Pedido {order.order_number}
                            </h1>
                        </div>
                        <p className="text-text-light-secondary dark:text-text-dark-secondary text-base font-normal leading-normal">
                            Creado el {format(new Date(order.created_at), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                        </p>
                    </div>
                    <OrderActions orderId={order.id} orderNumber={order.order_number} currentStatus={order.status} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Items */}
                        <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden">
                            <div className="p-6 border-b border-border-light dark:border-border-dark">
                                <h2 className="text-xl font-bold text-text-light-primary dark:text-text-dark-primary">
                                    Productos ({order.items.length})
                                </h2>
                            </div>
                            <div className="divide-y divide-border-light dark:divide-border-dark">
                                {order.items.map((item, index) => (
                                    <div key={index} className="p-6 flex items-start gap-4">
                                        <div className="size-16 rounded-lg bg-background-light dark:bg-background-dark flex items-center justify-center shrink-0 overflow-hidden">
                                            {item.image_url ? (
                                                <img
                                                    src={item.image_url}
                                                    alt={item.product_name}
                                                    className="size-16 object-cover"
                                                />
                                            ) : (
                                                <span className="material-symbols-outlined text-text-light-secondary dark:text-text-dark-secondary">
                                                    shopping_bag
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-text-light-primary dark:text-text-dark-primary">
                                                {item.product_name}
                                            </h3>
                                            {item.variant_info && Array.isArray(item.variant_info) && item.variant_info.length > 0 && (
                                                <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                                    {item.variant_info.map((v: { type: string; values: string[] }) =>
                                                        `${v.type}: ${v.values?.join(', ') || ''}`
                                                    ).join(' | ')}
                                                </p>
                                            )}
                                            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                                Cantidad: {item.quantity}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-text-light-primary dark:text-text-dark-primary">
                                                {formatCurrency(item.total_price)}
                                            </p>
                                            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                                                {formatCurrency(item.unit_price)} c/u
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Notes */}
                        {order.notes && (
                            <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                                <h2 className="text-xl font-bold text-text-light-primary dark:text-text-dark-primary mb-3">
                                    Notas del Pedido
                                </h2>
                                <p className="text-text-light-secondary dark:text-text-dark-secondary">
                                    {order.notes}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Estado */}
                        <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                            <h2 className="text-lg font-bold text-text-light-primary dark:text-text-dark-primary mb-4">
                                Estado
                            </h2>
                            <OrderStatusBadge status={order.status} />
                        </div>

                        {/* Payment Method */}
                        <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                            <h2 className="text-lg font-bold text-text-light-primary dark:text-text-dark-primary mb-4">
                                Método de Pago
                            </h2>
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined">payments</span>
                                </div>
                                <div>
                                    <p className="font-medium text-text-light-primary dark:text-text-dark-primary capitalize">
                                        {order.payment_method === 'wompi' && 'Wompi'}
                                        {order.payment_method === 'epayco' && 'ePayco'}
                                        {order.payment_method === 'manual' && 'Transferencia Bancaria'}
                                        {(order.payment_method === 'contraentrega' || order.payment_method === 'cash_on_delivery') && 'Contra Entrega'}
                                        {!['wompi', 'epayco', 'manual', 'contraentrega', 'cash_on_delivery'].includes(order.payment_method) && order.payment_method}
                                    </p>
                                    <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary capitalize">
                                        {order.payment_status === 'paid' ? 'Pagado' : order.payment_status === 'pending' ? 'Pendiente' : order.payment_status}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Customer Info */}
                        <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                            <h2 className="text-lg font-bold text-text-light-primary dark:text-text-dark-primary mb-4">
                                Cliente
                            </h2>
                            {order.customer ? (
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">Nombre</p>
                                        <p className="font-medium text-text-light-primary dark:text-text-dark-primary">
                                            {order.customer.full_name}
                                        </p>
                                    </div>
                                    {order.customer.email && (
                                        <div>
                                            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">Email</p>
                                            <p className="font-medium text-text-light-primary dark:text-text-dark-primary">
                                                {order.customer.email}
                                            </p>
                                        </div>
                                    )}
                                    {order.customer.phone && (
                                        <div>
                                            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">Teléfono</p>
                                            <p className="font-medium text-text-light-primary dark:text-text-dark-primary">
                                                {order.customer.phone}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-text-light-secondary dark:text-text-dark-secondary">
                                    Cliente anónimo
                                </p>
                            )}
                        </div>

                        {/* Order Summary */}
                        <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                            <h2 className="text-lg font-bold text-text-light-primary dark:text-text-dark-primary mb-4">
                                Resumen
                            </h2>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-text-light-secondary dark:text-text-dark-secondary">Subtotal</span>
                                    <span className="font-medium text-text-light-primary dark:text-text-dark-primary">
                                        {formatCurrency(order.subtotal)}
                                    </span>
                                </div>
                                {order.tax > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-text-light-secondary dark:text-text-dark-secondary">Impuestos</span>
                                        <span className="font-medium text-text-light-primary dark:text-text-dark-primary">
                                            {formatCurrency(order.tax)}
                                        </span>
                                    </div>
                                )}
                                {order.shipping_cost > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-text-light-secondary dark:text-text-dark-secondary">Envío</span>
                                        <span className="font-medium text-text-light-primary dark:text-text-dark-primary">
                                            {formatCurrency(order.shipping_cost)}
                                        </span>
                                    </div>
                                )}
                                {order.customer_info?.payment_method_fee && order.customer_info.payment_method_fee > 0 && (
                                    <div className="flex justify-between text-sm text-amber-600">
                                        <span>Costo Contraentrega</span>
                                        <span className="font-medium">
                                            {formatCurrency(order.customer_info.payment_method_fee)}
                                        </span>
                                    </div>
                                )}

                                <div className="pt-3 border-t border-border-light dark:border-border-dark flex justify-between">
                                    <span className="font-bold text-text-light-primary dark:text-text-dark-primary">Total</span>
                                    <span className="font-bold text-xl text-text-light-primary dark:text-text-dark-primary">
                                        {formatCurrency(order.total)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Shipping Address */}
                        {order.shipping_address && (
                            <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                                <h2 className="text-lg font-bold text-text-light-primary dark:text-text-dark-primary mb-4">
                                    Dirección de Envío
                                </h2>
                                <div className="text-sm text-text-light-secondary dark:text-text-dark-secondary space-y-1">
                                    <p>{order.shipping_address.street}</p>
                                    <p>{order.shipping_address.city}, {order.shipping_address.state}</p>
                                    <p>{order.shipping_address.postal_code}</p>
                                    <p>{order.shipping_address.country}</p>
                                </div>
                            </div>
                        )}

                        {/* Customer Journey */}
                        <CustomerJourney
                            sourceChannel={order.source_channel}
                            chatId={order.chat_id}
                            utmData={order.utm_data}
                        />
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
