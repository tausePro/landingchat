"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface EmbeddedSignupProps {
    appId: string
    configId: string
    onSuccess: () => void
}

// Declarar tipo global para Facebook SDK
declare global {
    interface Window {
        FB: {
            init: (params: {
                appId: string
                cookie: boolean
                xfbml: boolean
                version: string
            }) => void
            login: (
                callback: (response: FBLoginResponse) => void,
                options: Record<string, unknown>
            ) => void
        }
        fbAsyncInit: () => void
    }
}

interface FBLoginResponse {
    authResponse?: {
        code?: string
        accessToken?: string
    }
    status: "connected" | "not_authorized" | "unknown"
}

/**
 * Componente para conectar WhatsApp Business via Meta Embedded Signup
 *
 * Carga el SDK de Facebook, inicia el flujo de Embedded Signup,
 * y envía las credenciales al backend para guardarlas.
 */
export function EmbeddedSignup({ appId, configId, onSuccess }: EmbeddedSignupProps) {
    const [loading, setLoading] = useState(false)
    const [sdkLoaded, setSdkLoaded] = useState(false)

    // Cargar Facebook SDK
    useEffect(() => {
        if (window.FB) {
            setSdkLoaded(true)
            return
        }

        window.fbAsyncInit = function () {
            window.FB.init({
                appId,
                cookie: true,
                xfbml: true,
                version: "v21.0",
            })
            setSdkLoaded(true)
        }

        // Cargar el SDK script
        const script = document.createElement("script")
        script.src = "https://connect.facebook.net/en_US/sdk.js"
        script.async = true
        script.defer = true
        document.body.appendChild(script)

        return () => {
            // Cleanup si el componente se desmonta
            const existingScript = document.querySelector('script[src="https://connect.facebook.net/en_US/sdk.js"]')
            if (existingScript) {
                existingScript.remove()
            }
        }
    }, [appId])

    // Escuchar mensajes del Embedded Signup popup (sessionInfoListener)
    const handleMessage = useCallback(async (event: MessageEvent) => {
        // Solo procesar mensajes del dominio de Facebook
        if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") {
            return
        }

        try {
            const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data

            // Capturar datos del Embedded Signup cuando termina
            if (data.type === "WA_EMBEDDED_SIGNUP") {
                if (data.event === "FINISH" && data.data) {
                    const phoneNumberId = data.data.phone_number_id
                    const wabaId = data.data.waba_id

                    if (phoneNumberId && wabaId) {
                        console.log("[EmbeddedSignup] Received signup data:", { phoneNumberId, wabaId })
                        // Guardar en sessionStorage para usar en el callback de FB.login
                        sessionStorage.setItem("wa_phone_number_id", phoneNumberId)
                        sessionStorage.setItem("wa_waba_id", wabaId)
                    }
                } else if (data.event === "CANCEL") {
                    console.log("[EmbeddedSignup] User cancelled signup")
                    setLoading(false)
                } else if (data.event === "ERROR") {
                    console.error("[EmbeddedSignup] Error from Meta:", data.data)
                    toast.error("Error en el proceso de conexión")
                    setLoading(false)
                }
            }
        } catch {
            // No es un mensaje JSON, ignorar
        }
    }, [])

    useEffect(() => {
        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [handleMessage])

    const handleConnect = () => {
        if (!window.FB) {
            toast.error("Facebook SDK no cargado. Recarga la p\u00e1gina.")
            return
        }

        if (!configId) {
            toast.error("Configuration ID no configurado. Contacta al administrador.")
            return
        }

        setLoading(true)

        window.FB.login(
            async (response: FBLoginResponse) => {
                if (response.authResponse?.code) {
                    // Tenemos el code, ahora necesitamos phone_number_id y waba_id
                    // Estos vienen del mensaje de FINISH del Embedded Signup
                    // Pero Meta también los envía como parte del auth response en el session-info callback

                    try {
                        // Enviar code al backend para intercambiar por token
                        // El phone_number_id y waba_id se obtienen via el session-info callback
                        // que Meta envía como window message
                        const code = response.authResponse.code

                        // Esperar un momento para que el mensaje de FINISH llegue
                        await new Promise(resolve => setTimeout(resolve, 1000))

                        // Intentar obtener phone_number_id y waba_id del session storage
                        // (se guardaron en el handleMessage)
                        // Si no tenemos los datos del popup, usar Graph API para obtenerlos
                        const callbackResponse = await fetch("/api/auth/whatsapp-meta/callback", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                code,
                                // Estos valores se obtienen del Embedded Signup popup
                                // Temporalmente usar placeholders — se actualizarán cuando Meta los envíe
                                phone_number_id: sessionStorage.getItem("wa_phone_number_id") || "",
                                waba_id: sessionStorage.getItem("wa_waba_id") || "",
                            }),
                        })

                        const result = await callbackResponse.json()

                        if (result.success) {
                            toast.success("WhatsApp Business conectado exitosamente")
                            onSuccess()
                        } else {
                            toast.error(result.error || "Error al conectar WhatsApp Business")
                        }
                    } catch (error) {
                        console.error("[EmbeddedSignup] Error:", error)
                        toast.error("Error al procesar la conexi\u00f3n")
                    }
                } else {
                    toast.error("No se complet\u00f3 la autorizaci\u00f3n")
                }

                setLoading(false)
            },
            {
                config_id: configId,
                response_type: "code",
                override_default_response_type: true,
                extras: {
                    setup: {},
                    featureType: "",
                    sessionInfoVersion: 2,
                },
            }
        )
    }

    return (
        <Button
            onClick={handleConnect}
            disabled={loading || !sdkLoaded}
            className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white"
        >
            {loading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Conectando...
                </>
            ) : !sdkLoaded ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cargando Facebook SDK...
                </>
            ) : (
                <>
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Conectar WhatsApp Business
                </>
            )}
        </Button>
    )
}
