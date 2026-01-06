"use client"

import { useCartStore } from "@/store/cart-store"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface ShippingConfig {
    free_shipping_enabled: boolean
    free_shipping_min_amount: number | null
    default_shipping_rate: number
}

interface CartSidebarProps {
    slug: string
    shippingConfig?: ShippingConfig | null
    primaryColor?: string
    recommendations?: any[]
    onClose?: () => void
    onCheckout?: () => void
}

export function CartSidebar({ slug, shippingConfig, primaryColor = "#3B82F6", recommendations = [], onClose, onCheckout }: CartSidebarProps) {
    const { items, removeItem, updateQuantity, total, addItem } = useCartStore()
    const [showCouponInput, setShowCouponInput] = useState(false)
    const [couponCode, setCouponCode] = useState("")

    const currentTotal = total()
    
    // Calcular envío gratis solo si está habilitado y tiene un monto mínimo
    const freeShippingEnabled = shippingConfig?.free_shipping_enabled && shippingConfig?.free_shipping_min_amount
    const shippingThreshold = shippingConfig?.free_shipping_min_amount || 0
    const progress = freeShippingEnabled ? Math.min((currentTotal / shippingThreshold) * 100, 100) : 0
    const remainingForFreeShipping = freeShippingEnabled ? Math.max(shippingThreshold - currentTotal, 0) : 0

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(price)
    }

    // Usar la primera recomendación disponible si existe
    const crossSellProduct = recommendations.length > 0 ? recommendations[0] : null

    const handleAddCrossSell = () => {
        if (!crossSellProduct) return
        
        addItem({
            id: crossSellProduct.id,
            name: crossSellProduct.name,
            price: crossSellProduct.price,
            image_url: crossSellProduct.image_url
        })
    }

    return (
        <>
            <div className="flex flex-col h-full bg-gray-50/50 dark:bg-gray-900/50">
                {/* Header */}
                <div className="h-16 px-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm shrink-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">Tu Carrito</h3>
                        <span 
                            className="text-white text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: primaryColor }}
                        >
                            {items.length} ítem{items.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    {onClose ? (
                        <button 
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    ) : (
                        <button className="text-gray-400 hover:text-primary transition-colors" style={{ '--hover-color': primaryColor } as any}>
                            <span className="material-symbols-outlined">more_horiz</span>
                        </button>
                    )}
                </div>

                {/* Free Shipping Progress - Solo mostrar si está habilitado */}
                {freeShippingEnabled && (
                    <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Envío Gratis</span>
                            <span className="text-[10px] font-bold" style={{ color: primaryColor }}>
                                {remainingForFreeShipping > 0 
                                    ? `${formatPrice(remainingForFreeShipping)} más`
                                    : "¡Conseguido!"}
                            </span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                            <div 
                                className="h-1.5 rounded-full transition-all duration-500 ease-out" 
                                style={{ width: `${progress}%`, backgroundColor: primaryColor }}
                            ></div>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 text-right">
                            {remainingForFreeShipping > 0 ? "¡Casi lo tienes!" : "¡Envío gratis activado!"}
                        </p>
                    </div>
                )}

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                    {items.length === 0 ? (
                         <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                            <span className="material-symbols-outlined text-4xl mb-2">remove_shopping_cart</span>
                            <p className="text-sm">Tu carrito está vacío</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {items.map((item) => (
                                <div key={item.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm relative group hover:border-primary/30 transition-colors">
                                    <button 
                                        onClick={() => removeItem(item.id)}
                                        className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                    </button>
                                    <div className="flex gap-3">
                                        <div 
                                            className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-lg bg-cover bg-center shrink-0 border border-gray-100 dark:border-gray-600" 
                                            style={{ backgroundImage: `url("${item.image_url}")` }}
                                        ></div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate pr-4">{item.name}</h4>
                                            <div className="flex justify-between items-center mt-2">
                                                <span className="text-xs font-bold" style={{ color: primaryColor }}>{formatPrice(item.price)}</span>
                                                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-lg px-1.5 py-0.5 border border-gray-100 dark:border-gray-600">
                                                    <button 
                                                        onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1))}
                                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-[12px] font-bold px-1"
                                                    >-</button>
                                                    <span className="text-[10px] font-medium w-3 text-center text-gray-700 dark:text-gray-200">{item.quantity}</span>
                                                    <button 
                                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-[12px] font-bold px-1"
                                                    >+</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Cross-selling Section */}
                    {items.length > 0 && crossSellProduct && !items.find(i => i.id === crossSellProduct.id) && (
                        <div className="mt-6">
                            <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Comprados juntos</h5>
                            <div 
                                className="bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-2 flex gap-2 items-center hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer group"
                                onClick={handleAddCrossSell}
                            >
                                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-md shrink-0 flex items-center justify-center overflow-hidden">
                                     <div 
                                        className="w-full h-full bg-cover bg-center" 
                                        style={{ backgroundImage: `url("${crossSellProduct.image_url}")` }}
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{crossSellProduct.name}</p>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                        {formatPrice(crossSellProduct.price)} • <span className="text-green-600 font-bold">Oferta</span>
                                    </p>
                                </div>
                                <button 
                                    className="w-6 h-6 rounded-full flex items-center justify-center transition-colors text-white"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    <span className="material-symbols-outlined text-[14px]">add</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Coupon Button */}
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        {!showCouponInput ? (
                            <button 
                                onClick={() => setShowCouponInput(true)}
                                className="flex items-center gap-2 text-xs font-bold hover:opacity-80 transition-opacity w-full"
                                style={{ color: primaryColor }}
                            >
                                <span className="material-symbols-outlined text-[16px]">sell</span>
                                Aplicar Cupón de descuento
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <input 
                                    type="text"
                                    value={couponCode}
                                    onChange={(e) => setCouponCode(e.target.value)}
                                    placeholder="Código"
                                    className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                />
                                <button 
                                    className="px-3 py-1.5 text-white rounded-lg text-xs font-bold shadow-sm"
                                    style={{ backgroundColor: primaryColor }}
                                    onClick={() => {
                                        // Mock application
                                        if (couponCode) {
                                            alert("Funcionalidad de cupón simulada: Código " + couponCode + " recibido.")
                                            setShowCouponInput(false)
                                            setCouponCode("")
                                        }
                                    }}
                                >
                                    Aplicar
                                </button>
                                <button 
                                    onClick={() => setShowCouponInput(false)}
                                    className="p-1.5 text-gray-400 hover:text-gray-600"
                                >
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Totals */}
                <div className="p-5 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-30 shrink-0">
                    <div className="space-y-1.5 mb-4">
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>Subtotal</span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatPrice(currentTotal)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>Descuentos</span>
                            <span className="font-medium text-gray-900 dark:text-white">-$0</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>Envío estimado</span>
                            <span className={cn("font-medium", remainingForFreeShipping <= 0 ? "text-green-600" : "text-gray-900 dark:text-white")}>
                                {remainingForFreeShipping <= 0 ? "Gratis" : "Calculado al pagar"}
                            </span>
                        </div>
                        <div className="pt-3 mt-1 border-t border-dashed border-gray-200 dark:border-gray-700 flex justify-between items-end">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">Total a Pagar</span>
                            <span className="text-lg font-extrabold" style={{ color: primaryColor }}>{formatPrice(currentTotal)}</span>
                        </div>
                    </div>
                    <button 
                        onClick={onCheckout}
                        disabled={items.length === 0}
                        className="w-full py-3 text-white font-bold rounded-xl shadow-lg shadow-gray-900/10 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#111827' }} // Black button for checkout as in design, or could be primaryColor
                    >
                        <span className="material-symbols-outlined text-[18px]">lock</span>
                        Finalizar Compra
                    </button>
                </div>
            </div>
        </>
    )
}
