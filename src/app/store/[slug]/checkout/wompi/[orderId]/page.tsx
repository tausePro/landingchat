/**
 * Página de Checkout de Wompi
 * Genera la firma de integridad server-side y carga el Widget oficial de Wompi
 * Los datos de pago NUNCA pasan por nuestros servidores - van directo a Wompi
 */

import crypto from "crypto"
import { createServiceClient } from "@/lib/supabase/server"
import {
    appendStorefrontAccessParam,
    createStorefrontOrderAccessToken,
} from "@/lib/storefrontAccess"
import { notFound, redirect } from "next/navigation"
import { decrypt } from "@/lib/utils/encryption"
import { WompiCheckoutClient } from "./components/wompi-checkout-client"
import { getOrderDetails } from "../../../actions"

interface PageProps {
    params: Promise<{
        slug: string
        orderId: string
    }>
    searchParams: Promise<{
        access?: string
    }>
}

export default async function WompiCheckoutPage({ params, searchParams }: PageProps) {
    const { slug, orderId } = await params
    const { access } = await searchParams
    const result = await getOrderDetails(slug, orderId, access)

    if (!result) {
        notFound()
    }

    const { order, organization } = result
    const supabase = createServiceClient()
    const customDomain = organization.custom_domain
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://landingchat.co"

    let baseUrl: string
    if (customDomain) {
        baseUrl = `https://${customDomain}`
    } else if (appUrl.includes("localhost") || appUrl.includes("127.0.0.1")) {
        baseUrl = `${appUrl}/store/${slug}`
    } else {
        baseUrl = `https://${slug}.landingchat.co`
    }

    const orderAccessToken = access || createStorefrontOrderAccessToken({
        slug,
        organizationId: organization.id,
        orderId: order.id,
        customerId: order.customer_id ?? null,
    })
    const orderUrl = appendStorefrontAccessParam(`${baseUrl}/order/${orderId}`, orderAccessToken)
    const gatewayErrorUrl = appendStorefrontAccessParam(`${baseUrl}/order/${orderId}/error?reason=gateway_not_configured`, orderAccessToken)
    const integrityErrorUrl = appendStorefrontAccessParam(`${baseUrl}/order/${orderId}/error?reason=integrity_secret_error`, orderAccessToken)
    const integrityMissingUrl = appendStorefrontAccessParam(`${baseUrl}/order/${orderId}/error?reason=integrity_secret_missing`, orderAccessToken)

    // 3. Verificar que la orden está pendiente de pago
    if (order.payment_status !== "pending") {
        redirect(orderUrl)
    }

    // 4. Obtener configuración de Wompi
    const { data: gatewayConfig, error: gatewayError } = await supabase
        .from("payment_gateway_configs")
        .select("*")
        .eq("organization_id", organization.id)
        .eq("provider", "wompi")
        .eq("is_active", true)
        .single()

    if (gatewayError || !gatewayConfig) {
        redirect(gatewayErrorUrl)
    }

    // 5. Desencriptar el secreto de integridad para generar la firma
    let integritySecret = ""
    try {
        if (gatewayConfig.integrity_secret_encrypted) {
            integritySecret = decrypt(gatewayConfig.integrity_secret_encrypted)
        }
    } catch {
        redirect(integrityErrorUrl)
    }

    if (!integritySecret) {
        redirect(integrityMissingUrl)
    }

    // 6. Generar la firma de integridad SHA256
    // Concatenar: reference + amountInCents + currency + integritySecret
    const amountInCents = Math.round(order.total * 100) // Wompi usa centavos
    const currency = "COP"
    const concatenated = `${orderId}${amountInCents}${currency}${integritySecret}`
    const signatureIntegrity = crypto
        .createHash("sha256")
        .update(concatenated)
        .digest("hex")

    // 8. Preparar datos para el Widget de Wompi
    const checkoutData = {
        publicKey: gatewayConfig.public_key,
        currency,
        amountInCents,
        reference: orderId,
        signatureIntegrity,
        redirectUrl: orderUrl,
        customerEmail: order.customer_info?.email || "",
        customerName: order.customer_info?.name || "",
        customerPhone: order.customer_info?.phone || "",
        storeName: organization.name || "Tienda",
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
