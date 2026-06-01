/**
 * Registry de pasarelas de pago.
 *
 * Catálogo central que describe cómo se construye cada gateway, qué modo
 * de checkout usa (widget embebido vs redirección externa), y qué hace
 * cada uno con webhooks.
 *
 * Para agregar un proveedor nuevo:
 *   1. Crear `src/lib/payments/{provider}-gateway.ts` implementando `PaymentGateway`
 *   2. Importarlo aquí y agregarlo a `PROVIDER_REGISTRY`
 *   3. Agregar el slug al enum `PaymentProvider` en `src/types/payment.ts`
 *   4. (Opcional) Crear su pantalla de configuración en `app/dashboard/settings/{provider}`
 *   5. (Opcional) Crear su componente de checkout cliente
 *
 * No se necesita tocar el handler de webhooks ni la lógica de procesamiento.
 */

import { WompiGateway } from "./wompi-gateway"
import { EpaycoGateway } from "./epayco-gateway"
import { BoldGateway } from "./bold-gateway"
import { AddiGateway } from "./addi-gateway"
import type { PaymentProvider } from "@/types/payment"
import type { PaymentGateway, GatewayConfig, CheckoutMode } from "./types"

export interface ProviderInfo {
    id: PaymentProvider
    displayName: string
    checkoutMode: CheckoutMode
    /** Constructor de la clase que implementa PaymentGateway */
    create: (config: GatewayConfig) => PaymentGateway
    /**
     * Indica si la integración está lista para producción. Los stubs
     * (Addi por ejemplo) no deberían poderse activar en `payment_gateway_configs`
     * desde el UI hasta que estén implementados.
     */
    enabled: boolean
}

export const PROVIDER_REGISTRY: Record<PaymentProvider, ProviderInfo> = {
    wompi: {
        id: "wompi",
        displayName: "Wompi (Bancolombia)",
        checkoutMode: "embedded_widget",
        create: (config) => new WompiGateway(config),
        enabled: true,
    },
    epayco: {
        id: "epayco",
        displayName: "ePayco",
        checkoutMode: "embedded_widget",
        create: (config) => new EpaycoGateway(config),
        enabled: true,
    },
    bold: {
        id: "bold",
        displayName: "Bold",
        checkoutMode: "hosted_redirect",
        create: (config) => new BoldGateway(config),
        enabled: true, // gateway completo (Slice 1 Bold end-to-end); activación por tenant via payment_gateway_configs
    },
    addi: {
        id: "addi",
        displayName: "Addi (BNPL)",
        checkoutMode: "hosted_redirect",
        create: (config) => new AddiGateway(config),
        enabled: false, // requiere onboarding directo con Addi
    },
}

export function getProviderInfo(provider: string): ProviderInfo | null {
    return PROVIDER_REGISTRY[provider as PaymentProvider] || null
}

export function listEnabledProviders(): ProviderInfo[] {
    return Object.values(PROVIDER_REGISTRY).filter((p) => p.enabled)
}
