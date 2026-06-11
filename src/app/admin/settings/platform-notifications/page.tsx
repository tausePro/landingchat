"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { Bell, QrCode, RefreshCw, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import {
    getPlatformChannelStatus,
    setPlatformChannelEnabled,
    connectPlatformInstance,
    sendTestNotification,
    type PlatformChannelStatus,
} from "./actions"

const STATUS_BADGE: Record<PlatformChannelStatus["instanceStatus"], { label: string; className: string }> = {
    connected: { label: "Conectada", className: "bg-green-100 text-green-800" },
    connecting: { label: "Esperando QR", className: "bg-amber-100 text-amber-800" },
    disconnected: { label: "Desconectada", className: "bg-red-100 text-red-800" },
    missing: { label: "No creada", className: "bg-slate-100 text-slate-600" },
}

/**
 * Canal de notificaciones de la plataforma (Platform Notifier v0 — T3):
 * LandingChat → WhatsApp de los merchants (copilot, ventas, sistema).
 */
export default function PlatformNotificationsPage() {
    const [status, setStatus] = useState<PlatformChannelStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [connecting, setConnecting] = useState(false)
    const [testPhone, setTestPhone] = useState("")
    const [sendingTest, setSendingTest] = useState(false)

    const loadStatus = useCallback(async () => {
        const result = await getPlatformChannelStatus()
        if (result.success) {
            setStatus(result.data)
        } else {
            toast.error(result.error)
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        loadStatus()
    }, [loadStatus])

    const handleToggle = async (enabled: boolean) => {
        const result = await setPlatformChannelEnabled(enabled)
        if (result.success) {
            toast.success(enabled ? "Canal habilitado" : "Canal deshabilitado")
            await loadStatus()
        } else {
            toast.error(result.error)
        }
    }

    const handleConnect = async () => {
        setConnecting(true)
        setQrCode(null)
        try {
            const result = await connectPlatformInstance()
            if (result.success && result.data.qrCode) {
                setQrCode(result.data.qrCode)
                toast.success("Escanea el QR con el WhatsApp de LandingChat")
            } else if (result.success) {
                toast.info("Instancia creada — refresca para ver el estado")
            } else {
                toast.error(result.error)
            }
        } finally {
            setConnecting(false)
        }
    }

    const handleTestSend = async () => {
        if (!testPhone.trim()) return
        setSendingTest(true)
        try {
            const result = await sendTestNotification(testPhone.trim())
            if (result.success) {
                toast.success("Mensaje de prueba enviado — revisa el WhatsApp")
            } else {
                toast.error(result.error)
            }
        } finally {
            setSendingTest(false)
        }
    }

    if (loading) {
        return <div className="p-6 text-slate-500">Cargando estado del canal...</div>
    }

    const badge = status ? STATUS_BADGE[status.instanceStatus] : null

    return (
        <div className="space-y-6 p-6 max-w-3xl">
            <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5">
                    <Bell className="h-5 w-5 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Notificaciones de Plataforma</h1>
                    <p className="text-slate-500">
                        WhatsApp de LandingChat → merchants (copilot, ventas, sistema)
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        Estado del canal
                        <Button variant="ghost" size="sm" onClick={loadStatus}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3 text-sm">
                        <div>
                            <p className="text-slate-500">Server Evolution</p>
                            <Badge className={status?.serverReachable ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                {status?.serverReachable ? "Alcanzable" : "Inalcanzable"}
                            </Badge>
                        </div>
                        <div>
                            <p className="text-slate-500">Instancia {status?.instanceName}</p>
                            {badge && <Badge className={badge.className}>{badge.label}</Badge>}
                        </div>
                        <div>
                            <p className="text-slate-500">Número</p>
                            <p className="font-mono">{status?.phoneDisplay ?? "—"}</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                            <p className="text-sm font-medium">Canal habilitado</p>
                            <p className="text-xs text-slate-500">Apagarlo detiene los envíos platform sin deploy</p>
                        </div>
                        <Switch checked={status?.enabled ?? false} onCheckedChange={handleToggle} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Conexión</CardTitle>
                    <CardDescription>
                        Crea la instancia (si falta) y escanea el QR con el WhatsApp de LandingChat.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={handleConnect} disabled={connecting} variant="outline">
                        <QrCode className="h-4 w-4 mr-2" />
                        {connecting ? "Generando QR..." : "Generar QR de conexión"}
                    </Button>
                    {qrCode && (
                        <div className="flex justify-center rounded-lg border bg-white p-4">
                            <Image
                                src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                                alt="QR de conexión de WhatsApp"
                                width={240}
                                height={240}
                                unoptimized
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Envío de prueba</CardTitle>
                    <CardDescription>Smoke del canal — te llega un mensaje desde el número de la plataforma.</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-3">
                    <Input
                        placeholder="573001234567"
                        value={testPhone}
                        onChange={(event) => setTestPhone(event.target.value)}
                        className="max-w-xs font-mono"
                    />
                    <Button onClick={handleTestSend} disabled={sendingTest || !testPhone.trim()}>
                        <Send className="h-4 w-4 mr-2" />
                        {sendingTest ? "Enviando..." : "Enviar prueba"}
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
