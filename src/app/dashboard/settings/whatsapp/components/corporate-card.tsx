"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Phone, TrendingUp } from "lucide-react"
import { QRModal } from "./qr-modal"
import { connectWhatsApp, disconnectWhatsApp } from "../actions"
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

    const isConnected = instance?.status === "connected"
    const isConnecting_status = instance?.status === "connecting"

    const handleConnect = async () => {
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
        } catch (error) {
            toast.error("Error al conectar WhatsApp")
        } finally {
            setIsConnecting(false)
        }
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
        } catch (error) {
            toast.error("Error al desconectar WhatsApp")
        } finally {
            setIsDisconnecting(false)
        }
    }

    const handleQRModalClose = () => {
        setShowQRModal(false)
        onUpdate()
    }

    const usagePercentage = instance
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

                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">
                                        Conversaciones este mes
                                    </span>
                                    <span className="font-medium">
                                        {instance.conversations_this_month} /{" "}
                                        {planLimit}
                                    </span>
                                </div>
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
                                        ⚠️ Estás cerca del límite de tu plan
                                    </p>
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
                                        <strong>{planLimit}</strong>{" "}
                                        conversaciones por mes
                                    </p>
                                </div>
                            </div>

                            <Button
                                onClick={handleConnect}
                                disabled={isConnecting || planLimit === 0}
                                className="w-full"
                            >
                                {isConnecting
                                    ? "Conectando..."
                                    : "Conectar WhatsApp"}
                            </Button>

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
