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
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
    getPlatformChannelStatus,
    savePlatformChannelConfig,
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
    const [provider, setProvider] = useState<"evolution" | "meta">("evolution")
    const [metaPhoneNumberId, setMetaPhoneNumberId] = useState("")
    const [metaAccessToken, setMetaAccessToken] = useState("")
    const [metaTemplateName, setMetaTemplateName] = useState("")
    const [saving, setSaving] = useState(false)

    const loadStatus = useCallback(async () => {
        const result = await getPlatformChannelStatus()
        if (result.success) {
            setStatus(result.data)
            setProvider(result.data.provider)
            setMetaTemplateName(result.data.metaTemplateName ?? "")
        } else {
            toast.error(result.error)
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        loadStatus()
    }, [loadStatus])

    const saveConfig = async (enabled: boolean) => {
        setSaving(true)
        try {
            const result = await savePlatformChannelConfig({
                enabled,
                provider,
                metaPhoneNumberId: metaPhoneNumberId || undefined,
                metaAccessToken: metaAccessToken || undefined,
                metaTemplateName: metaTemplateName || undefined,
            })
            if (result.success) {
                toast.success("Configuración guardada")
                setMetaAccessToken("")
                await loadStatus()
            } else {
                toast.error(result.error)
            }
        } finally {
            setSaving(false)
        }
    }

    const handleToggle = async (enabled: boolean) => saveConfig(enabled)

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
                    <CardTitle>Proveedor del canal</CardTitle>
                    <CardDescription>
                        Desde qué número de LandingChat se envían las notificaciones.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <RadioGroup value={provider} onValueChange={(value) => setProvider(value as "evolution" | "meta")} className="space-y-3">
                        <div className="flex items-start gap-3 rounded-lg border p-4">
                            <RadioGroupItem value="evolution" id="prov-evolution" className="mt-1" />
                            <div>
                                <Label htmlFor="prov-evolution" className="font-medium cursor-pointer">Evolution (QR, no oficial)</Label>
                                <p className="text-sm text-slate-500 mt-1">Rápido: escanea un QR con un número de la empresa. Mensajes libres, sin templates.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 rounded-lg border p-4">
                            <RadioGroupItem value="meta" id="prov-meta" className="mt-1" />
                            <div>
                                <Label htmlFor="prov-meta" className="font-medium cursor-pointer">Meta Cloud API (oficial)</Label>
                                <p className="text-sm text-slate-500 mt-1">
                                    WABA propio de LandingChat. Requiere número registrado en Meta y un <strong>template aprobado</strong> con un parámetro de body ({"{{1}}"}).
                                    {status?.metaConfigured && <span className="ml-1 text-green-600 font-medium">Credenciales configuradas ✓</span>}
                                </p>
                            </div>
                        </div>
                    </RadioGroup>

                    {provider === "meta" && (
                        <div className="space-y-3 rounded-lg border p-4">
                            <div className="space-y-1">
                                <Label htmlFor="metaPhoneId">Phone Number ID</Label>
                                <Input id="metaPhoneId" value={metaPhoneNumberId} onChange={(event) => setMetaPhoneNumberId(event.target.value)} placeholder={status?.metaConfigured ? "(configurado — escribe para reemplazar)" : "1234567890"} className="font-mono" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="metaToken">Access Token</Label>
                                <Input id="metaToken" type="password" value={metaAccessToken} onChange={(event) => setMetaAccessToken(event.target.value)} placeholder={status?.metaConfigured ? "(guardado encriptado — escribe para reemplazar)" : "EAAG..."} className="font-mono" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="metaTemplate">Template aprobado (body con {"{{1}}"})</Label>
                                <Input id="metaTemplate" value={metaTemplateName} onChange={(event) => setMetaTemplateName(event.target.value)} placeholder="platform_notification" className="font-mono" />
                            </div>
                        </div>
                    )}

                    <Button onClick={() => saveConfig(status?.enabled ?? false)} disabled={saving}>
                        {saving ? "Guardando..." : "Guardar configuración"}
                    </Button>
                </CardContent>
            </Card>

            {provider === "evolution" && (
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
            )}

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
