"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
    MessageSquare,
    Instagram,
    MessageCircle,
    Phone,
    Shield,
    AlertTriangle,
    TrendingUp,
    Unplug,
} from "lucide-react"
import { SocialLoginButton } from "./social-login-button"
import { disconnectSocialChannel } from "../actions"
import type { SocialChannel } from "../actions"

// ============================================
// Tipos
// ============================================

interface WhatsAppCardData {
    type: "whatsapp"
    instance: {
        status: string
        provider?: string | null
        phone_number_display?: string | null
        conversations_this_month?: number
        messages_sent_this_month?: number
        last_message_at?: string | null
    } | null
    planLimit: number
    conversationsUsed: number
}

interface SocialCardData {
    type: "instagram" | "messenger"
    channel: SocialChannel | null
}

type ChannelCardData = WhatsAppCardData | SocialCardData

interface ChannelCardProps {
    data: ChannelCardData
    metaAppId?: string
    metaConfigId?: string
    onUpdate: () => void
}

// ============================================
// Config por canal
// ============================================

const CHANNEL_CONFIG = {
    whatsapp: {
        title: "WhatsApp",
        description: "Atiende clientes por WhatsApp Business",
        icon: MessageSquare,
        connectedColor: "bg-green-500",
        accentColor: "text-green-600",
    },
    instagram: {
        title: "Instagram DM",
        description: "Responde mensajes directos de Instagram",
        icon: Instagram,
        connectedColor: "bg-gradient-to-r from-purple-500 to-pink-500",
        accentColor: "text-pink-600",
    },
    messenger: {
        title: "Facebook Messenger",
        description: "Atiende clientes desde tu página de Facebook",
        icon: MessageCircle,
        connectedColor: "bg-blue-500",
        accentColor: "text-blue-600",
    },
}

// ============================================
// Componente
// ============================================

export function ChannelCard({ data, metaAppId, metaConfigId, onUpdate }: ChannelCardProps) {
    const [isDisconnecting, setIsDisconnecting] = useState(false)

    const channelType = data.type
    const config = CHANNEL_CONFIG[channelType]
    const Icon = config.icon

    const isConnected = channelType === "whatsapp"
        ? (data as WhatsAppCardData).instance?.status === "connected"
        : (data as SocialCardData).channel?.status === "connected"

    const handleDisconnectSocial = async () => {
        if (channelType === "whatsapp") return

        const platformName = channelType === "instagram" ? "Instagram" : "Messenger"
        if (!confirm(`¿Estás seguro de desconectar ${platformName}?`)) return

        setIsDisconnecting(true)
        try {
            const result = await disconnectSocialChannel(channelType)
            if (result.success) {
                toast.success(`${platformName} desconectado`)
                onUpdate()
            } else {
                toast.error(result.error || "Error al desconectar")
            }
        } catch {
            toast.error("Error al desconectar")
        } finally {
            setIsDisconnecting(false)
        }
    }

    return (
        <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                        <div className={`p-2 rounded-lg ${isConnected ? "bg-green-50 dark:bg-green-950/20" : "bg-muted"}`}>
                            <Icon className={`h-5 w-5 ${isConnected ? config.accentColor : "text-muted-foreground"}`} />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-semibold">
                                {config.title}
                            </CardTitle>
                            <CardDescription className="text-xs mt-0.5">
                                {config.description}
                            </CardDescription>
                        </div>
                    </div>
                    <Badge
                        variant={isConnected ? "default" : "secondary"}
                        className={
                            isConnected
                                ? `${config.connectedColor} text-white border-0`
                                : "text-muted-foreground"
                        }
                    >
                        {isConnected ? "Conectado" : "No conectado"}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* WhatsApp conectado */}
                {channelType === "whatsapp" && isConnected && (data as WhatsAppCardData).instance && (
                    <WhatsAppConnectedContent
                        data={data as WhatsAppCardData}
                        onUpdate={onUpdate}
                    />
                )}

                {/* WhatsApp no conectado */}
                {channelType === "whatsapp" && !isConnected && (
                    <WhatsAppDisconnectedContent
                        metaAppId={metaAppId}
                        metaConfigId={metaConfigId}
                        planLimit={(data as WhatsAppCardData).planLimit}
                        onUpdate={onUpdate}
                    />
                )}

                {/* Social conectado */}
                {channelType !== "whatsapp" && isConnected && (data as SocialCardData).channel && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">Cuenta:</span>
                            <span className="font-medium">
                                {(data as SocialCardData).channel!.platform_username || "Conectado"}
                            </span>
                        </div>
                        <Button
                            variant="outline"
                            onClick={handleDisconnectSocial}
                            disabled={isDisconnecting}
                            className="w-full border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                            size="sm"
                        >
                            <Unplug className="mr-2 h-4 w-4" />
                            {isDisconnecting ? "Desconectando..." : "Desconectar"}
                        </Button>
                    </div>
                )}

                {/* Social no conectado */}
                {channelType !== "whatsapp" && !isConnected && metaAppId && (
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            {channelType === "instagram"
                                ? "Conecta tu cuenta de Instagram Business para responder DMs automáticamente con IA."
                                : "Conecta tu página de Facebook para responder mensajes de Messenger con IA."
                            }
                        </p>
                        <SocialLoginButton
                            appId={metaAppId}
                            platform={channelType}
                            onSuccess={onUpdate}
                        />
                    </div>
                )}

                {/* Sin configuración de Meta */}
                {channelType !== "whatsapp" && !isConnected && !metaAppId && (
                    <p className="text-sm text-muted-foreground">
                        Configura la app de Meta para habilitar este canal. Contacta al administrador.
                    </p>
                )}
            </CardContent>
        </Card>
    )
}

