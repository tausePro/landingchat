"use server"

import { createServiceClient } from "@/lib/supabase/server"
import { paymentService } from "@/lib/payments/payment-service"

export async function retryPayment(orderId: string, slug: string) {
    const supabase = createServiceClient()

    try {
        // Get organization
        const { data: org, error: orgError } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", slug)
            .single()

        if (orgError || !org) {
            return { success: false, error: "Organización no encontrada" }
        }

        // Get order
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .eq("organization_id", org.id)
            .single()

        if (orderError || !order) {
            return { success: false, error: "Pedido no encontrado" }
        }

        // Check if order can be retried
        if (order.payment_status === 'paid') {
            return { success: false, error: "Este pedido ya fue pagado" }
        }

        if (order.payment_method === 'manual') {
            return { success: false, error: "Este pedido usa pago manual" }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const customerInfo = order.customer_info as any

        // Initiate payment again
        const paymentResult = await paymentService.initiatePayment({
            orderId: order.id,
            organizationId: org.id,
            amount: Math.round(order.total * 100), // Convert to cents
            currency: 'COP',
            customerEmail: customerInfo?.email || '',
            customerName: customerInfo?.name || '',
            customerDocument: customerInfo?.document_number || '',
            customerDocumentType: customerInfo?.document_type || 'CC',
            customerPhone: customerInfo?.phone || '',
            returnUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://landingchat.co'}/store/${slug}/order/${order.id}`,
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
