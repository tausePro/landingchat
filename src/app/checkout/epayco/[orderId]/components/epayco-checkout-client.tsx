"use client"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"

interface EpaycoCheckoutData {
    publicKey: string
    isTestMode: boolean
    orderId: string
    orderNumber: string
    amount: number
    currency: string
    description: string
    customerName: string
    customerEmail: string
    responseUrl: string
    confirmationUrl: string
    storeName: string
    storeSlug: string
}

interface EpaycoCheckoutClientProps {
    data: EpaycoCheckoutData
}

// Declaración de tipos para ePayco
declare global {
    interface Window {
        ePayco?: {
            checkout: {
                configure: (config: Record<string, unknown>) => {
                    open: (params: Record<string, unknown>) => void
                }
            }
        }
    }
}

export function EpaycoCheckoutClient({ data }: EpaycoCheckoutClientProps) {
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const checkoutOpened = useRef(false)

    const openCheckout = () => {
        if (!window.ePayco || checkoutOpened.current) return
        
        checkoutOpened.current = true
        setIsLoading(false)

        try {
            const handler = window.ePayco.checkout.configure({
                key: data.publicKey,
                test: data.isTestMode,
            })

            handler.open({
                // Información de la transacción
                name: data.description,
                description: data.description,
                invoice: data.orderId,
                currency: data.currency,
                amount: String(data.amount),
                tax_base: String(data.amount),
                tax: "0",
                
                // País
                country: "co",
                lang: "es",
                
                // Información del cliente
                name_billing: data.customerName,
                email_billing: data.customerEmail,
                
                // URLs de respuesta
                response: data.responseUrl,
                confirmation: data.confirmationUrl,
                
                // Referencia externa (nuestro ID de orden)
                external: "true",
                extra1: data.orderId,
                extra2: data.storeSlug,
                extra3: data.orderNumber,
                
                // Configuración del checkout
                autoclick: "true", // Abre automáticamente
                method_confirmation: "GET",
            })
        } catch (err) {
            console.error("[ePayco] Error opening checkout:", err)
            setError("Error al abrir el checkout de ePayco")
        }
    }

    useEffect(() => {
        // Si el script ya está cargado, abrir checkout
        if (window.ePayco && !checkoutOpened.current) {
            openCheckout()
        }
    }, [])

    const handleScriptLoad = () => {
        // Pequeño delay para asegurar que ePayco esté listo
        setTimeout(() => {
            openCheckout()
        }, 500)
    }

    const handleScriptError = () => {
        setIsLoading(false)
        setError("Error al cargar el checkout de ePayco")
    }

    const handleRetry = () => {
        checkoutOpened.current = false
        setError(null)
        setIsLoading(true)
        openCheckout()
    }

    return (
        <>
            {/* Script oficial de ePayco */}
            <Script
                src="https://checkout.epayco.co/checkout.js"
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
                    Abrir checkout de ePayco
                </button>
            )}
        </>
    )
}
