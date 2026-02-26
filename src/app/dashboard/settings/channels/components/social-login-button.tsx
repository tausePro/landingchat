"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Loader2, Instagram, MessageCircle } from "lucide-react"

interface SocialLoginButtonProps {
    appId: string
    platform: "instagram" | "messenger"
    onSuccess: () => void
}

interface FBLoginResponse {
    authResponse?: {
        accessToken?: string
        userID?: string
    }
    status: "connected" | "not_authorized" | "unknown"
}

const PLATFORM_CONFIG = {
    instagram: {
        scope: "instagram_basic,instagram_manage_messages,pages_show_list,pages_messaging",
        label: "Conectar Instagram",
        icon: Instagram,
        color: "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 hover:from-purple-600 hover:via-pink-600 hover:to-orange-500",
    },
    messenger: {
        scope: "pages_messaging,pages_show_list,pages_manage_metadata",
        label: "Conectar Messenger",
        icon: MessageCircle,
        color: "bg-[#0084FF] hover:bg-[#0073E6]",
    },
}

export function SocialLoginButton({ appId, platform, onSuccess }: SocialLoginButtonProps) {
    const [loading, setLoading] = useState(false)
    const [sdkLoaded, setSdkLoaded] = useState(false)

    const config = PLATFORM_CONFIG[platform]
    const Icon = config.icon

    // Cargar Facebook SDK (usa polling para evitar conflictos entre múltiples instancias)
    useEffect(() => {
        if (window.FB) {
            setSdkLoaded(true)
            return
        }

        // Configurar fbAsyncInit solo si no existe ya
        if (!window.fbAsyncInit) {
            window.fbAsyncInit = function () {
                window.FB.init({
                    appId,
                    cookie: true,
                    xfbml: true,
                    version: "v24.0",
                })
            }
        }

        // Cargar script solo si no existe
        const existingScript = document.querySelector('script[src="https://connect.facebook.net/en_US/sdk.js"]')
        if (!existingScript) {
            const script = document.createElement("script")
            script.src = "https://connect.facebook.net/en_US/sdk.js"
            script.async = true
            script.defer = true
            document.body.appendChild(script)
        }

        // Polling: detectar cuando el SDK esté listo (funciona para todas las instancias)
        const interval = setInterval(() => {
            if (window.FB) {
                setSdkLoaded(true)
                clearInterval(interval)
            }
        }, 150)

        return () => clearInterval(interval)
    }, [appId])

    const processLoginResponse = useCallback(async (accessToken: string) => {
        try {
            const res = await fetch("/api/auth/social-channels/callback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    access_token: accessToken,
                    platform,
                }),
            })

            const result = await res.json()

            if (result.needs_selection) {
                // TODO: mostrar selector de páginas si hay varias
                // Por ahora, usar la primera
                const firstPage = result.pages[0]
                const retryRes = await fetch("/api/auth/social-channels/callback", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        access_token: accessToken,
                        platform,
                        selected_page_id: firstPage.id,
                    }),
                })
                const retryResult = await retryRes.json()

                if (retryResult.success) {
                    const channelName = platform === "instagram"
                        ? retryResult.username || "Instagram"
                        : retryResult.page_name || "Messenger"
                    toast.success(`${channelName} conectado exitosamente`)
                    onSuccess()
                } else {
                    toast.error(retryResult.error || "Error al conectar")
                }
            } else if (result.success) {
                const channelName = platform === "instagram"
                    ? result.username || "Instagram"
                    : result.page_name || "Messenger"
                toast.success(`${channelName} conectado exitosamente`)
                onSuccess()
            } else {
                toast.error(result.error || "Error al conectar")
            }
        } catch (error) {
            console.error(`[SocialLoginButton] Error:`, error)
            toast.error("Error al procesar la conexión")
        } finally {
            setLoading(false)
        }
    }, [platform, onSuccess])

    const handleConnect = () => {
        if (!window.FB) {
            toast.error("Facebook SDK no cargado. Recarga la página.")
            return
        }

        setLoading(true)

        window.FB.login(
            (response: FBLoginResponse) => {
                if (response.authResponse?.accessToken) {
                    processLoginResponse(response.authResponse.accessToken)
                } else {
                    toast.error("No se completó la autorización")
                    setLoading(false)
                }
            },
            {
                scope: config.scope,
                return_scopes: true,
            }
        )
    }

    return (
        <Button
            onClick={handleConnect}
            disabled={loading || !sdkLoaded}
            className={`w-full text-white ${config.color}`}
        >
            {loading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Conectando...
                </>
            ) : !sdkLoaded ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cargando...
                </>
            ) : (
                <>
                    <Icon className="mr-2 h-5 w-5" />
                    {config.label}
                </>
            )}
        </Button>
    )
}
