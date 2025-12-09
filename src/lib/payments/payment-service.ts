/**
 * Payment Service - Unified payment gateway integration
 * Handles payment initiation for Wompi and ePayco gateways
 */

import { createServiceClient } from "@/lib/supabase/server"
import { WompiGateway } from "./wompi-gateway"
import { EpaycoGateway } from "./epayco-gateway"
import type { GatewayConfig } from "./types"

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
  paymentMethod?: "wompi" | "epayco"
}

export interface PaymentResponse {
  success: boolean
  paymentUrl?: string
  transactionId?: string
  error?: string
}

// ============================================================================
// Payment Service Class
// ============================================================================

export class PaymentService {
  /**
   * Initiate payment with configured gateway
   */
  async initiatePayment(params: InitiatePaymentParams): Promise<PaymentResponse> {
    try {
      // 1. Get gateway configuration from database
      const config = await this.getGatewayConfig(params.organizationId, params.paymentMethod)
      
      if (!config) {
        return {
          success: false,
          error: "No hay configuración de pasarela de pago disponible"
        }
      }

      // 2. Generate return URLs for success/error/pending
      const baseReturnUrl = params.returnUrl.replace(/\/$/, "") // Remove trailing slash
      const successUrl = `${baseReturnUrl}/success`
      const errorUrl = `${baseReturnUrl}/error`
      const pendingUrl = `${baseReturnUrl}/pending`

      // 3. Initiate payment based on provider
      if (config.provider === "wompi") {
        return await this.initiateWompiPayment(config, params, successUrl, errorUrl, pendingUrl)
      } else if (config.provider === "epayco") {
        return await this.initiateEpaycoPayment(config, params, successUrl, errorUrl, pendingUrl)
      }

      return {
        success: false,
        error: "Proveedor de pago no soportado"
      }
    } catch (error) {
      console.error("[PaymentService] Error initiating payment:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error al iniciar el pago"
      }
    }
  }

  /**
   * Get gateway configuration for organization
   */
  private async getGatewayConfig(
    organizationId: string,
    preferredProvider?: "wompi" | "epayco"
  ): Promise<GatewayConfig | null> {
    const supabase = await createServiceClient()

    let query = supabase
      .from("payment_gateway_configs")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)

    // If preferred provider specified, filter by it
    if (preferredProvider) {
      query = query.eq("provider", preferredProvider)
    }

    const { data, error } = await query.single()

    if (error || !data) {
      console.error("[PaymentService] No gateway config found:", error)
      return null
    }

    return {
      provider: data.provider as "wompi" | "epayco",
      publicKey: data.public_key,
      privateKey: data.private_key,
      integritySecret: data.integrity_secret,
      isTestMode: data.is_test_mode,
    }
  }

  /**
   * Initiate Wompi payment
   */
  private async initiateWompiPayment(
    config: GatewayConfig,
    params: InitiatePaymentParams,
    successUrl: string,
    errorUrl: string,
    _pendingUrl: string
  ): Promise<PaymentResponse> {
    try {
      const gateway = new WompiGateway(config)

      // Create transaction with Wompi
      const result = await gateway.createTransaction({
        amount: params.amount,
        currency: params.currency,
        reference: params.orderId,
        customerEmail: params.customerEmail,
        customerName: params.customerName,
        customerDocument: params.customerDocument,
        customerDocumentType: params.customerDocumentType,
        customerPhone: params.customerPhone,
        redirectUrl: successUrl, // Wompi will append status to this URL
        paymentMethod: "card", // Default to card, can be extended later
      })

      if (!result.success || !result.redirectUrl) {
        return {
          success: false,
          error: result.error || "Error al crear transacción con Wompi"
        }
      }

      return {
        success: true,
        paymentUrl: result.redirectUrl,
        transactionId: result.transactionId
      }
    } catch (error) {
      console.error("[PaymentService] Wompi error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error con Wompi"
      }
    }
  }

  /**
   * Initiate ePayco payment
   */
  private async initiateEpaycoPayment(
    config: GatewayConfig,
    params: InitiatePaymentParams,
    successUrl: string,
    errorUrl: string,
    _pendingUrl: string
  ): Promise<PaymentResponse> {
    try {
      const gateway = new EpaycoGateway(config)

      // Create transaction with ePayco
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
        paymentMethod: "card", // Default to card
      })

      if (!result.success || !result.redirectUrl) {
        return {
          success: false,
          error: result.error || "Error al crear transacción con ePayco"
        }
      }

      return {
        success: true,
        paymentUrl: result.redirectUrl,
        transactionId: result.transactionId
      }
    } catch (error) {
      console.error("[PaymentService] ePayco error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error con ePayco"
      }
    }
  }
}

// ============================================================================
// Singleton instance
// ============================================================================

export const paymentService = new PaymentService()
