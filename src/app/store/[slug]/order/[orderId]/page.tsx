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
import { reconcileEpaycoOrderPayment } from "@/lib/payments/epayco-reconciliation"

interface OrderPageProps {
    params: Promise<{ slug: string; orderId: string }>
    searchParams: Promise<{ access?: string }>
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
    const { access } = await searchParams
    const result = await getOrderDetails(slug, orderId, access)

    if (!result) return notFound()

    let { order, organization } = result

    if (order.payment_method === "epayco" && order.payment_status === "pending") {
        const reconciliation = await reconcileEpaycoOrderPayment({
            organizationId: organization.id,
            orderId: order.id,
        })

        if (reconciliation.reconciled) {
            const refreshed = await getOrderDetails(slug, orderId, access)
            if (refreshed) {
                order = refreshed.order
                organization = refreshed.organization
            }
        }
    }

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount)
    }

    // Helper centralizado `formatBogotaDateTime` forza America/Bogota
    // independiente de la timezone del server (UTC en Vercel).
    const formatDate = (dateString: string) => formatBogotaDateTime(dateString)

    // Status config
    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'pending':
                return { label: 'Confirmado', icon: CheckCircle, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/20', step: 1 }
            case 'processing': // equivalent to confirmed payments often
                return { label: 'En Preparación', icon: Package, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/20', step: 2 }
            case 'shipped':
                return { label: 'En Camino', icon: Truck, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/20', step: 3 }
            case 'completed':
            case 'delivered':
                return { label: 'Entregado', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/20', step: 4 }
            case 'cancelled':
                return { label: 'Cancelado', icon: Clock, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/20', step: 0 }
            default:
                return { label: 'Pendiente', icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800', step: 1 }
        }
    }

    const currentStatus = getStatusConfig(order.status)
    const primaryColor = organization.settings?.branding?.primaryColor || "#3b82f6"
    const orderItems = Array.isArray(order.items) ? order.items as OrderItem[] : []

    // Construct WhatsApp link for support (get phone from settings)
    const orgPhone = organization.settings?.whatsapp?.phone || organization.settings?.contact?.phone
    const whatsappNumber = orgPhone?.replace(/\D/g, '')
    const whatsappMessage = `Hola, tengo una consulta sobre mi pedido #${order.order_number}`
    const whatsappLink = whatsappNumber
        ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`
        : null

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
            {/* Limpiar el carrito al mostrar la página de orden */}
            <CartCleaner />
            
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <Link
                        href={`/store/${slug}`}
                        className="flex items-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver a la tienda
                    </Link>
                    <div className="text-right">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Fecha del pedido</p>
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
                                    Pedido {order.order_number}
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${currentStatus.bg} ${currentStatus.color}`}>
                                        {currentStatus.label}
                                    </span>
                                </h1>
                                <p className="text-slate-500 dark:text-slate-400 mt-1">
                                    Gracias por comprar en {organization.name}
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
                                    Ayuda por WhatsApp
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
                                {['Confirmado', 'Preparando', 'En Camino', 'Entregado'].map((label, index) => {
                                    const stepNum = index + 1
                                    const completed = stepNum <= currentStatus.step
                                    return (
                                        <div key={label} className="flex flex-col items-center gap-2">
                                            <div
                                                className={`w-4 h-4 rounded-full border-2 transition-colors duration-300 z-10 ${completed
                                                        ? 'bg-white border-primary'
                                                        : 'bg-slate-200 dark:bg-slate-800 border-transparent'
                                                    }`}
                                                style={{ borderColor: completed ? primaryColor : undefined }}
                                            />
                                            <span className={`text-xs font-medium ${completed ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'
                                                }`}>
                                                {label}
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
                                    Productos
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
                                                    {item.quantity}x {item.product_name || item.name || "Producto"}
                                                </p>
                                                {variantLabel && (
                                                    <p className="text-sm text-slate-500">{variantLabel}</p>
                                                )}
                                                        </>
                                                    )
                                                })()}
                                            </div>
                                            <span className="font-medium text-slate-900 dark:text-slate-100">
                                                {formatCurrency(item.total_price)}
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
                                    Dirección de Envío
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
                                        Facturación
                                    </h3>
                                    <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                                        <p>
                                            <span className="font-medium text-slate-900 dark:text-slate-100">
                                                {order.customer_info.document_type || 'CC'}
                                            </span>{' '}
                                            {order.customer_info.document_number}
                                        </p>
                                        <p>{order.customer_info.person_type === 'Jurídica' ? 'Persona Jurídica' : 'Persona Natural'}</p>
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
                                    Resumen de Pago
                                </h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Subtotal</span>
                                        <span>{formatCurrency(order.subtotal)}</span>
                                    </div>
                                    {order.tax > 0 && (
                                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                            <span>IVA</span>
                                            <span>{formatCurrency(order.tax)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Envío</span>
                                        <span>{order.shipping_cost === 0 ? 'Gratis' : formatCurrency(order.shipping_cost)}</span>
                                    </div>
                                    {order.customer_info?.payment_method_fee > 0 && (
                                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                            <span>Recargo contraentrega</span>
                                            <span>{formatCurrency(order.customer_info.payment_method_fee)}</span>
                                        </div>
                                    )}
                                    {order.customer_info?.discount_amount > 0 && (
                                        <div className="flex justify-between text-green-600">
                                            <span>Descuento {order.customer_info?.coupon_code && <span className="font-mono text-xs">({order.customer_info.coupon_code})</span>}</span>
                                            <span>-{formatCurrency(order.customer_info.discount_amount)}</span>
                                        </div>
                                    )}
                                    <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-slate-900 dark:text-slate-100 text-lg">
                                        <span>Total</span>
                                        <span>{formatCurrency(order.total)}</span>
                                    </div>
                                    <div className="mt-4 pt-2">
                                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${order.payment_status === 'paid'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            Pago {order.payment_status === 'paid' ? 'Aprobado' : 'Pendiente'}
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