// ============================================
// Sub-componentes para WhatsApp
// ============================================

function WhatsAppConnectedContent({
    data,
    onUpdate,
}: {
    data: WhatsAppCardData
    onUpdate: () => void
}) {
    const [isDisconnecting, setIsDisconnecting] = useState(false)
    const instance = data.instance!
    const provider = (instance as Record<string, unknown>).provider as string || "evolution"
    const usagePercentage = data.planLimit > 0
        ? Math.round((data.conversationsUsed / data.planLimit) * 100)
        : 0

    const handleDisconnect = async () => {
        if (!confirm("¿Estás seguro de desconectar WhatsApp?")) return
        setIsDisconnecting(true)
        try {
            const { disconnectWhatsApp } = await import("../../whatsapp/actions")
            const result = await disconnectWhatsApp()
            if (result.success) {
                toast.success("WhatsApp desconectado")
                onUpdate()
            } else {
                toast.error("Error al desconectar")
            }
        } catch {
            toast.error("Error al desconectar")
        } finally {
            setIsDisconnecting(false)
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Número:</span>
                    <span className="font-medium">****{instance.phone_number_display}</span>
                </div>
                <Badge
                    variant="outline"
                    className={
                        provider === "meta"
                            ? "border-blue-300 text-blue-600 text-xs"
                            : "border-orange-300 text-orange-600 text-xs"
                    }
                >
                    {provider === "meta" ? (
                        <><Shield className="h-3 w-3 mr-1" />Oficial</>
                    ) : (
                        <><AlertTriangle className="h-3 w-3 mr-1" />Evolution</>
                    )}
                </Badge>
            </div>

            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Conversaciones este mes</span>
                    <span className="font-medium">
                        {data.conversationsUsed} / {data.planLimit === -1 ? "∞" : data.planLimit}
                    </span>
                </div>
                {data.planLimit > 0 && (
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all rounded-full ${
                                usagePercentage > 80
                                    ? "bg-red-500"
                                    : usagePercentage > 60
                                      ? "bg-yellow-500"
                                      : "bg-green-500"
                            }`}
                            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                        />
                    </div>
                )}
            </div>

            <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="w-full border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                size="sm"
            >
                <Unplug className="mr-2 h-4 w-4" />
                {isDisconnecting ? "Desconectando..." : "Desconectar"}
            </Button>
        </div>
    )
}

function WhatsAppDisconnectedContent({
    metaAppId,
    metaConfigId,
    planLimit,
    onUpdate,
}: {
    metaAppId?: string
    metaConfigId?: string
    planLimit: number
    onUpdate: () => void
}) {
    if (planLimit === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                Actualiza tu plan para usar WhatsApp.
            </p>
        )
    }

    return (
        <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                    Tu plan incluye hasta{" "}
                    <strong>{planLimit === -1 ? "ilimitadas" : planLimit}</strong>{" "}
                    conversaciones por mes.
                </p>
            </div>

            {metaAppId && metaConfigId && (
                <div className="space-y-2">
                    <EmbeddedSignupWrapper
                        appId={metaAppId}
                        configId={metaConfigId}
                        onSuccess={onUpdate}
                    />
                    <p className="text-xs text-muted-foreground text-center">
                        Conexión oficial via Meta — sin riesgo de bloqueo
                    </p>
                </div>
            )}

            {!metaAppId && (
                <p className="text-sm text-muted-foreground">
                    Configura la app de Meta para conectar WhatsApp. Contacta al administrador.
                </p>
            )}
        </div>
    )
}

function EmbeddedSignupWrapper({
    appId,
    configId,
    onSuccess,
}: {
    appId: string
    configId: string
    onSuccess: () => void
}) {
    // Importar dinámicamente para no duplicar código
    const { EmbeddedSignup } = require("../../whatsapp/components/embedded-signup")
    return <EmbeddedSignup appId={appId} configId={configId} onSuccess={onSuccess} />
}
