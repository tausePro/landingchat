"use client"

import { useEffect, useRef, useState } from "react"
import type { ChangeEvent, FormEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    calculateOrderSummary,
    createOrder,
    getAvailablePaymentGateways,
    getManualPaymentInfo,
    getShippingConfig,
    validateCoupon,
} from "@/app/chat/actions"
import { useTracking } from "@/components/analytics/tracking-provider"
import { getTrackingParams } from "@/hooks/use-tracking-params"
import { calculateCouponDiscount } from "@/lib/utils/coupon"
import { getShippingAvailability } from "@/lib/utils/shipping"
import { cn } from "@/lib/utils"
import {
    getCartItemProductId,
    toCouponCartItem,
    toOrderSummaryItem,
    useCartStore,
} from "@/store/cart-store"

import { CheckoutStepper } from "./components/checkout-stepper"
import { ContactStep } from "./steps/contact-step"
import { PaymentStep } from "./steps/payment-step"
import { SuccessStep } from "./steps/success-step"
import type {
    CheckoutFormData,
    CheckoutStepKey,
    CheckoutVariant,
    ManualPaymentInfo,
    OrderSummaryAmounts,
    PaymentGatewayOption,
    PaymentMethod,
    ShippingConfig,
} from "./types"

export interface CheckoutFlowProps {
    slug: string
    sourceChannel?: "web" | "chat" | "whatsapp"
    chatId?: string
    /**
     * Callback cuando el usuario cancela o cierra el checkout.
     * - En `variant="modal"`: cierra el modal.
     * - En `variant="page"`: típicamente `router.back()`.
     */
    onCancel: () => void
    /**
     * Variante visual.
     * - `modal`: usa max-height + overflow interno (para shadcn Dialog).
     * - `page`: ocupa el alto natural; el scroll lo maneja el viewport.
     */
    variant?: CheckoutVariant
}

const CHECKOUT_STEPS: ReadonlyArray<{ key: CheckoutStepKey; label: string }> = [
    { key: "contact", label: "Datos" },
    { key: "payment", label: "Pago" },
    { key: "success", label: "Listo" },
]

const STEP_TITLES: Record<CheckoutStepKey, string> = {
    contact: "Información de Envío",
    payment: "Pago y Confirmación",
    success: "¡Orden Recibida!",
}

const STEP_DESCRIPTIONS: Record<CheckoutStepKey, string> = {
    contact: "Completa tus datos para confirmar disponibilidad de envío y preparar tu pedido.",
    payment: "Revisa el total final antes de confirmar. No cambiaremos el monto después de crear la orden.",
    success: "Tu orden quedó registrada. Conserva el enlace para consultar el estado.",
}

const INITIAL_FORM_DATA: CheckoutFormData = {
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    document_type: "CC",
    document_number: "",
    person_type: "Natural",
    business_name: "",
}

/**
 * Orquestador del flujo de checkout (3 pasos: contact → payment → success).
 *
 * Mantiene todo el state, llamadas a server actions y eventos de tracking.
 * Delega el render de cada step a componentes presentacionales en `./steps/`.
 *
 * El componente acepta dos variantes visuales (`modal` y `page`) que afectan
 * sólo el wrapping/scroll. El comportamiento del flujo es idéntico.
 *
 * Tras M4 el caso `modal` desaparecerá y este componente se simplificará.
 */
