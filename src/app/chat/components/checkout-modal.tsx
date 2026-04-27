"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getCartItemProductId, toCouponCartItem, toOrderSummaryItem, useCartStore } from "@/store/cart-store"
import { useTracking } from "@/components/analytics/tracking-provider"
import { calculateOrderSummary, createOrder, getAvailablePaymentGateways, getManualPaymentInfo, getShippingConfig, validateCoupon } from "../actions"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getTrackingParams } from "@/hooks/use-tracking-params"
import { COLOMBIA_DEPARTMENTS } from "@/lib/constants/colombia-departments"
import { calculateCouponDiscount } from "@/lib/utils/coupon"
import { getShippingAvailability } from "@/lib/utils/shipping"
import { formatVariantInfo } from "@/lib/utils/variantInfo"

interface CheckoutModalProps {
    isOpen: boolean
    onClose: () => void
    slug: string
    sourceChannel?: "web" | "chat" | "whatsapp"
    chatId?: string
}

interface ShippingConfig {
    default_shipping_rate: number
    free_shipping_enabled: boolean
    free_shipping_min_amount: number | null
    free_shipping_zones: string[] | null
}

interface PaymentGatewayOption {
    provider: string
    is_active: boolean
    is_test_mode: boolean
    config?: Record<string, unknown> | null
}

function getPaymentGatewayLogoUrl(gateway: PaymentGatewayOption) {
    const logoUrl = gateway.config?.logo_url
    return typeof logoUrl === "string" && logoUrl.trim().length > 0 ? logoUrl : null
}

