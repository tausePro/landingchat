"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/onboarding/progress-bar"
import { createClient } from "@/lib/supabase/client"
import {
    MessageCircle,
    Shield,
    AlertTriangle,
    ArrowRight,
    Loader2,
    CheckCircle2,
    Phone,
    Sparkles
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function WhatsAppOnboardingPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [connecting, setConnecting] = useState(false)
    const [metaConfig, setMetaConfig] = useState<{ app_id: string; config_id: string } | null>(null)
    const [whatsappInstance, setWhatsappInstance] = useState<{
        status: string
        provider: string
        phone_number_display?: string
    } | null>(null)
    const [showQRModal, setShowQRModal] = useState(false)
    const [qrCode, setQrCode] = useState("")
    const [instanceId, setInstanceId] = useState("")

    const supabase = createClient()

    // Load Meta config and check WhatsApp status
    useEffect(() => {
        const init = async () => {
            try {
                // Check if already connected
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    router.push("/login")
                    return
                }

                const { data: profile } = await supabase
                    .from("profiles")
                    .select("organization_id")
                    .eq("id", user.id)
                    .single()

                if (!profile?.organization_id) {
                    router.push("/onboarding/business")
                    return
                }

                // Check existing WhatsApp instance
                const { data: instance } = await supabase
                    .from("whatsapp_instances")
                    .select("status, provider, phone_number_display")
                    .eq("organization_id", profile.organization_id)
                    .eq("instance_type", "corporate")
                    .single()

                if (instance) {
                    setWhatsappInstance(instance)
                }

                // Load Meta config
                const res = await fetch("/api/meta-config")
                const data = await res.json()
                if (data.success && data.app_id && data.config_id) {
                    setMetaConfig({ app_id: data.app_id, config_id: data.config_id })
                }
            } catch (error) {
                console.error("Error initializing:", error)
            } finally {
                setLoading(false)
            }
        }

        init()
    }, [router, supabase])

    const isConnected = whatsappInstance?.status === "connected"

    // Handler for Meta Embedded Signup
    const handleMetaConnect = () => {
        if (!metaConfig) {
            toast.error("Configuración de Meta no disponible")
            return
        }

        setConnecting(true)

        // Load Facebook SDK and trigger login
        // This is simplified - the full implementation is in the dashboard
        window.location.href = `/dashboard/settings/whatsapp?connect=meta`
    }

    // Handler for Evolution QR
    const handleQRConnect = async () => {
        setConnecting(true)
        try {
            const res = await fetch("/api/whatsapp/connect", { method: "POST" })
            const data = await res.json()

            if (data.success && data.qr_code) {
                setQrCode(data.qr_code)
                setInstanceId(data.instance_id)
                setShowQRModal(true)
            } else {
                toast.error("Error al generar código QR")
            }
        } catch {
            toast.error("Error de conexión")
        } finally {
            setConnecting(false)
        }
    }

    const handleSkip = () => {
        router.push("/dashboard")
    }

    const handleContinue = () => {
        router.push("/onboarding/test")
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="mt-4 text-slate-500">Cargando...</p>
            </div>
        )
    }

    return (
        <>
            <ProgressBar currentStep={2} totalSteps={3} stepLabel="Conectar WhatsApp" />

            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight sm:text-4xl">
                    Conecta tu WhatsApp
                </h1>
                <p className="text-base font-normal text-slate-600 dark:text-slate-400">
                    Tu agente responderá automáticamente a los mensajes de tus clientes.
                </p>
            </div>

            <div className="flex flex-col gap-6">
                {isConnected ? (
                    /* Already connected state */
                    <div className="rounded-2xl border-2 border-green-500 bg-green-50 dark:bg-green-900/20 p-8">
                        <div className="flex items-center gap-4">
                            <div className="size-16 bg-green-500 rounded-2xl flex items-center justify-center text-white">
                                <CheckCircle2 className="size-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-green-800 dark:text-green-200">
                                    ¡WhatsApp Conectado!
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <Phone className="size-4 text-green-600" />
                                    <span className="text-green-700 dark:text-green-300">
                                        ****{whatsappInstance?.phone_number_display}
                                    </span>
                                    <span className={cn(
                                        "text-xs px-2 py-0.5 rounded-full",
                                        whatsappInstance?.provider === "meta"
                                            ? "bg-blue-100 text-blue-700"
                                            : "bg-orange-100 text-orange-700"
                                    )}>
                                        {whatsappInstance?.provider === "meta" ? "API Oficial" : "Evolution"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={handleContinue}
                            className="w-full mt-6 h-12 text-base font-semibold gap-2"
                        >
                            <Sparkles className="size-4" />
                            Probar mi Agente
                            <ArrowRight className="size-4" />
                        </Button>
                    </div>
                ) : (
                    /* Connection options */
                    <>
                        {/* Meta Cloud API - Recommended */}
                        {metaConfig && (
                            <div className="rounded-2xl border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 p-6 hover:border-blue-400 transition-colors">
                                <div className="flex items-start gap-4">
                                    <div className="size-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
                                        <Shield className="size-7 text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                                WhatsApp Business API
                                            </h3>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
                                                Recomendado
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                            Conexión oficial de Meta. Sin riesgo de bloqueo, mayor confiabilidad.
                                        </p>
                                        <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                                            <li className="flex items-center gap-2">
                                                <CheckCircle2 className="size-4 text-green-500" />
                                                API oficial de Meta
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle2 className="size-4 text-green-500" />
                                                Mensajes ilimitados
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle2 className="size-4 text-green-500" />
                                                Badge verificado
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                                <Button
                                    onClick={handleMetaConnect}
                                    disabled={connecting}
                                    className="w-full mt-4 h-12 bg-[#1877F2] hover:bg-[#166FE5] text-white text-base font-semibold"
                                >
                                    {connecting ? (
                                        <Loader2 className="size-4 animate-spin mr-2" />
                                    ) : (
                                        <MessageCircle className="size-4 mr-2" />
                                    )}
                                    Conectar con Meta
                                </Button>
                            </div>
                        )}

                        {/* Divider */}
                        {metaConfig && (
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-slate-50 dark:bg-slate-900 px-3 text-slate-400">
                                        o
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Evolution QR - Alternative */}
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
                            <div className="flex items-start gap-4">
                                <div className="size-14 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center">
                                    <AlertTriangle className="size-7 text-orange-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                        Conexión por QR
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                        Conecta escaneando un código QR. Más rápido pero no oficial.
                                    </p>
                                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                                        ⚠️ Meta puede bloquear números conectados de esta forma
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                onClick={handleQRConnect}
                                disabled={connecting}
                                className="w-full mt-4 h-12 text-base"
                            >
                                {connecting ? (
                                    <Loader2 className="size-4 animate-spin mr-2" />
                                ) : null}
                                Conectar con QR
                            </Button>
                        </div>
                    </>
                )}

                {/* Skip option */}
                {!isConnected && (
                    <div className="text-center pt-4">
                        <button
                            onClick={handleSkip}
                            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                        >
                            Omitir por ahora y configurar después →
                        </button>
                    </div>
                )}
            </div>

            {/* QR Modal would go here - simplified for now */}
            {showQRModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-center mb-4">Escanea el código QR</h3>
                        <div className="flex justify-center">
                            {qrCode && (
                                <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                            )}
                        </div>
                        <p className="text-sm text-slate-500 text-center mt-4">
                            Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo
                        </p>
                        <Button
                            variant="outline"
                            onClick={() => setShowQRModal(false)}
                            className="w-full mt-6"
                        >
                            Cancelar
                        </Button>
                    </div>
                </div>
            )}
        </>
    )
}
