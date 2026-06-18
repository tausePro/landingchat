"use client"

import { Button } from "@/components/ui/button"
import { cn, formatCurrency } from "@/lib/utils"
import { useTenantCurrency, useTenantLocale } from "@/lib/i18n/use-tenant-strings"

interface OrderItem {
    name: string
    quantity: number
    price: number
}

interface OrderConfirmationInlineProps {
    orderNumber: string
    orderId: string
    items: OrderItem[]
    subtotal: number
    shippingCost: number
    total: number
    customerName: string
    storeSlug: string
    onViewOrder?: () => void
    onSendWhatsApp?: () => void
    className?: string
}

export function OrderConfirmationInline({
    orderNumber,
    orderId,
    items,
    subtotal,
    shippingCost,
    total,
    customerName,
    storeSlug,
    onViewOrder,
    onSendWhatsApp,
    className
}: OrderConfirmationInlineProps) {
    const currency = useTenantCurrency()
    const locale = useTenantLocale()
    const formatPrice = (price: number) => formatCurrency(price, { currency, locale })

    const handleViewOrder = () => {
        if (onViewOrder) {
            onViewOrder()
        } else {
            window.location.href = `/store/${storeSlug}/order/${orderId}`
        }
    }

    const handleSendWhatsApp = () => {
        if (onSendWhatsApp) {
            onSendWhatsApp()
        } else {
            // Generate WhatsApp message with order details
            const message = `🎉 ¡Pedido confirmado!\n\n📦 Orden: ${orderNumber}\n💰 Total: ${formatPrice(total)}\n\nGracias por tu compra, ${customerName}!`
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
            window.open(whatsappUrl, '_blank')
        }
    }

    return (
        <div className={cn(
            "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm",
            className
        )}>
            {/* Success Header */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-4 py-6 text-center text-white">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="material-symbols-outlined text-4xl">check_circle</span>
                </div>
                <h3 className="text-xl font-bold">¡Pago Exitoso!</h3>
                <p className="text-green-100 text-sm mt-1">
                    Tu pedido ha sido procesado correctamente
                </p>
            </div>

            {/* Agent Message */}
            <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-blue-600 text-lg mt-0.5">smart_toy</span>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                        ¡Listo {customerName}! Tu pedido está en camino. ¿Necesitas agregar algo más antes de que lo empaquetemos?
                    </p>
                </div>
            </div>

            {/* Digital Ticket */}
            <div className="p-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
                    {/* Order Number */}
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                        <span className="text-sm text-slate-500">Número de orden</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{orderNumber}</span>
                    </div>

                    {/* Items */}
                    <div className="space-y-2">
                        {items.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400">
                                    {item.quantity}× {item.name}
                                </span>
                                <span className="text-slate-900 dark:text-white">
                                    {formatPrice(item.price * item.quantity)}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Totals */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Subtotal</span>
                            <span>{formatPrice(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Envío</span>
                            <span>{shippingCost > 0 ? formatPrice(shippingCost) : 'Gratis'}</span>
                        </div>
                        <div className="flex justify-between font-bold text-base pt-1">
                            <span>Total Pagado</span>
                            <span className="text-green-600">{formatPrice(total)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="px-4 pb-4 space-y-2">
                <Button
                    onClick={handleSendWhatsApp}
                    className="w-full bg-green-500 hover:bg-green-600 rounded-xl"
                >
                    <span className="material-symbols-outlined text-sm mr-2">chat</span>
                    Enviar a WhatsApp
                </Button>
                <Button
                    variant="outline"
                    onClick={handleViewOrder}
                    className="w-full rounded-xl"
                >
                    <span className="material-symbols-outlined text-sm mr-2">receipt_long</span>
                    Ver Pedido
                </Button>
            </div>
        </div>
    )
}
