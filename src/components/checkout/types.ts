/**
 * Tipos compartidos del flujo de checkout.
 *
 * Mantienen la forma de los datos del cliente, configuración de envío,
 * gateways de pago disponibles e información de pago manual.
 *
 * Pattern: cada step recibe sólo lo que necesita; el orquestador
 * (`checkout-flow.tsx`) tiene el state y maneja transiciones.
 */

import type { PaymentProvider } from "@/types/payment"

export type CheckoutStepKey = "contact" | "payment" | "success"

// Incluye todos los providers del registry (wompi, epayco, bold, addi...) más
// los métodos offline. Derivar de PaymentProvider evita que el checkout deje
// fuera una pasarela nueva (Bold ya no se castea a la fuerza).
export type PaymentMethod = PaymentProvider | "manual" | "contraentrega"

export interface CheckoutFormData {
    name: string
    email: string
    phone: string
    address: string
    city: string
    state: string
    document_type: string
    document_number: string
    person_type: string
    business_name: string
}

export interface ShippingConfig {
    default_shipping_rate: number
    free_shipping_enabled: boolean
    free_shipping_min_amount: number | null
    free_shipping_zones: string[] | null
}

export interface PaymentGatewayOption {
    provider: string
    is_active: boolean
    is_test_mode: boolean
    config?: Record<string, unknown> | null
}

export interface ManualPaymentInfo {
    bank_transfer_enabled?: boolean
    bank_name?: string
    account_type?: string
    account_number?: string
    account_holder?: string
    /** @deprecated T1.5 — usar `instant_payment_label` + `instant_payment_value`. */
    nequi_number?: string
    // T1.5 — campos genéricos country-aware
    instant_payment_label?: string | null
    instant_payment_value?: string | null
    instructions?: string | null
    cod_enabled?: boolean
    cod_additional_cost?: number
}

export interface OrderSummaryAmounts {
    subtotal: number
    baseSubtotal: number
    tax: number
    shipping: number
    paymentMethodFee: number
    total: number
    pricesIncludeTax: boolean
}