export function CheckoutFlow({ slug, sourceChannel, chatId, onCancel, variant = "page" }: CheckoutFlowProps) {
    const router = useRouter()
    const { items, total, clearCart, appliedCoupon, setAppliedCoupon } = useCartStore()
    const { trackInitiateCheckout, trackEvent, identifyUser } = useTracking()

    // Step actual del flujo
    const [step, setStep] = useState<CheckoutStepKey>("contact")
    const [loading, setLoading] = useState(false)
    const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)

    // Configuración cargada desde server actions
    const [shippingConfig, setShippingConfig] = useState<ShippingConfig | null>(null)
    const [availableGateways, setAvailableGateways] = useState<PaymentGatewayOption[]>([])
    const [gatewaysLoading, setGatewaysLoading] = useState(true)
    const [manualPaymentInfo, setManualPaymentInfo] = useState<ManualPaymentInfo | null>(null)

    // Form state
    const [formData, setFormData] = useState<CheckoutFormData>(INITIAL_FORM_DATA)
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("manual")

    // Cupón
    const [couponCode, setCouponCode] = useState("")
    const [couponLoading, setCouponLoading] = useState(false)
    const [couponError, setCouponError] = useState<string | null>(null)

    // Order summary calculado por el servidor
    const [orderSummary, setOrderSummary] = useState<OrderSummaryAmounts | null>(null)

    // Track InitiateCheckout una sola vez por mount (cuando hay items en el carrito).
    const hasTrackedCheckoutOpen = useRef(false)
    useEffect(() => {
        if (hasTrackedCheckoutOpen.current) return
        if (items.length === 0) return

        hasTrackedCheckoutOpen.current = true
        const contentIds = items.map(item => getCartItemProductId(item))
        trackInitiateCheckout(total(), "COP", contentIds)
    }, [items, total, trackInitiateCheckout])

    // Cargar shipping config, gateways y métodos manuales al montar/cambiar slug.
    useEffect(() => {
        getShippingConfig(slug).then(result => {
            if (result.success && result.config) {
                setShippingConfig(result.config)
            } else {
                setShippingConfig({
                    default_shipping_rate: 0,
                    free_shipping_enabled: false,
                    free_shipping_min_amount: null,
                    free_shipping_zones: null,
                })
            }
        })

        setGatewaysLoading(true)
        getAvailablePaymentGateways(slug).then(result => {
            if (result.success) {
                setAvailableGateways(result.gateways)
                if (result.gateways.length > 0) {
                    setPaymentMethod(result.gateways[0].provider as PaymentMethod)
                } else {
                    setPaymentMethod("manual")
                }
            }
            setGatewaysLoading(false)
        })

        getManualPaymentInfo(slug).then(result => {
            if (result.success && result.data) {
                setManualPaymentInfo(result.data)
            }
        })
    }, [slug])

    // Cálculo de envío
    const subtotal = total()
    const shippingAvailability = shippingConfig
        ? getShippingAvailability(shippingConfig, subtotal, formData.city)
        : { available: true, cost: 0 }
    const shippingCost = shippingAvailability.cost

    // Order summary del servidor
    useEffect(() => {
        const fetchSummary = async () => {
            const result = await calculateOrderSummary({
                slug,
                items: items.map(i => toOrderSummaryItem(i)),
                paymentMethod,
                shippingCost,
            })

            if (result.success && result.subtotal !== undefined) {
                setOrderSummary({
                    subtotal: result.subtotal,
                    baseSubtotal: result.baseSubtotal || result.subtotal,
                    tax: result.tax || 0,
                    shipping: result.shipping || 0,
                    paymentMethodFee: result.paymentMethodFee || 0,
                    total: result.total || 0,
                    pricesIncludeTax: result.pricesIncludeTax || false,
                })
            }
        }

        fetchSummary()
    }, [items, slug, paymentMethod, shippingCost])

    // Fallback totals si el summary aún no llegó.
    const pricesIncludeTax = orderSummary?.pricesIncludeTax ?? false
    const displaySubtotal = pricesIncludeTax && orderSummary?.baseSubtotal
        ? orderSummary.baseSubtotal
        : (orderSummary?.subtotal ?? subtotal)
    const displayShipping = orderSummary?.shipping ?? shippingCost
    const displayTax = orderSummary?.tax ?? 0
    const localFee = paymentMethod === "contraentrega" && manualPaymentInfo?.cod_additional_cost
        ? manualPaymentInfo.cod_additional_cost
        : 0
    const displayFee = orderSummary?.paymentMethodFee ?? localFee
    const hasConfiguredPaymentMethods =
        availableGateways.length > 0 ||
        Boolean(manualPaymentInfo?.bank_transfer_enabled || manualPaymentInfo?.cod_enabled)

    const couponDiscount = calculateCouponDiscount(
        appliedCoupon,
        subtotal,
        items.map(item => toCouponCartItem(item)),
    )
    const couponFreeShipping = appliedCoupon?.freeShipping || false

    const baseTotal = orderSummary?.total ?? (subtotal + shippingCost + localFee)
    const finalTotal = Math.max(0, baseTotal - couponDiscount - (couponFreeShipping ? displayShipping : 0))

    // Handlers genéricos del form
    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSelectChange = (name: string, value: string) => {
        setFormData({ ...formData, [name]: value })
    }

    // Cupón
    const handleCouponCodeChange = (e: ChangeEvent<HTMLInputElement>) => {
        setCouponCode(e.target.value.toUpperCase())
        setCouponError(null)
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
                        discountAmount: calculateCouponDiscount(
                            result.coupon,
                            subtotal,
                            items.map(item => toCouponCartItem(item)),
                        ),
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

    // Submit del paso 1 → valida y avanza a payment
    const handleSubmitContact = (e: FormEvent) => {
        e.preventDefault()

        if (!formData.document_type || !formData.document_number || !formData.person_type) {
            trackEvent("checkout_contact_validation_failed", {
                value: finalTotal,
                currency: "COP",
                contentIds: items.map(item => getCartItemProductId(item)),
                sourceChannel,
                properties: { validationField: "billing", itemCount: items.length },
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
                properties: { validationField: "state", itemCount: items.length },
            })
            toast.error("Por favor selecciona tu departamento")
            return
        }

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
            properties: { paymentMethod },
        })
        setStep("payment")
        // Auto-scroll al top en variant="page" para que el usuario vea el siguiente paso completo.
        if (variant === "page" && typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" })
        }
    }

    // Cambio de método de pago (con tracking)
    const handlePaymentMethodChange = (method: PaymentMethod) => {
        setPaymentMethod(method)
        trackEvent("checkout_payment_method_selected", {
            value: finalTotal,
            currency: "COP",
            contentIds: items.map(item => getCartItemProductId(item)),
            sourceChannel,
            properties: { paymentMethod: method },
        })
    }

    // Submit del paso 2 → crea la orden
    const handlePlaceOrder = async () => {
        if (!hasConfiguredPaymentMethods) {
            trackEvent("checkout_order_create_failed", {
                value: finalTotal,
                currency: "COP",
                contentIds: items.map(item => getCartItemProductId(item)),
                sourceChannel,
                properties: { failureReason: "no_payment_methods_configured", paymentMethod },
            })
            toast.error("La tienda no tiene métodos de pago disponibles en este momento.")
            return
        }

        setLoading(true)
        try {
            const trackingParams = getTrackingParams(slug)

            // Manual Advanced Matching del Pixel: re-init con datos del cliente
            // antes de eventos clave (InitiateCheckout/Purchase). Mejora EMQ.
            // Meta hashea SHA256 client-side automáticamente.
            // Ver docs-private/META_PURCHASE_EMQ_FIX_2026-05-05.md
            const trimmedName = formData.name.trim()
            const firstSpace = trimmedName.indexOf(" ")
            const firstName = firstSpace > 0 ? trimmedName.slice(0, firstSpace) : trimmedName
            const lastName = firstSpace > 0 ? trimmedName.slice(firstSpace + 1) : ""
            identifyUser({
                em: formData.email || undefined,
                ph: formData.phone || undefined,
                fn: firstName || undefined,
                ln: lastName || undefined,
                ct: formData.city || undefined,
                st: formData.state || undefined,
                country: "co",
            })

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
                sourceChannel: sourceChannel || trackingParams.source_channel,
                chatId,
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
                    entry_point: trackingParams.entry_point,
                    proactive_nudge_id: trackingParams.proactive_nudge_id,
                    proactive_nudge_product_id: trackingParams.proactive_nudge_product_id,
                    proactive_nudge_product_name: trackingParams.proactive_nudge_product_name,
                    proactive_nudge_destination: trackingParams.proactive_nudge_destination,
                },
            })

            if (result.success) {
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
                            shippingCost: couponFreeShipping ? 0 : shippingCost,
                            discountAmount: couponDiscount,
                            hasCoupon: Boolean(appliedCoupon),
                        },
                    })
                }

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

                trackEvent("checkout_payment_instructions_shown", {
                    value: finalTotal,
                    currency: "COP",
                    contentIds: items.map(item => getCartItemProductId(item)),
                    orderId: result.order?.id,
                    sourceChannel,
                    properties: { paymentMethod },
                })
                setStep("success")
                clearCart()
                if (variant === "page" && typeof window !== "undefined") {
                    window.scrollTo({ top: 0, behavior: "smooth" })
                }
            } else {
                if (result.order) {
                    setCreatedOrderId(result.order.id)
                    trackEvent("checkout_order_created", {
                        value: finalTotal,
                        currency: "COP",
                        contentIds: items.map(item => getCartItemProductId(item)),
                        orderId: result.order.id,
                        sourceChannel,
                        properties: { paymentMethod, itemCount: items.length },
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
                    toast.error(
                        "Tu orden fue creada, pero no pudimos abrir el pago. Puedes reintentarlo desde el detalle del pedido.",
                    )
                } else {
                    trackEvent("checkout_order_create_failed", {
                        value: finalTotal,
                        currency: "COP",
                        contentIds: items.map(item => getCartItemProductId(item)),
                        sourceChannel,
                        properties: { paymentMethod, failureReason: result.error || "order_create_failed" },
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

    // CTA del step success → ver pedido o volver a la tienda
    const handleSuccessCta = () => {
        if (createdOrderId) {
            window.location.href = `/store/${slug}/order/${createdOrderId}`
            return
        }
        if (variant === "page") {
            router.push(`/store/${slug}`)
        } else {
            onCancel()
        }
    }

    return (
        <div
            className={cn(
                "flex flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-white",
                variant === "modal" && "max-h-[90vh] overflow-hidden",
                variant === "page" && "min-h-full",
            )}
        >
            <div className={cn("flex-shrink-0 space-y-4", variant === "modal" ? "p-6 pb-0" : "px-1 pb-2")}>
                <CheckoutStepper
                    steps={CHECKOUT_STEPS}
                    currentStep={step}
                    title={STEP_TITLES[step]}
                    description={STEP_DESCRIPTIONS[step]}
                />
            </div>

            <div className={cn("flex-1", variant === "modal" ? "overflow-y-auto px-6 pb-6 pr-4 -mr-2" : "px-1")}>
                {step === "contact" && (
                    <ContactStep
                        formData={formData}
                        shippingAvailability={shippingAvailability}
                        onInputChange={handleInputChange}
                        onSelectChange={handleSelectChange}
                        onSubmit={handleSubmitContact}
                    />
                )}

                {step === "payment" && (
                    <PaymentStep
                        items={items}
                        displaySubtotal={displaySubtotal}
                        displayShipping={displayShipping}
                        displayTax={displayTax}
                        displayFee={displayFee}
                        pricesIncludeTax={pricesIncludeTax}
                        couponDiscount={couponDiscount}
                        couponFreeShipping={couponFreeShipping}
                        finalTotal={finalTotal}
                        appliedCoupon={appliedCoupon}
                        couponCode={couponCode}
                        couponLoading={couponLoading}
                        couponError={couponError}
                        onCouponCodeChange={handleCouponCodeChange}
                        onApplyCoupon={handleApplyCoupon}
                        onRemoveCoupon={handleRemoveCoupon}
                        availableGateways={availableGateways}
                        gatewaysLoading={gatewaysLoading}
                        manualPaymentInfo={manualPaymentInfo}
                        paymentMethod={paymentMethod}
                        onPaymentMethodChange={handlePaymentMethodChange}
                        hasConfiguredPaymentMethods={hasConfiguredPaymentMethods}
                        loading={loading}
                        onBack={() => setStep("contact")}
                        onPlaceOrder={handlePlaceOrder}
                    />
                )}

                {step === "success" && <SuccessStep onCta={handleSuccessCta} />}
            </div>
        </div>
    )
}
