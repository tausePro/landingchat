"use client"

import type { ChatDetailData } from "../../actions"
import {
    User,
    Mail,
    Phone,
    MapPin,
    ShoppingCart,
    Package,
    Tag,
    Calendar,
    DollarSign,
    ShoppingBag,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CustomerSidebarProps {
    chatDetail: ChatDetailData
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount)
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("es", {
        day: "numeric",
        month: "short",
        year: "numeric",
    })
}

function getStatusColor(status: string): string {
    const s = status.toLowerCase()
    if (["completed", "completado", "delivered", "entregado"].includes(s)) return "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20"
    if (["pending", "pendiente", "processing", "procesando"].includes(s)) return "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20"
    if (["cancelled", "cancelado", "refunded"].includes(s)) return "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20"
    return "text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-800"
}

export function CustomerSidebar({ chatDetail }: CustomerSidebarProps) {
    const customer = chatDetail.customer
    const displayName = customer?.full_name || chatDetail.customer_name || "Sin nombre"

    return (
        <div className="h-full flex flex-col">
            {/* Header - Perfil */}
            <div className="p-4 border-b border-border-light dark:border-border-dark">
                <div className="flex flex-col items-center text-center">
                    <div className="size-16 rounded-full bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center text-white text-xl font-bold mb-3">
                        {displayName.charAt(0).toUpperCase()}
                    </div>
                    <h3 className="text-sm font-semibold text-text-light-primary dark:text-text-dark-primary">
                        {displayName}
                    </h3>
                    {customer?.category && (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            <Tag className="size-3" />
                            {customer.category}
                        </span>
                    )}
                </div>
            </div>

            {/* Info del cliente */}
            <div className="p-4 border-b border-border-light dark:border-border-dark space-y-3">
                <p className="text-xs font-semibold text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-wider">
                    Información
                </p>

                {customer?.email && (
                    <div className="flex items-center gap-2 text-sm">
                        <Mail className="size-4 text-text-light-secondary dark:text-text-dark-secondary flex-shrink-0" />
                        <span className="text-text-light-primary dark:text-text-dark-primary truncate">
                            {customer.email}
                        </span>
                    </div>
                )}

                {customer?.phone && (
                    <div className="flex items-center gap-2 text-sm">
                        <Phone className="size-4 text-text-light-secondary dark:text-text-dark-secondary flex-shrink-0" />
                        <span className="text-text-light-primary dark:text-text-dark-primary">
                            {customer.phone}
                        </span>
                    </div>
                )}

                {customer?.address && (customer.address.city || customer.address.neighborhood) && (
                    <div className="flex items-center gap-2 text-sm">
                        <MapPin className="size-4 text-text-light-secondary dark:text-text-dark-secondary flex-shrink-0" />
                        <span className="text-text-light-primary dark:text-text-dark-primary">
                            {[customer.address.neighborhood, customer.address.city].filter(Boolean).join(", ")}
                        </span>
                    </div>
                )}

                {customer && (
                    <div className="flex items-center gap-2 text-sm">
                        <Calendar className="size-4 text-text-light-secondary dark:text-text-dark-secondary flex-shrink-0" />
                        <span className="text-text-light-primary dark:text-text-dark-primary">
                            Cliente desde {formatDate(chatDetail.created_at)}
                        </span>
                    </div>
                )}
            </div>

            {/* KPIs del cliente */}
            {customer && (
                <div className="p-4 border-b border-border-light dark:border-border-dark">
                    <p className="text-xs font-semibold text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-wider mb-3">
                        Resumen
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
                            <p className="text-lg font-bold text-text-light-primary dark:text-text-dark-primary">
                                {customer.total_orders}
                            </p>
                            <p className="text-[10px] text-text-light-secondary dark:text-text-dark-secondary mt-0.5">
                                Pedidos
                            </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
                            <p className="text-lg font-bold text-text-light-primary dark:text-text-dark-primary">
                                {formatCurrency(customer.total_spent)}
                            </p>
                            <p className="text-[10px] text-text-light-secondary dark:text-text-dark-secondary mt-0.5">
                                Total gastado
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Carrito activo */}
            {chatDetail.cart && chatDetail.cart.items.length > 0 && (
                <div className="p-4 border-b border-border-light dark:border-border-dark">
                    <p className="text-xs font-semibold text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-wider mb-3 flex items-center gap-1">
                        <ShoppingCart className="size-3" />
                        Carrito activo
                    </p>
                    <div className="space-y-2">
                        {chatDetail.cart.items.slice(0, 5).map((item: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-text-light-primary dark:text-text-dark-primary truncate mr-2">
                                    {item.quantity || 1}x {item.name || item.product_name || "Producto"}
                                </span>
                                <span className="text-text-light-secondary dark:text-text-dark-secondary flex-shrink-0">
                                    {formatCurrency(item.price || 0)}
                                </span>
                            </div>
                        ))}
                        {chatDetail.cart.items.length > 5 && (
                            <p className="text-[10px] text-text-light-secondary dark:text-text-dark-secondary">
                                +{chatDetail.cart.items.length - 5} más
                            </p>
                        )}
                        <div className="pt-2 border-t border-border-light dark:border-border-dark flex items-center justify-between">
                            <span className="text-xs font-medium text-text-light-primary dark:text-text-dark-primary">Total</span>
                            <span className="text-sm font-bold text-primary">
                                {formatCurrency(chatDetail.cart.total)}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Pedidos recientes */}
            {chatDetail.orders.length > 0 && (
                <div className="p-4 flex-1 overflow-y-auto">
                    <p className="text-xs font-semibold text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-wider mb-3 flex items-center gap-1">
                        <ShoppingBag className="size-3" />
                        Pedidos recientes
                    </p>
                    <div className="space-y-2">
                        {chatDetail.orders.slice(0, 5).map((order) => (
                            <div
                                key={order.id}
                                className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3"
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-mono text-text-light-secondary dark:text-text-dark-secondary">
                                        #{order.id.slice(0, 8)}
                                    </span>
                                    <span className={cn(
                                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                                        getStatusColor(order.status)
                                    )}>
                                        {order.status}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                        {formatDate(order.created_at)}
                                    </span>
                                    <span className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                        {formatCurrency(order.total)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
