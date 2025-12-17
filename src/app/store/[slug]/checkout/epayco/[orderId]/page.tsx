/**
 * Página de Checkout de ePayco
 * Esta página carga el script oficial de ePayco y abre el checkout automáticamente
 * Los datos de pago NUNCA pasan por nuestros servidores - van directo a ePayco
 */

import { createServiceClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import { EpaycoCheckoutClient } from "./components/epayco-checkout-client"

interface PageProps {
    params: Promise<{
        slug: string
        orderId: string
    }>
}

export default async function EpaycoCheckoutPage({ params }: PageProps) {
    const { slug, orderId } = await params
    const supabase = createServiceClient()

    // 1. Obtener la orden con datos de la organización incluyendo custom_domain
    const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("*, organization:organizations(id, name, slug, settings, custom_domain)")
        .eq("id", orderId)
        .single()

    if (orderError || !order) {
        notFound()
    }

    // 2. Verificar que la orden pertenece a la tienda correcta
    if (order.organization?.slug !== slug) {
        notFound()
    }

    // 3. Verificar que la orden está pendiente de pago
    if (order.payment_status !== "pending") {
        redirect(`/store/${slug}/order/${orderId}`)
    }

    // 4. Obtener configuración de ePayco
    const { data: gatewayConfig, error: gatewayError } = await supabase
        .from("payment_gateway_configs")
        .select("public_key, is_test_mode")
        .eq("organization_id", order.organization_id)
        .eq("provider", "epayco")
        .eq("is_active", true)
        .single()

    if (gatewayError || !gatewayConfig) {
        redirect(`/store/${slug}/order/${orderId}/error?reason=gateway_not_configured`)
    }

    // 5. Construir la URL base correcta
    // Para subdominios de landingchat.co, usar el subdominio
    // Para dominios personalizados, usar el dominio personalizado
    const customDomain = (order.organization as { custom_domain?: string })?.custom_domain
    
    let baseUrl: string
    if (customDomain) {
        // Dominio personalizado: https://tez.com.co
        baseUrl = `https://${customDomain}`
    } else {
        // Subdominio de landingchat.co: https://tez.landingchat.co
        baseUrl = `https://${slug}.landingchat.co`
    }

    // 6. Preparar datos para el checkout de ePayco
    const checkoutData = {
        // Llaves de ePayco (solo la pública, nunca la privada)
        publicKey: gatewayConfig.public_key,
        isTestMode: gatewayConfig.is_test_mode,
        
        // Datos de la transacción
        orderId: order.id,
        orderNumber: order.order_number,
        amount: Math.round(order.total), // ePayco usa pesos, no centavos
        currency: "COP",
        description: `Orden ${order.order_number}`,
        
        // Datos del cliente (solo los necesarios para ePayco)
        customerName: order.customer_info?.name || "",
        customerEmail: order.customer_info?.email || "",
        
        // URLs de respuesta - usar el dominio correcto de la tienda
        responseUrl: customDomain 
            ? `${baseUrl}/order/${orderId}` 
            : `${baseUrl}/order/${orderId}`,
        confirmationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/payments/epayco?org=${slug}`,
        
        // Información de la tienda
        storeName: order.organization?.name || "Tienda",
        storeSlug: slug,
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 text-center">
                <div className="mb-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-primary animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                        Procesando tu pago
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Serás redirigido al checkout seguro de ePayco
                    </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-500 dark:text-slate-400 text-sm">Orden</span>
                        <span className="font-medium text-slate-900 dark:text-white">{order.order_number}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400 text-sm">Total</span>
                        <span className="font-bold text-lg text-primary">
                            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(order.total)}
                        </span>
                    </div>
                </div>

                {/* Componente cliente que carga el script de ePayco */}
                <EpaycoCheckoutClient data={checkoutData} />

                <p className="text-xs text-slate-400 mt-6">
                    Pago seguro procesado por ePayco. Tus datos están protegidos.
                </p>
            </div>
        </div>
    )
}