export function CheckoutModal({ isOpen, onClose, slug, sourceChannel, chatId }: CheckoutModalProps) {
    const { items, total, clearCart, appliedCoupon, setAppliedCoupon } = useCartStore()
    const { trackInitiateCheckout, trackEvent } = useTracking()
    const [step, setStep] = useState<'contact' | 'payment' | 'success'>('contact')
    const [loading, setLoading] = useState(false)
    const [shippingConfig, setShippingConfig] = useState<ShippingConfig | null>(null)
    const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
    const [availableGateways, setAvailableGateways] = useState<PaymentGatewayOption[]>([])
    const [gatewaysLoading, setGatewaysLoading] = useState(true)
    const [manualPaymentInfo, setManualPaymentInfo] = useState<{
        bank_transfer_enabled?: boolean
        bank_name?: string
        account_type?: string
        account_number?: string
        account_holder?: string
        nequi_number?: string
        cod_enabled?: boolean
        cod_additional_cost?: number
    } | null>(null)

    // Coupon state (appliedCoupon comes from cart store, shared with CartSidebar)
    const [couponCode, setCouponCode] = useState("")
    const [couponLoading, setCouponLoading] = useState(false)
    const [couponError, setCouponError] = useState<string | null>(null)
    const hasTrackedCheckoutOpen = useRef(false)

    useEffect(() => {
        if (!isOpen) {
            hasTrackedCheckoutOpen.current = false
            return
        }

        if (!hasTrackedCheckoutOpen.current) {
            hasTrackedCheckoutOpen.current = true
            const contentIds = items.map(item => getCartItemProductId(item))
            trackInitiateCheckout(total(), "COP", contentIds)
        }
    }, [isOpen, items, total, trackInitiateCheckout])

    useEffect(() => {
        if (!isOpen) return

        getShippingConfig(slug).then(result => {
            if (result.success && result.config) {
                setShippingConfig(result.config)
            } else {
                setShippingConfig({
                    default_shipping_rate: 0,
                    free_shipping_enabled: false,
                    free_shipping_min_amount: null,
                    free_shipping_zones: null
                })
            }
        })

        setGatewaysLoading(true)
        getAvailablePaymentGateways(slug).then(result => {
            if (result.success) {
                setAvailableGateways(result.gateways)
                if (result.gateways.length > 0) {
                    setPaymentMethod(result.gateways[0].provider as 'wompi' | 'epayco' | 'manual')
                } else {
                    setPaymentMethod('manual')
                }
            }
            setGatewaysLoading(false)
        })

        getManualPaymentInfo(slug).then(result => {
            if (result.success && result.data) {
                setManualPaymentInfo(result.data)
            }
        })
    }, [isOpen, slug])

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "", // Departamento
        // Tax/Invoicing fields
        document_type: "CC" as string,
        document_number: "",
        person_type: "Natural" as string,
        business_name: ""
    })

    const [paymentMethod, setPaymentMethod] = useState<'wompi' | 'epayco' | 'manual' | 'contraentrega'>('manual')

    const subtotal = total()
    const shippingAvailability = shippingConfig ? getShippingAvailability(shippingConfig, subtotal, formData.city) : { available: true, cost: 0 }
    const shippingCost = shippingAvailability.cost

    // Order Summary Calculation
    const [orderSummary, setOrderSummary] = useState<{
        subtotal: number
        baseSubtotal: number
        tax: number
        shipping: number
        paymentMethodFee: number
        total: number
        pricesIncludeTax: boolean
    } | null>(null)

    // Calculate totals when dependencies change

    useEffect(() => {
        const fetchSummary = async () => {
            const result = await calculateOrderSummary({
                slug,
                items: items.map(i => toOrderSummaryItem(i)),
                paymentMethod,
                shippingCost
            })

            if (result.success && result.subtotal !== undefined) {
                setOrderSummary({
                    subtotal: result.subtotal,
                    baseSubtotal: result.baseSubtotal || result.subtotal,
                    tax: result.tax || 0,
                    shipping: result.shipping || 0,
                    paymentMethodFee: result.paymentMethodFee || 0,
                    total: result.total || 0,
                    pricesIncludeTax: result.pricesIncludeTax || false
                })
            }
        }

        // Debounce calculation? For now just call it.
        fetchSummary()
    }, [items, slug, paymentMethod, shippingCost])

    // Fallback totals if summary is loading or failed
    // Si IVA incluido: mostrar base gravable como subtotal para discriminar
    // Si +IVA: mostrar precio tal cual como subtotal
    const pricesIncludeTax = orderSummary?.pricesIncludeTax ?? false
    const displaySubtotal = (pricesIncludeTax && orderSummary?.baseSubtotal)
        ? orderSummary.baseSubtotal
        : (orderSummary?.subtotal ?? subtotal)
    const displayShipping = orderSummary?.shipping ?? shippingCost
    const displayTax = orderSummary?.tax ?? 0
    // Calculate local fallback fee
    const localFee = (paymentMethod === 'contraentrega' && manualPaymentInfo?.cod_additional_cost) ? manualPaymentInfo.cod_additional_cost : 0
    const displayFee = orderSummary?.paymentMethodFee ?? localFee
    const hasConfiguredPaymentMethods = availableGateways.length > 0 || Boolean(manualPaymentInfo?.bank_transfer_enabled || manualPaymentInfo?.cod_enabled)

    // Coupon discount - reactivo, aplica solo a items que correspondan
    const couponDiscount = calculateCouponDiscount(appliedCoupon, subtotal, items.map(item => toCouponCartItem(item)))
    const couponFreeShipping = appliedCoupon?.freeShipping || false

    // Final total for display and submission
    const baseTotal = orderSummary?.total ?? (subtotal + shippingCost + localFee)
    const finalTotal = Math.max(0, baseTotal - couponDiscount - (couponFreeShipping ? displayShipping : 0))

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSelectChange = (name: string, value: string) => {
        setFormData({ ...formData, [name]: value })
    }

    const handleApplyCoupon = async () => {
        if (!couponCode.trim()) return
        setCouponLoading(true)
        setCouponError(null)
        try {
            const result = await validateCoupon(slug, couponCode.trim(), subtotal)
            if (result.success && result.coupon) {
                setAppliedCoupon(result.coupon)
                trackEvent("cart_coupon_applied", {
                    value: subtotal,
                    currency: "COP",
                    contentIds: items.map(item => getCartItemProductId(item)),
                    sourceChannel,
                    properties: {
                        couponCode: result.coupon.code,
                        discountAmount: calculateCouponDiscount(result.coupon, subtotal, items.map(item => toCouponCartItem(item))),
                    },
                })
                setCouponCode("")
                toast.success(`¡Cupón ${result.coupon.code} aplicado!`)
            } else {
                setCouponError(result.error || "Cupón inválido")
                setAppliedCoupon(null)
                trackEvent("cart_coupon_failed", {
                    value: subtotal,
                    currency: "COP",
                    sourceChannel,
                    properties: {
                        couponCode: couponCode.trim().toUpperCase(),
                        failureReason: result.error || "invalid_coupon",
                    },
                })
            }
        } catch {
            setCouponError("Error al validar cupón")
            trackEvent("cart_coupon_failed", {
                value: subtotal,
                currency: "COP",
                sourceChannel,
                properties: {
                    couponCode: couponCode.trim().toUpperCase(),
                    failureReason: "validation_error",
                },
            })
        } finally {
            setCouponLoading(false)
        }
    }

    const handleRemoveCoupon = () => {
        setAppliedCoupon(null)
        setCouponError(null)
        setCouponCode("")
    }

    const handleSubmitContact = (e: React.FormEvent) => {
        e.preventDefault()

        // Validate required fields
        if (!formData.document_type || !formData.document_number || !formData.person_type) {
            trackEvent("checkout_contact_validation_failed", {
                value: finalTotal,
                currency: "COP",
                contentIds: items.map(item => getCartItemProductId(item)),
                sourceChannel,
                properties: {
                    validationField: "billing",
                    itemCount: items.length,
                },
            })
            toast.error("Por favor completa todos los campos de facturación")
            return
        }

        if (!formData.state) {
            trackEvent("checkout_contact_validation_failed", {
                value: finalTotal,
                currency: "COP",
                contentIds: items.map(item => getCartItemProductId(item)),
                sourceChannel,
                properties: {
                    validationField: "state",
                    itemCount: items.length,
                },
            })
            toast.error("Por favor selecciona tu departamento")
            return
        }

        // Check shipping availability to customer's city
        if (!shippingAvailability.available) {
            trackEvent("checkout_shipping_unavailable", {
                value: finalTotal,
                currency: "COP",
                contentIds: items.map(item => getCartItemProductId(item)),
                sourceChannel,
                properties: {
                    validationField: "city",
                    failureReason: shippingAvailability.message || "shipping_unavailable",
                },
            })
            toast.error(shippingAvailability.message || "No realizamos envíos a tu ciudad por el momento")
            return
        }

        // If Jurídica, business_name is recommended but not required
        if (formData.person_type === "Jurídica" && !formData.business_name) {
            toast.warning("Se recomienda ingresar el nombre de la empresa para personas jurídicas")
        }

        trackEvent("checkout_contact_submitted", {
            value: finalTotal,
            currency: "COP",
            contentIds: items.map(item => getCartItemProductId(item)),
            sourceChannel,
            properties: {
                itemCount: items.length,
                cartValue: subtotal,
                shippingCost: couponFreeShipping ? 0 : shippingCost,
                discountAmount: couponDiscount,
                hasCoupon: Boolean(appliedCoupon),
            },
        })
        trackEvent("checkout_payment_method_selected", {
            value: finalTotal,
            currency: "COP",
            contentIds: items.map(item => getCartItemProductId(item)),
            sourceChannel,
            properties: {
                paymentMethod,
            },
        })
        setStep('payment')
    }

    const handlePlaceOrder = async () => {
        if (!hasConfiguredPaymentMethods) {
            trackEvent("checkout_order_create_failed", {
                value: finalTotal,
                currency: "COP",
                contentIds: items.map(item => getCartItemProductId(item)),
                sourceChannel,
                properties: {
                    failureReason: "no_payment_methods_configured",
                    paymentMethod,
                },
            })
            toast.error("La tienda no tiene métodos de pago disponibles en este momento.")
            return
        }

        setLoading(true)
        try {
            // Obtener tracking params (UTM, referrer, etc.)
            const trackingParams = getTrackingParams(slug)

            const result = await createOrder({
                slug,
                customerInfo: formData,
                items,
                subtotal,
                shippingCost: couponFreeShipping ? 0 : shippingCost,
                total: finalTotal,
                paymentMethod,
                couponCode: appliedCoupon?.code,
                discountAmount: couponDiscount,
                // Tracking fields
                sourceChannel: sourceChannel || trackingParams.source_channel,
                chatId: chatId,
                utmData: {
                    captured_at: trackingParams.captured_at,
                    utm_source: trackingParams.utm_source,
                    utm_medium: trackingParams.utm_medium,
                    utm_campaign: trackingParams.utm_campaign,
                    utm_content: trackingParams.utm_content,
                    utm_term: trackingParams.utm_term,
                    utm_id: trackingParams.utm_id,
                    utm_source_platform: trackingParams.utm_source_platform,
                    campaign_id: trackingParams.campaign_id,
                    adset_id: trackingParams.adset_id,
                    ad_id: trackingParams.ad_id,
                    fbclid: trackingParams.fbclid,
                    fbc: trackingParams.fbc,
                    fbp: trackingParams.fbp,
                    referrer: trackingParams.referrer,
                }
            })

            if (result.success) {
                if (result.order) {
                    setCreatedOrderId(result.order.id) // Store ID for redirection
                    trackEvent("checkout_order_created", {
                        value: finalTotal,
                        currency: "COP",
                        contentIds: items.map(item => getCartItemProductId(item)),
                        orderId: result.order.id,
                        sourceChannel,
                        properties: {
                            paymentMethod,
                            itemCount: items.length,
                            shippingCost: couponFreeShipping ? 0 : shippingCost,
                            discountAmount: couponDiscount,
                            hasCoupon: Boolean(appliedCoupon),
                        },
                    })
                }

                // If payment URL exists, redirect to gateway
                if (result.paymentUrl) {
                    trackEvent("checkout_payment_redirect_started", {
                        value: finalTotal,
                        currency: "COP",
                        contentIds: items.map(item => getCartItemProductId(item)),
                        orderId: result.order?.id,
                        sourceChannel,
                        properties: {
                            paymentMethod,
                            gateway: paymentMethod === "wompi" || paymentMethod === "epayco" ? paymentMethod : undefined,
                        },
                    })
                    window.location.href = result.paymentUrl
                    return
                }

                // Manual payment - show success
                trackEvent("checkout_payment_instructions_shown", {
                    value: finalTotal,
                    currency: "COP",
                    contentIds: items.map(item => getCartItemProductId(item)),
                    orderId: result.order?.id,
                    sourceChannel,
                    properties: {
                        paymentMethod,
                    },
                })
                setStep('success')
                clearCart()
            } else {
                if (result.order) {
                    setCreatedOrderId(result.order.id)
                    trackEvent("checkout_order_created", {
                        value: finalTotal,
                        currency: "COP",
                        contentIds: items.map(item => getCartItemProductId(item)),
                        orderId: result.order.id,
                        sourceChannel,
                        properties: {
                            paymentMethod,
                            itemCount: items.length,
                        },
                    })
                    trackEvent("checkout_gateway_load_failed", {
                        value: finalTotal,
                        currency: "COP",
                        contentIds: items.map(item => getCartItemProductId(item)),
                        orderId: result.order.id,
                        sourceChannel,
                        properties: {
                            paymentMethod,
                            gateway: paymentMethod === "wompi" || paymentMethod === "epayco" ? paymentMethod : undefined,
                            failureReason: result.error || "payment_initialization_failed",
                        },
                    })
                    toast.error("Tu orden fue creada, pero no pudimos abrir el pago. Puedes reintentarlo desde el detalle del pedido.")
                } else {
                    trackEvent("checkout_order_create_failed", {
                        value: finalTotal,
                        currency: "COP",
                        contentIds: items.map(item => getCartItemProductId(item)),
                        sourceChannel,
                        properties: {
                            paymentMethod,
                            failureReason: result.error || "order_create_failed",
                        },
                    })
                    toast.error("Error al crear la orden: " + result.error)
                }
            }
        } catch (error) {
            console.error(error)
            toast.error("Ocurrió un error inesperado")
        } finally {
            setLoading(false)
        }
    }

    const handlePaymentMethodChange = (method: 'wompi' | 'epayco' | 'manual' | 'contraentrega') => {
        setPaymentMethod(method)
        trackEvent("checkout_payment_method_selected", {
            value: finalTotal,
            currency: "COP",
            contentIds: items.map(item => getCartItemProductId(item)),
            sourceChannel,
            properties: {
                paymentMethod: method,
            },
        })
    }

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(price)
    }

    const checkoutSteps = [
        { key: "contact", label: "Datos" },
        { key: "payment", label: "Pago" },
        { key: "success", label: "Listo" },
    ]
    const currentStepIndex = checkoutSteps.findIndex(item => item.key === step)

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-h-[90vh] w-[95vw] bg-white dark:bg-slate-900 text-slate-900 dark:text-white overflow-hidden flex flex-col sm:max-w-[640px] lg:max-w-[860px]">
                <DialogHeader className="flex-shrink-0 space-y-4">
                    <DialogTitle className="text-xl">
                        {step === 'contact' && "Información de Envío"}
                        {step === 'payment' && "Pago y Confirmación"}
                        {step === 'success' && "¡Orden Recibida!"}
                    </DialogTitle>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                            {checkoutSteps.map((item, index) => (
                                <div key={item.key} className="flex flex-1 items-center gap-2">
                                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                                        index <= currentStepIndex
                                            ? "border-primary bg-primary text-white"
                                            : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800"
                                    }`}>
                                        {index + 1}
                                    </div>
                                    <span className={index <= currentStepIndex ? "text-slate-900 dark:text-white" : ""}>{item.label}</span>
                                    {index < checkoutSteps.length - 1 && <div className="hidden h-px flex-1 bg-slate-200 dark:bg-slate-700 sm:block" />}
                                </div>
                            ))}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {step === 'contact' && "Completa tus datos para confirmar disponibilidad de envío y preparar tu pedido."}
                            {step === 'payment' && "Revisa el total final antes de confirmar. No cambiaremos el monto después de crear la orden."}
                            {step === 'success' && "Tu orden quedó registrada. Conserva el enlace para consultar el estado."}
                        </p>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                    {step === 'contact' && (
                        <form onSubmit={handleSubmitContact} className="grid gap-4 py-4 lg:grid-cols-2 lg:items-start">
                            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-sm text-blue-800 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-200 lg:col-span-2">
                                Usaremos estos datos solo para coordinar el envío, enviarte actualizaciones por WhatsApp y generar tu comprobante.
                            </div>
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Nombre completo</Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        required
                                        autoComplete="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        placeholder="Ej. Juan Pérez"
                                        className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Email <span className="text-gray-400 text-xs font-normal">(Opcional)</span>
                                    </Label>
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        placeholder="juan@ejemplo.com"
                                        className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono (WhatsApp)</Label>
                                    <div className="flex">
                                        <div className="inline-flex items-center justify-center px-4 rounded-l-xl border border-r-0 border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium">
                                            🇨🇴 +57
                                        </div>
                                        <Input
                                            id="phone"
                                            name="phone"
                                            type="tel"
                                            required
                                            autoComplete="tel-national"
                                            inputMode="tel"
                                            value={formData.phone}
                                            onChange={handleInputChange}
                                            placeholder="300 123 4567"
                                            className="flex-1 h-12 rounded-l-none rounded-r-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Tax/Invoicing Fields */}
                            <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 space-y-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-primary dark:text-primary-dark mb-2 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">receipt_long</span> Información de Facturación
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Estos datos permiten emitir el comprobante de compra y evitar retrasos al crear la orden.
                                </p>

                                <div>
                                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Documento de Identidad</Label>
                                    <div className="flex gap-2">
                                        <Select value={formData.document_type} onValueChange={(value) => handleSelectChange('document_type', value)}>
                                            <SelectTrigger className="w-28 h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-lg z-50">
                                                <SelectItem value="CC" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">C.C.</SelectItem>
                                                <SelectItem value="NIT" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">NIT</SelectItem>
                                                <SelectItem value="CE" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">C.E.</SelectItem>
                                                <SelectItem value="Passport" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">Pas.</SelectItem>
                                                <SelectItem value="TI" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">T.I.</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            id="document_number"
                                            name="document_number"
                                            required
                                            autoComplete="off"
                                            inputMode="numeric"
                                            value={formData.document_number}
                                            onChange={handleInputChange}
                                            placeholder="Número"
                                            className="flex-1 h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <label
                                        className={`relative flex items-center p-3 rounded-xl border cursor-pointer transition-all shadow-sm hover:border-primary dark:hover:border-primary ${formData.person_type === 'Natural'
                                            ? 'border-primary bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
                                            }`}
                                        onClick={() => handleSelectChange('person_type', 'Natural')}
                                    >
                                        <input
                                            type="radio"
                                            name="person_type"
                                            checked={formData.person_type === 'Natural'}
                                            onChange={() => { }}
                                            className="form-radio text-primary focus:ring-primary h-5 w-5 border-gray-300"
                                        />
                                        <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-primary">
                                            Natural (Persona)
                                        </span>
                                    </label>
                                    <label
                                        className={`relative flex items-center p-3 rounded-xl border cursor-pointer transition-all shadow-sm hover:border-primary dark:hover:border-primary ${formData.person_type === 'Jurídica'
                                            ? 'border-primary bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
                                            }`}
                                        onClick={() => handleSelectChange('person_type', 'Jurídica')}
                                    >
                                        <input
                                            type="radio"
                                            name="person_type"
                                            checked={formData.person_type === 'Jurídica'}
                                            onChange={() => { }}
                                            className="form-radio text-primary focus:ring-primary h-5 w-5 border-gray-300"
                                        />
                                        <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-primary">
                                            Jurídica (Empresa)
                                        </span>
                                    </label>
                                </div>

                                {formData.person_type === "Jurídica" && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="business_name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Nombre de la Empresa</Label>
                                        <Input
                                            id="business_name"
                                            name="business_name"
                                            value={formData.business_name}
                                            onChange={handleInputChange}
                                            placeholder="Mi Empresa S.A.S."
                                            className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4">
                                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Ubicación</Label>
                                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                                    Confirmamos la cobertura de envío con tu ciudad antes de pasar al pago.
                                </p>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <Select value={formData.state} onValueChange={(value) => handleSelectChange('state', value)}>
                                        <SelectTrigger className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm">
                                            <SelectValue placeholder="Departamento" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-60 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-lg z-50">
                                            {COLOMBIA_DEPARTMENTS.map((dept) => (
                                                <SelectItem
                                                    key={dept}
                                                    value={dept}
                                                    className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800 cursor-pointer px-3 py-2"
                                                >
                                                    {dept}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        id="city"
                                        name="city"
                                        required
                                        autoComplete="address-level2"
                                        value={formData.city}
                                        onChange={handleInputChange}
                                        placeholder="Ciudad"
                                        className={`h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm ${!shippingAvailability.available && formData.city ? 'border-red-400 dark:border-red-500' : ''}`}
                                    />
                                </div>
                                {!shippingAvailability.available && formData.city && (
                                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                                        <span className="material-symbols-outlined text-amber-500 text-lg mt-0.5">local_shipping</span>
                                        <p className="text-sm text-amber-700 dark:text-amber-300">{shippingAvailability.message}</p>
                                    </div>
                                )}
                                <Input
                                    id="address"
                                    name="address"
                                    required
                                    autoComplete="street-address"
                                    value={formData.address}
                                    onChange={handleInputChange}
                                    placeholder="Dirección completa"
                                    className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                                />
                            </div>
                            <div className="pt-4 space-y-3 lg:col-span-2">
                                <Button type="submit" className="w-full h-12 rounded-xl bg-primary text-white hover:bg-primary/90 font-bold">
                                    Confirmar envío y continuar
                                </Button>
                                <div className="flex items-center justify-center gap-2 text-slate-400 opacity-80">
                                    <span className="material-symbols-outlined text-base text-green-500">lock</span>
                                    <span className="text-xs font-medium">Tus datos se usan únicamente para procesar esta compra.</span>
                                </div>
                            </div>
                        </form>
                    )}

                    {step === 'payment' && (
                        <div className="grid gap-6 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
                            {/* Coupon Input */}
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    {appliedCoupon ? (
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-green-600 text-lg">confirmation_number</span>
                                                <div>
                                                    <span className="font-mono font-bold text-green-700 dark:text-green-300 text-sm">{appliedCoupon.code}</span>
                                                    <p className="text-xs text-green-600 dark:text-green-400">{appliedCoupon.description}</p>
                                                </div>
                                            </div>
                                            <button onClick={handleRemoveCoupon} className="text-red-500 hover:text-red-700 p-1">
                                                <span className="material-symbols-outlined text-sm">close</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Código de cupón"
                                                value={couponCode}
                                                onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(null) }}
                                                className="h-10 rounded-lg border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
                                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleApplyCoupon())}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={handleApplyCoupon}
                                                disabled={couponLoading || !couponCode.trim()}
                                                className="h-10 px-4 shrink-0 text-sm"
                                            >
                                                {couponLoading ? "..." : "Aplicar"}
                                            </Button>
                                        </div>
                                    )}
                                    {couponError && (
                                        <p className="text-xs text-red-500">{couponError}</p>
                                    )}
                                </div>

                                {/* Payment Method Selection */}
                                <div className="space-y-3">
                                    <div>
                                        <Label>Método de pago</Label>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            Elige cómo quieres pagar. Si algo falla, conservaremos la orden para que puedas reintentarlo.
                                        </p>
                                    </div>
                                    {gatewaysLoading ? (
                                        <div className="text-center py-4 text-slate-500">
                                            Cargando métodos de pago...
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Show available payment gateways */}
                                            {availableGateways.map((gateway) => {
                                                const logoUrl = getPaymentGatewayLogoUrl(gateway)
                                                const providerName = gateway.provider === 'wompi' ? 'Wompi' : 'ePayco'

                                                return (
                                                    <div
                                                        key={gateway.provider}
                                                        className={`border rounded-lg p-3 cursor-pointer flex flex-col items-center gap-2 transition-all ${paymentMethod === gateway.provider ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 hover:border-slate-300'}`}
                                                        onClick={() => handlePaymentMethodChange(gateway.provider as 'wompi' | 'epayco' | 'manual')}
                                                    >
                                                        {logoUrl ? (
                                                            <div className="flex h-8 w-full items-center justify-center">
                                                                <Image
                                                                    src={logoUrl}
                                                                    alt={`Logo de ${providerName}`}
                                                                    width={96}
                                                                    height={32}
                                                                    className="max-h-8 w-auto object-contain"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span className="font-bold">{providerName}</span>
                                                        )}
                                                        <span className="text-xs text-center text-slate-500">
                                                            {gateway.provider === 'wompi' && 'Tarjetas, PSE, Nequi'}
                                                            {gateway.provider === 'epayco' && 'Tarjetas, PSE, Nequi'}
                                                        </span>
                                                        {gateway.is_test_mode && (
                                                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                                                Pruebas
                                                            </span>
                                                        )}
                                                    </div>
                                                )
                                            })}

                                            {/* Show manual payment only if bank_transfer_enabled */}
                                            {manualPaymentInfo?.bank_transfer_enabled && (
                                                <div
                                                    className={`border rounded-lg p-3 cursor-pointer flex flex-col items-center gap-2 transition-all ${paymentMethod === 'manual' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 hover:border-slate-300'}`}
                                                    onClick={() => handlePaymentMethodChange('manual')}
                                                >
                                                    <span className="font-bold">Transferencia</span>
                                                    <span className="text-xs text-center text-slate-500">Bancolombia / Nequi</span>
                                                </div>
                                            )}

                                            {/* Show COD option if enabled */}
                                            {manualPaymentInfo?.cod_enabled && (
                                                <div
                                                    className={`border rounded-lg p-3 cursor-pointer flex flex-col items-center gap-2 transition-all ${paymentMethod === 'contraentrega' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 hover:border-slate-300'}`}
                                                    onClick={() => handlePaymentMethodChange('contraentrega')}
                                                >
                                                    <span className="font-bold">Contra Entrega</span>
                                                    <span className="text-xs text-center text-slate-500">
                                                        Paga al recibir
                                                        {(manualPaymentInfo.cod_additional_cost ?? 0) > 0 && (
                                                            <span className="block text-amber-600">+${(manualPaymentInfo.cod_additional_cost ?? 0).toLocaleString('es-CO')}</span>
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Order Summary */}
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg space-y-3 text-sm lg:sticky lg:top-0">
                                <div>
                                    <h4 className="font-semibold text-slate-900 dark:text-white">Resumen de tu pedido</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Este es el total final antes de crear la orden.
                                    </p>
                                </div>
                                <div className="space-y-2 pb-2 border-b border-slate-200 dark:border-slate-700 mb-2">
                                    {items.map((item) => (
                                        <div key={item.id} className="flex justify-between items-start gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-slate-700 dark:text-slate-300 truncate mr-2">
                                                    {item.name} <span className="text-slate-400">×{item.quantity}</span>
                                                </p>
                                                {formatVariantInfo(item.variant_title) && (
                                                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                                                        {formatVariantInfo(item.variant_title)}
                                                    </p>
                                                )}
                                            </div>
                                            <span className="text-slate-700 dark:text-slate-300 shrink-0">{formatPrice(item.unit_price * item.quantity)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 dark:text-slate-400">
                                        {displayTax > 0 ? 'Base gravable' : `Subtotal (${items.length} items)`}
                                    </span>
                                    <span>{formatPrice(displaySubtotal)}</span>
                                </div>
                                {displayTax > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 dark:text-slate-400">
                                            IVA{pricesIncludeTax ? ' (incluido)' : ''}
                                        </span>
                                        <span>{pricesIncludeTax ? '' : '+'}{formatPrice(displayTax)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-slate-500 dark:text-slate-400">Envío</span>
                                    <span>{couponFreeShipping ? <span className="line-through text-slate-400 mr-1">{formatPrice(displayShipping)}</span> : null}{formatPrice(couponFreeShipping ? 0 : displayShipping)}</span>
                                </div>
                                {displayFee > 0 && (
                                    <div className="flex justify-between text-amber-600">
                                        <span>Costo Contraentrega</span>
                                        <span>{formatPrice(displayFee)}</span>
                                    </div>
                                )}
                                {couponDiscount > 0 && (
                                    <div className="flex justify-between text-green-600">
                                        <span>Descuento ({appliedCoupon?.code})</span>
                                        <span>-{formatPrice(couponDiscount)}</span>
                                    </div>
                                )}
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-bold text-base">
                                    <span>Total a Pagar</span>
                                    <span className="text-primary">{formatPrice(finalTotal)}</span>
                                </div>
                            </div>

                            {/* Bank Transfer Details - Show when manual payment selected */}
                            {paymentMethod === 'manual' && manualPaymentInfo && manualPaymentInfo.bank_transfer_enabled && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3 lg:col-start-1">
                                    <h4 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                                        <span className="material-symbols-outlined">account_balance</span>
                                        Datos para Transferencia
                                    </h4>
                                    <div className="text-sm space-y-2 text-blue-900 dark:text-blue-200">
                                        {manualPaymentInfo.bank_name && (
                                            <div className="flex justify-between">
                                                <span className="text-blue-600 dark:text-blue-400">Banco:</span>
                                                <span className="font-medium">{manualPaymentInfo.bank_name}</span>
                                            </div>
                                        )}
                                        {manualPaymentInfo.account_type && (
                                            <div className="flex justify-between">
                                                <span className="text-blue-600 dark:text-blue-400">Tipo:</span>
                                                <span className="font-medium capitalize">{manualPaymentInfo.account_type}</span>
                                            </div>
                                        )}
                                        {manualPaymentInfo.account_number && (
                                            <div className="flex justify-between">
                                                <span className="text-blue-600 dark:text-blue-400">Cuenta:</span>
                                                <span className="font-mono font-medium">{manualPaymentInfo.account_number}</span>
                                            </div>
                                        )}
                                        {manualPaymentInfo.account_holder && (
                                            <div className="flex justify-between">
                                                <span className="text-blue-600 dark:text-blue-400">Titular:</span>
                                                <span className="font-medium">{manualPaymentInfo.account_holder}</span>
                                            </div>
                                        )}
                                        {manualPaymentInfo.nequi_number && (
                                            <>
                                                <hr className="border-blue-200 dark:border-blue-700" />
                                                <div className="flex justify-between">
                                                    <span className="text-blue-600 dark:text-blue-400">Nequi:</span>
                                                    <span className="font-mono font-medium">{manualPaymentInfo.nequi_number}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                                        Recuerda enviar el comprobante de pago al WhatsApp de la tienda.
                                    </p>
                                </div>
                            )}

                            {!gatewaysLoading && !hasConfiguredPaymentMethods && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 lg:col-start-1">
                                    <div className="flex items-start gap-3">
                                        <span className="material-symbols-outlined text-amber-500">info</span>
                                        <div>
                                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                                La tienda no tiene métodos de pago disponibles en este momento. Intenta más tarde o contacta a la tienda.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3 pt-2 lg:col-start-1">
                                <div className="flex gap-3">
                                    <Button variant="outline" onClick={() => setStep('contact')} className="flex-1">
                                        Atrás
                                    </Button>
                                    <Button onClick={handlePlaceOrder} disabled={loading || gatewaysLoading || !hasConfiguredPaymentMethods} className="flex-1 bg-primary text-white hover:bg-primary/90">
                                        {loading ? "Creando orden..." : "Confirmar pedido"}
                                    </Button>
                                </div>
                                <div className="flex items-center justify-center gap-2 text-slate-400 opacity-80">
                                    <span className="material-symbols-outlined text-base text-green-500">verified_user</span>
                                    <span className="text-xs font-medium">Pago procesado por métodos seguros de la tienda.</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="py-8 flex flex-col items-center text-center space-y-4">
                            <div className="size-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                                <span className="material-symbols-outlined text-3xl">check</span>
                            </div>
                            <h3 className="text-xl font-bold">¡Gracias por tu compra!</h3>
                            <p className="text-slate-500 max-w-xs">
                                Hemos recibido tu orden correctamente. Te enviaremos un correo con los detalles y el número de guía.
                            </p>
                            <Button
                                onClick={() => {
                                    if (createdOrderId) {
                                        window.location.href = `/store/${slug}/order/${createdOrderId}`
                                    } else {
                                        onClose()
                                    }
                                }}
                                className="mt-4 min-w-[200px]"
                            >
                                Ver Pedido
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}