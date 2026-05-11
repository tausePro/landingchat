/**
 * Payment Service - Unified payment gateway integration.
 *
 * Servicio agnóstico al proveedor: lee la configuración activa del merchant,
 * desencripta credenciales y delega al `createPaymentGateway` factory que a
 * su vez consulta el `PROVIDER_REGISTRY`. Cualquier proveedor habilitado
 * en el registry funciona aquí sin tocar este archivo.
 */

import { createServiceClient } from "@/lib/supabase/server"
import { createPaymentGateway } from "./factory"
import { deserializePaymentGatewayConfig } from "@/types/payment"
import type { PaymentProvider } from "@/types/payment"

function buildPaymentStatusUrl(returnUrl: string, status: "success" | "error" | "pending") {
  const url = new URL(returnUrl)
  const pathname = url.pathname.replace(/\/$/, "")

  url.pathname = `${pathname}/${status}`

  return url.toString()
}

// ============================================================================
// Types
// ============================================================================

export interface InitiatePaymentParams {
  orderId: string
  organizationId: string
  amount: number // Amount in cents
  currency: string
  customerEmail: string
  customerName: string
  customerDocument: string
  customerDocumentType: string
  customerPhone?: string
  returnUrl: string
  /**
   * Proveedor preferido. Si se omite, se toma la única pasarela activa
   * de la organización. Acepta cualquier `PaymentProvider` registrado.
   */
  paymentMethod?: PaymentProvider
}

export interface PaymentResponse {
  success: boolean
  paymentUrl?: string
  transactionId?: string
  provider?: PaymentProvider
  error?: string
}

// ============================================================================
// Payment Service Class
// ============================================================================

export class PaymentService {
  /**
   * Inicia un pago con la pasarela configurada del merchant.
   *
   * Flujo:
   *   1. Carga `payment_gateway_configs` filtrando por `is_active = true` y,
   *      si se especifica, por `provider`.
   *   2. Construye el gateway via `createPaymentGateway` (registry-driven).
   *   3. Llama a `gateway.createTransaction(...)` y devuelve `paymentUrl`.
   */
  async initiatePayment(params: InitiatePaymentParams): Promise<PaymentResponse> {
    try {
      const supabase = createServiceClient()

      let query = supabase
        .from("payment_gateway_configs")
        .select("*")
        .eq("organization_id", params.organizationId)
        .eq("is_active", true)

      if (params.paymentMethod) {
        query = query.eq("provider", params.paymentMethod)
      }

      const { data: rawConfig, error } = await query.single()

      if (error || !rawConfig) {
        console.error("[PaymentService] No gateway config found:", error)
        return {
          success: false,
          error: "No hay configuración de pasarela de pago disponible"
        }
      }

      const config = deserializePaymentGatewayConfig(rawConfig)
      const successUrl = buildPaymentStatusUrl(params.returnUrl, "success")

      let gateway
      try {
        gateway = createPaymentGateway(config)
      } catch (factoryError) {
        console.error("[PaymentService] Failed to build gateway:", factoryError)
        return {
          success: false,
          error: factoryError instanceof Error ? factoryError.message : "Proveedor de pago no soportado"
        }
      }

      const result = await gateway.createTransaction({
        amount: params.amount,
        currency: params.currency,
        reference: params.orderId,
        customerEmail: params.customerEmail,
        customerName: params.customerName,
        customerDocument: params.customerDocument,
        customerDocumentType: params.customerDocumentType,
        customerPhone: params.customerPhone,
        redirectUrl: successUrl,
        paymentMethod: "card",
      })

      if (!result.success || !result.redirectUrl) {
        return {
          success: false,
          provider: config.provider,
          error: result.error || `Error al crear transacción con ${config.provider}`
        }
      }

      return {
        success: true,
        paymentUrl: result.redirectUrl,
        transactionId: result.transactionId,
        provider: config.provider,
      }
    } catch (error) {
      console.error("[PaymentService] Error initiating payment:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error al iniciar el pago"
      }
    }
  }
}

// ============================================================================
// Singleton instance
// ============================================================================

export const paymentService = new PaymentService()
