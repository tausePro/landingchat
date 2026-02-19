/**
 * Página de Checkout de Wompi para dominios personalizados
 * Soporta tanto dominios personalizados como subdominios de landingchat.co
 * Los datos de pago NUNCA pasan por nuestros servidores - van directo a Wompi
 */

import crypto from "crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import { headers } from "next/headers"
import { decrypt } from "@/lib/utils/encryption"
import { WompiCheckoutClient } from "@/app/store/[slug]/checkout/wompi/[orderId]/components/wompi-checkout-client"

interface PageProps {
    params: Promise<{
        orderId: string
    }>
}

export default async function WompiCheckoutPage({ params }: PageProps) {
    const { orderId } = await params
    const supabase = createServiceClient()

    // Obtener el hostname para determinar la organización
    const headersList = await headers()
    const host = headersList.get("host") || ""

    // 1. Buscar la organización: primero por custom_domain, luego por subdominio
    let org: { id: string; name: string; slug: string; custom_domain: string | null } | null = null

    // Intento 1: Dominio personalizado (ej: tienda.miempresa.com)
    const { data: orgByDomain } = await supabase
        .from("organizations")
        .select("id, name, slug, custom_domain")
        .eq("custom_domain", host)
        .single()

    if (orgByDomain) {
        org = orgByDomain
    } else {
        // Intento 2: Subdominio de landingchat.co (ej: tez.landingchat.co)
        const parts = host.split(".")
        const isSubdomain = parts.length >= 3 && host.includes("landingchat.co")
        const isLocalSubdomain = parts.length > 1 && (host.includes("localhost") || host.includes("127.0.0.1"))

        const slug = isSubdomain ? parts[0] : isLocalSubdomain ? parts[0] : null

        if (slug) {
            const { data: orgBySlug } = await supabase
                .from("organizations")
                .select("id, name, slug, custom_domain")
                .eq("slug", slug)
                .single()

            org = orgBySlug
        }
    }

    if (!org) {
        console.error("[WompiCheckout] Organization not found for host:", host)
        notFound()
    }

    // 2. Obtener la orden
    const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("organization_id", org.id)
        .single()

    if (orderError || !order) {
        console.error("[WompiCheckout] Order not found:", orderId)
        notFound()
    }

    // 3. Verificar que la orden está pendiente de pago
    if (order.payment_status !== "pending") {
        redirect(`/order/${orderId}`)
    }

    // 4. Obtener configuración de Wompi
    const { data: gatewayConfig, error: gatewayError } = await supabase
        .from("payment_gateway_configs")
        .select("*")
        .eq("organization_id", org.id)
        .eq("provider", "wompi")
        .eq("is_active", true)
        .single()

    if (gatewayError || !gatewayConfig) {
        redirect(`/order/${orderId}/error?reason=gateway_not_configured`)
    }

    // 5. Desencriptar el secreto de integridad
    let integritySecret = ""
    try {
        if (gatewayConfig.integrity_secret_encrypted) {
            integritySecret = decrypt(gatewayConfig.integrity_secret_encrypted)
        }
    } catch {
        redirect(`/order/${orderId}/error?reason=integrity_secret_error`)
    }

    if (!integritySecret) {
        redirect(`/order/${orderId}/error?reason=integrity_secret_missing`)
    }

    // 6. Generar la firma de integridad SHA256
    const amountInCents = Math.round(order.total * 100) // Wompi usa centavos
    const currency = "COP"
    const concatenated = `${orderId}${amountInCents}${currency}${integritySecret}`
    const signatureIntegrity = crypto
        .createHash("sha256")
        .update(concatenated)
        .digest("hex")

    // 7. Construir la URL base
    const baseUrl = org.custom_domain
        ? `https://${org.custom_domain}`
        : `https://${org.slug}.landingchat.co`

    // 8. Preparar datos para el Widget de Wompi
    const checkoutData = {
        publicKey: gatewayConfig.public_key,
        currency,
        amountInCents,
        reference: orderId,
        signatureIntegrity,
        redirectUrl: `${baseUrl}/order/${orderId}`,
        customerEmail: order.customer_info?.email || "",
        customerName: order.customer_info?.name || "",
        customerPhone: order.customer_info?.phone || "",
        storeName: org.name || "Tienda",
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
                        Serás redirigido al checkout seguro de Wompi
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

                {/* Componente cliente que carga el Widget de Wompi */}
                <WompiCheckoutClient data={checkoutData} />

                <p className="text-xs text-slate-400 mt-6">
                    Pago seguro procesado por Wompi (Bancolombia). Tus datos están protegidos.
                </p>
            </div>
        </div>
    )
}
