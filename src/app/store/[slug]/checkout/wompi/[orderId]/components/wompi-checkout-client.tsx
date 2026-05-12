"use client"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"

interface WompiCheckoutData {
    publicKey: string
    currency: string
    amountInCents: number
    reference: string
    signatureIntegrity: string
    redirectUrl: string
    customerEmail: string
    customerName: string
    customerPhone: string
    storeName: string
}

interface WompiCheckoutClientProps {
    data: WompiCheckoutData
}

// Declaración de tipos para Wompi Widget
declare global {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const WidgetCheckout: any
}

export function WompiCheckoutClient({ data }: WompiCheckoutClientProps) {
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const checkoutOpened = useRef(false)

    const openCheckout = () => {
        if (typeof WidgetCheckout === "undefined" || checkoutOpened.current) return

        checkoutOpened.current = true
        setIsLoading(false)

        try {
            const checkout = new WidgetCheckout({
                currency: data.currency,
                amountInCents: data.amountInCents,
                reference: data.reference,
                publicKey: data.publicKey,
                signature: { integrity: data.signatureIntegrity },
                redirectUrl: data.redirectUrl,
                customerData: {
                    email: data.customerEmail,
                    fullName: data.customerName,
                    phoneNumber: data.customerPhone,
                    phoneNumberPrefix: "+57",
                },
            })

            checkout.open(function (result: { transaction?: { id: string; status: string } }) {
                const transaction = result.transaction
                if (transaction) {
                    console.log("[Wompi] Transaction completed:", transaction.id, transaction.status)
                }
                // El widget v2 con callback NO redirige automáticamente cuando
                // el desarrollador define un handler. Forzamos la redirección al
                // order tracking para que el comprador siempre llegue a la
                // vista de seguimiento, sin importar el status final.
                if (data.redirectUrl) {
                    window.location.href = data.redirectUrl
                }
            })
        } catch (err) {
            console.error("[Wompi] Error opening checkout:", err)
            setError("Error al abrir el checkout de Wompi")
        }
    }

    useEffect(() => {
        // Si el script ya está cargado, abrir checkout
        if (typeof WidgetCheckout !== "undefined" && !checkoutOpened.current) {
            openCheckout()
        }
    }, [])

    const handleScriptLoad = () => {
        // Pequeño delay para asegurar que WidgetCheckout esté listo
        setTimeout(() => {
            openCheckout()
        }, 500)
    }

    const handleScriptError = () => {
        setIsLoading(false)
        setError("Error al cargar el checkout de Wompi")
    }

    const handleRetry = () => {
        checkoutOpened.current = false
        setError(null)
        setIsLoading(true)
        openCheckout()
    }

    return (
        <>
            {/* Script oficial del Widget de Wompi */}
            <Script
                src="https://checkout.wompi.co/widget.js"
                onLoad={handleScriptLoad}
                onError={handleScriptError}
                strategy="afterInteractive"
            />

            {isLoading && !error && (
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-500">Cargando checkout seguro...</p>
                </div>
            )}

            {error && (
                <div className="text-center">
                    <p className="text-red-500 mb-4">{error}</p>
                    <button
                        onClick={handleRetry}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {!isLoading && !error && (
                <button
                    onClick={handleRetry}
                    className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
                >
                    Abrir checkout de Wompi
                </button>
            )}
        </>
    )
}
