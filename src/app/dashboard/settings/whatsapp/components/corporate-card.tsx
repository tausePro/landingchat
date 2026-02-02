"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Phone, TrendingUp, Shield, AlertTriangle } from "lucide-react"
import { QRModal } from "./qr-modal"
import { EmbeddedSignup } from "./embedded-signup"
import { connectWhatsApp, disconnectWhatsApp, getMetaSignupConfig } from "../actions"
import { toast } from "sonner"
import type { WhatsAppInstance } from "@/types"

interface CorporateCardProps {
    instance: WhatsAppInstance | null
    planLimit: number
    onUpdate: () => void
}

export function CorporateCard({ instance, planLimit, onUpdate }: CorporateCardProps) {
    const [isConnecting, setIsConnecting] = useState(false)
    const [isDisconnecting, setIsDisconnecting] = useState(false)
    const [showQRModal, setShowQRModal] = useState(false)
    const [qrCode, setQrCode] = useState<string>("")
    const [instanceId, setInstanceId] = useState<string>("")
    const [metaConfig, setMetaConfig] = useState<{ app_id: string; config_id: string } | null>(null)
    const [loadingConfig, setLoadingConfig] = useState(true)

    const isConnected = instance?.status === "connected"
    const isConnecting_status = instance?.status === "connecting"
    const provider = instance?.provider || "evolution"

    // Cargar configuración de Meta al montar
    useEffect(() => {
        async function loadMetaConfig() {
            try {
                const result = await getMetaSignupConfig()
                if (result.success && result.data) {
                    setMetaConfig(result.data)
                }
            } catch {
                // Si falla, simplemente no mostramos la opción Meta
            } finally {
                setLoadingConfig(false)
            }
        }
        loadMetaConfig()
    }, [])

    // Handler para conectar via Evolution (QR) - legacy
    const handleConnectEvolution = async () => {
        setIsConnecting(true)
        try {
            const result = await connectWhatsApp()
            if (result.success && result.data) {
                setQrCode(result.data.qr_code)
                setInstanceId(result.data.instance_id)
                setShowQRModal(true)
                toast.success("Escanea el código QR con tu WhatsApp")
            } else {
                toast.error("Error al conectar")
            }
        } catch {
            toast.error("Error al conectar WhatsApp")
        } finally {
            setIsConnecting(false)
        }
    }

    // Handler para cuando Meta Embedded Signup completa
    const handleMetaSuccess = () => {
        toast.success("WhatsApp Business conectado exitosamente")
        onUpdate()
    }

    const handleDisconnect = async () => {
        if (!confirm("¿Estás seguro de desconectar WhatsApp?")) return

        setIsDisconnecting(true)
        try {
            const result = await disconnectWhatsApp()
            if (result.success) {
                toast.success("WhatsApp desconectado")
                onUpdate()
            } else {
                toast.error("Error al desconectar")
            }
        } catch {
            toast.error("Error al desconectar WhatsApp")
        } finally {
            setIsDisconnecting(false)
        }
    }

    const handleQRModalClose = () => {
        setShowQRModal(false)
        onUpdate()
    }

    const usagePercentage = instance && planLimit > 0
        ? Math.round((instance.conversations_this_month / planLimit) * 100)
        : 0

    return (
        <>
            <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="flex gap-3">
                            <MessageSquare className="h-6 w-6 text-gray-700 dark:text-gray-300 mt-0.5" />
                            <div>
                                <CardTitle className="text-xl font-bold">
                                    WhatsApp Corporativo
                                </CardTitle>
                                <CardDescription className="text-sm mt-1">
                                    Conecta tu WhatsApp para atender clientes
                                </CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {isConnected && (
                                <Badge
                                    variant="outline"
                                    className={
                                        provider === "meta"
                                            ? "border-blue-500 text-blue-600 dark:text-blue-400 text-xs"
                                            : "border-orange-500 text-orange-600 dark:text-orange-400 text-xs"
                                    }
                                >
                                    {provider === "meta" ? (
                                        <><Shield className="h-3 w-3 mr-1" />Oficial</>
                                    ) : (
                                        <><AlertTriangle className="h-3 w-3 mr-1" />Evolution</>
                                    )}
                                </Badge>
                            )}
                            <Badge
                                variant={isConnected ? "default" : "secondary"}
                                className={
                                    isConnected
                                        ? "bg-green-500 hover:bg-green-600 text-white"
                                        : "text-gray-600 dark:text-gray-400"
                                }
                            >
                                {isConnected
                                    ? "Conectado"
                                    : isConnecting_status
                                      ? "Conectando..."
                                      : "Desconectado"}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isConnected && instance ? (
                        <>
                            <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">
                                    Número:
                                </span>
                                <span className="font-medium">
                                    ****{instance.phone_number_display}
                                </span>
                            </div>

                            {/* Alerta si está conectado via Evolution (riesgo de ban) */}
                            {provider === "evolution" && metaConfig && (
                                <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                                    <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                                    <div className="text-xs text-orange-700 dark:text-orange-300">
                                        <p className="font-medium">Conexión no oficial</p>
                                        <p className="mt-0.5">
                                            Esta conexión usa Evolution API (no oficial) y puede ser bloqueada por Meta.
                                            Te recomendamos migrar a WhatsApp Business API oficial.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">
                                        Conversaciones este mes
                                    </span>
                                    <span className="font-medium">
                                        {instance.conversations_this_month} /{" "}
                                        {planLimit === -1 ? "∞" : planLimit}
                                    </span>
                                </div>
                                {planLimit > 0 && (
                                    <>
                                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${
                                                    usagePercentage > 80
                                                        ? "bg-red-500"
                                                        : usagePercentage > 60
                                                          ? "bg-yellow-500"
                                                          : "bg-green-500"
                                                }`}
                                                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                                            />
                                        </div>
                                        {usagePercentage > 80 && (
                                            <p className="text-xs text-yellow-600 dark:text-yellow-500">
                                                Estás cerca del límite de tu plan
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">
                                        Mensajes enviados
                                    </p>
                                    <p className="text-2xl font-bold">
                                        {instance.messages_sent_this_month}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">
                                        Último mensaje
                                    </p>
                                    <p className="text-sm font-medium">
                                        {instance.last_message_at
                                            ? new Date(
                                                  instance.last_message_at
                                              ).toLocaleDateString()
                                            : "N/A"}
                                    </p>
                                </div>
                            </div>

                            <Button
                                variant="outline"
                                onClick={handleDisconnect}
                                disabled={isDisconnecting}
                                className="w-full border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                            >
                                {isDisconnecting
                                    ? "Desconectando..."
                                    : "Desconectar WhatsApp"}
                            </Button>
                        </>
                    ) : (
                        <>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <p>
                                    Conecta tu WhatsApp Business para recibir y
                                    responder mensajes de clientes directamente
                                    desde la plataforma.
                                </p>
                                <div className="flex items-start gap-2">
                                    <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <p>
                                        Tu plan incluye hasta{" "}
                                        <strong>{planLimit === -1 ? "ilimitadas" : planLimit}</strong>{" "}
                                        conversaciones por mes
                                    </p>
                                </div>
                            </div>

                            {/* Opción principal: Meta Cloud API (Embedded Signup) */}
                            {!loadingConfig && metaConfig && planLimit !== 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-blue-600" />
                                        <span className="text-sm font-medium">
                                            Conexión oficial (recomendada)
                                        </span>
                                    </div>
                                    <EmbeddedSignup
                                        appId={metaConfig.app_id}
                                        configId={metaConfig.config_id}
                                        onSuccess={handleMetaSuccess}
                                    />
                                    <p className="text-xs text-muted-foreground text-center">
                                        Usa la API oficial de Meta — sin riesgo de bloqueo
                                    </p>
                                </div>
                            )}

                            {/* Separador si ambas opciones están disponibles */}
                            {!loadingConfig && metaConfig && planLimit !== 0 && (
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-card px-2 text-muted-foreground">
                                            o
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Opción secundaria: Evolution API (QR) */}
                            {planLimit !== 0 && (
                                <div className="space-y-3">
                                    {metaConfig && (
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                                            <span className="text-sm font-medium text-muted-foreground">
                                                Conexión por QR (no oficial)
                                            </span>
                                        </div>
                                    )}
                                    <Button
                                        variant={metaConfig ? "outline" : "default"}
                                        onClick={handleConnectEvolution}
                                        disabled={isConnecting}
                                        className="w-full"
                                    >
                                        {isConnecting
                                            ? "Conectando..."
                                            : metaConfig
                                                ? "Conectar con QR (Evolution)"
                                                : "Conectar WhatsApp"}
                                    </Button>
                                    {metaConfig && (
                                        <p className="text-xs text-orange-600 dark:text-orange-400 text-center">
                                            Usa API no oficial — Meta puede bloquear tu número
                                        </p>
                                    )}
                                </div>
                            )}

                            {planLimit === 0 && (
                                <p className="text-xs text-center text-muted-foreground">
                                    Actualiza tu plan para usar WhatsApp
                                </p>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {showQRModal && (
                <QRModal
                    qrCode={qrCode}
                    instanceId={instanceId}
                    onClose={handleQRModalClose}
                />
            )}
        </>
    )
}
