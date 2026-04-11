"use server"

import { paymentService } from "@/lib/payments/payment-service"
import { getOrderDetails } from "../../../actions"
import {
    appendStorefrontAccessParam,
    createStorefrontOrderAccessToken,
    setStorefrontCustomerSession,
} from "@/lib/storefrontAccess"

interface OrderCustomerInfo {
    email?: string
    name?: string
    document_number?: string
    document_type?: string
    phone?: string
}

export async function retryPayment(orderId: string, slug: string, accessToken?: string): Promise<{ success: boolean, error?: string, paymentUrl?: string }> {
    try {
        const result = await getOrderDetails(slug, orderId, accessToken)

        if (!result) {
            return { success: false, error: "No autorizado para reintentar este pago" }
        }

        const { order, organization } = result

        // Check if order can be retried
        if (order.payment_status === 'paid') {
            return { success: false, error: "Este pedido ya fue pagado" }
        }

        if (order.payment_method === 'manual') {
            return { success: false, error: "Este pedido usa pago manual" }
        }

        if (order.customer_id) {
            await setStorefrontCustomerSession({
                slug,
                organizationId: organization.id,
                customerId: order.customer_id,
            })
        }

        const customerInfo = (order.customer_info || {}) as OrderCustomerInfo
        const orderAccessToken = createStorefrontOrderAccessToken({
            slug,
            organizationId: organization.id,
            orderId: order.id,
            customerId: order.customer_id ?? null,
        })

        // Initiate payment again
        const paymentResult = await paymentService.initiatePayment({
            orderId: order.id,
            organizationId: organization.id,
            amount: Math.round(order.total * 100), // Convert to cents
            currency: 'COP',
            customerEmail: customerInfo?.email || '',
            customerName: customerInfo?.name || '',
            customerDocument: customerInfo?.document_number || '',
            customerDocumentType: customerInfo?.document_type || 'CC',
            customerPhone: customerInfo?.phone || '',
            returnUrl: (() => {
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://landingchat.co'
                if (appUrl.includes('localhost') || appUrl.includes('127.0.0.1')) {
                    return appendStorefrontAccessParam(`${appUrl}/store/${slug}/order/${order.id}`, orderAccessToken)
                }
                return appendStorefrontAccessParam(`https://${slug}.landingchat.co/order/${order.id}`, orderAccessToken)
            })(),
            paymentMethod: order.payment_method as "wompi" | "epayco"
        })

        if (!paymentResult.success) {
            return {
                success: false,
                error: paymentResult.error || "Error al reiniciar el pago"
            }
        }

        return {
            success: true,
            paymentUrl: paymentResult.paymentUrl
        }

    } catch (error) {
        console.error("[retryPayment] Unexpected error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error inesperado"
        }
    }
}
