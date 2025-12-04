"use client"

import { useState, useEffect } from "react"
import { type WompiConfig } from "@/lib/wompi/types"
import { getWompiConfig, saveWompiConfig, testWompiConnection } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { RefreshCw, CheckCircle, XCircle, ExternalLink } from "lucide-react"

export default function WompiSettingsPage() {
    const [config, setConfig] = useState<WompiConfig>({
        publicKey: "",
        privateKey: "",
        integritySecret: "",
        environment: "sandbox",
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)
    const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "error">("unknown")

    useEffect(() => {
        loadConfig()
    }, [])

    const loadConfig = async () => {
        setLoading(true)
        const result = await getWompiConfig()
        setLoading(false)

        if (result.success && result.data) {
            setConfig(result.data)
        }
    }

    const handleChange = (field: keyof WompiConfig, value: string) => {
        setConfig((prev) => ({ ...prev, [field]: value }))
        setConnectionStatus("unknown")
    }

    const handleSave = async () => {
        setSaving(true)
        const result = await saveWompiConfig(config)
        setSaving(false)

        if (result.success) {
            toast.success("Configuración guardada")
        } else {
            toast.error(result.error)
        }
    }

    const handleTestConnection = async () => {
        setTesting(true)
        const result = await testWompiConnection()
        setTesting(false)

        if (result.success) {
            setConnectionStatus("connected")
            toast.success("Conexión exitosa con Wompi")
        } else {
            setConnectionStatus("error")
            toast.error(result.error)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Configuración de Wompi</h2>
                <p className="text-muted-foreground">
                    Configura la integración con Wompi para procesar pagos de suscripciones.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Formulario de configuración */}
                <Card>
                    <CardHeader>
                        <CardTitle>Credenciales de API</CardTitle>
                        <CardDescription>
                            Obtén tus credenciales desde el{" "}
                            <a
                                href="https://comercios.wompi.co"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline inline-flex items-center gap-1"
                            >
                                panel de Wompi
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="environment">Ambiente</Label>
                            <Select
                                value={config.environment}
                                onValueChange={(value) => handleChange("environment", value)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sandbox">Sandbox (Pruebas)</SelectItem>
                                    <SelectItem value="production">Producción</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="publicKey">Llave Pública</Label>
                            <Input
                                id="publicKey"
                                value={config.publicKey}
                                onChange={(e) => handleChange("publicKey", e.target.value)}
                                placeholder="pub_test_..."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="privateKey">Llave Privada</Label>
                            <Input
                                id="privateKey"
                                type="password"
                                value={config.privateKey}
                                onChange={(e) => handleChange("privateKey", e.target.value)}
                                placeholder="prv_test_..."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="integritySecret">Secreto de Integridad</Label>
                            <Input
                                id="integritySecret"
                                type="password"
                                value={config.integritySecret}
                                onChange={(e) => handleChange("integritySecret", e.target.value)}
                                placeholder="test_integrity_..."
                            />
                            <p className="text-xs text-muted-foreground">
                                Usado para validar webhooks de Wompi
                            </p>
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? "Guardando..." : "Guardar Configuración"}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleTestConnection}
                                disabled={testing || !config.publicKey}
                            >
                                {testing ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        Probando...
                                    </>
                                ) : (
                                    "Probar Conexión"
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Estado y documentación */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Estado de Conexión</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3">
                                {connectionStatus === "unknown" && (
                                    <>
                                        <div className="h-3 w-3 rounded-full bg-slate-300" />
                                        <span className="text-muted-foreground">Sin verificar</span>
                                    </>
                                )}
                                {connectionStatus === "connected" && (
                                    <>
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                        <span className="text-green-600 font-medium">Conectado</span>
                                        <Badge variant="outline" className="ml-auto">
                                            {config.environment === "sandbox" ? "Sandbox" : "Producción"}
                                        </Badge>
                                    </>
                                )}
                                {connectionStatus === "error" && (
                                    <>
                                        <XCircle className="h-5 w-5 text-red-500" />
                                        <span className="text-red-600 font-medium">Error de conexión</span>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Webhook URL</CardTitle>
                            <CardDescription>
                                Configura esta URL en tu panel de Wompi para recibir notificaciones de pago
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg font-mono text-sm break-all">
                                {typeof window !== "undefined"
                                    ? `${window.location.origin}/api/webhooks/wompi`
                                    : "https://tu-dominio.com/api/webhooks/wompi"}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Documentación</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <a
                                href="https://docs.wompi.co/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-primary hover:underline"
                            >
                                <ExternalLink className="h-4 w-4" />
                                Documentación de Wompi
                            </a>
                            <a
                                href="https://docs.wompi.co/docs/colombia/widget-checkout"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-primary hover:underline"
                            >
                                <ExternalLink className="h-4 w-4" />
                                Widget de Checkout
                            </a>
                            <a
                                href="https://docs.wompi.co/docs/colombia/eventos-en-wompi"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-primary hover:underline"
                            >
                                <ExternalLink className="h-4 w-4" />
                                Configuración de Webhooks
                            </a>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
