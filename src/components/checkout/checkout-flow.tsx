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
import {
    getCartItemProductId,
    toCouponCartItem,
    toOrderSummaryItem,
    useCartStore,
} from "@/store/cart-store"

import { useT, useTenantCountry } from "@/lib/i18n/use-tenant-strings"
import { getCountryProfile } from "@/lib/i18n/country-profiles"
import type { StorefrontStringKey } from "@/lib/i18n/storefront-strings"

import { CheckoutStepper } from "./components/checkout-stepper"
import { ContactStep } from "./steps/contact-step"
import { PaymentStep } from "./steps/payment-step"
import { SuccessStep } from "./steps/success-step"
import type {
    CheckoutFormData,
    CheckoutStepKey,
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
}

// i18n Fase 1 (T1.3f): mantenemos arrays de keys de diccionario al top-level
// (puro y serializable) y resolvemos los strings dentro del componente con
// useT() en el contexto del tenant.
const CHECKOUT_STEPS: ReadonlyArray<{ key: CheckoutStepKey; labelKey: StorefrontStringKey }> = [
    { key: "contact", labelKey: "store.checkout.step_contact_label" },
    { key: "payment", labelKey: "store.checkout.step_payment_label" },
    { key: "success", labelKey: "store.checkout.step_success_label" },
]

const STEP_TITLE_KEYS: Record<CheckoutStepKey, StorefrontStringKey> = {
    contact: "store.checkout.step_contact_title",
    payment: "store.checkout.step_payment_title",
    success: "store.checkout.step_success_title",
}

const STEP_DESCRIPTION_KEYS: Record<CheckoutStepKey, StorefrontStringKey> = {
    contact: "store.checkout.step_contact_description",
    payment: "store.checkout.step_payment_description",
    success: "store.checkout.step_success_description",
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
 * Vive en una ruta dedicada (`/store/[slug]/checkout`). El layout y el back
 * button los maneja el page-client; este componente solo se ocupa del flujo.
 */
export function CheckoutFlow({ slug, sourceChannel, chatId }: CheckoutFlowProps) {
    const t = useT()
    // T1.4 — country profile para Meta Pixel Advanced Matching y defaults
    // del form. Tantor (US) envía "us"; tenants legacy "co".
    const tenantCountry = useTenantCountry()
    const countryProfile = getCountryProfile(tenantCountry)
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
                toast.success(t("store.checkout.toast_coupon_applied", { code: result.coupon.code }))
            } else {
                setCouponError(result.error || t("store.checkout.toast_coupon_invalid"))
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
            setCouponError(t("store.checkout.toast_coupon_validation_error"))
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
            toast.error(t("store.checkout.toast_validation_billing"))
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
            toast.error(t("store.checkout.toast_validation_state"))
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
            toast.error(shippingAvailability.message || t("store.checkout.toast_shipping_unavailable_default"))
            return
        }

        if (formData.person_type === "Jurídica" && !formData.business_name) {
            toast.warning(t("store.checkout.toast_business_name_warning"))
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
        // Auto-scroll al top para que el usuario vea el siguiente paso completo.
        if (typeof window !== "undefined") {
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
            toast.error(t("store.checkout.toast_no_payment_methods"))
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
                country: countryProfile.metaPixelCountry,
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
                if (typeof window !== "undefined") {
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
                    toast.error(t("store.checkout.toast_order_created_payment_failed"))
                } else {
                    trackEvent("checkout_order_create_failed", {
                        value: finalTotal,
                        currency: "COP",
                        contentIds: items.map(item => getCartItemProductId(item)),
                        sourceChannel,
                        properties: { paymentMethod, failureReason: result.error || "order_create_failed" },
                    })
                    toast.error(`${t("store.checkout.toast_order_create_error_prefix")} ${result.error}`)
                }
            }
        } catch (error) {
            console.error(error)
            toast.error(t("store.checkout.toast_unexpected_error"))
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
        router.push(`/store/${slug}`)
    }

    // i18n: traducimos las labels de pasos en el render para que respeten el
    // locale del provider del tenant.
    const stepperSteps = CHECKOUT_STEPS.map(({ key, labelKey }) => ({
        key,
        label: t(labelKey),
    }))

    return (
        <div className="flex min-h-full flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
            <div className="flex-shrink-0 space-y-4 px-1 pb-2">
                <CheckoutStepper
                    steps={stepperSteps}
                    currentStep={step}
                    title={t(STEP_TITLE_KEYS[step])}
                    description={t(STEP_DESCRIPTION_KEYS[step])}
                />
            </div>

            <div className="flex-1 px-1">
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
