"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Loader2, Eye, EyeOff, CheckCircle, XCircle, AlertCircle, ExternalLink, Copy } from "lucide-react"
import { saveBoldConfig, getBoldConfig, testBoldConnection } from "../actions"
import { PaymentBrandingSelector } from "../../payments/components/payment-branding-selector"

interface BoldConfig {
    isActive: boolean
    isTestMode: boolean
    identityKey: string
    secretKey: string
    logoUrl: string
}

function getGatewayLogoUrl(data: Record<string, unknown>) {
    const config = data.config
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        return ""
    }

    const logoUrl = (config as Record<string, unknown>).logo_url
    return typeof logoUrl === "string" ? logoUrl : ""
}

export function BoldSettings() {
    const [loading, setLoading] = useState(false)
    const [testing, setTesting] = useState(false)
    const [showSecretKey, setShowSecretKey] = useState(false)
    const [connectionStatus, setConnectionStatus] = useState<"unknown" | "success" | "error">("unknown")
    const [webhookUrl, setWebhookUrl] = useState<string | null>(null)
    const [hasExistingCredentials, setHasExistingCredentials] = useState(false)
    const [hasExistingSecret, setHasExistingSecret] = useState(false)

    const [config, setConfig] = useState<BoldConfig>({
        isActive: false,
        isTestMode: true,
        identityKey: "",
        secretKey: "",
        logoUrl: "",
    })

    useEffect(() => {
        loadConfig()
    }, [])

    const loadConfig = async () => {
        try {
            const result = await getBoldConfig()
            if (result.success && result.data) {
                const data = result.data as Record<string, unknown>
                setConfig({
                    isActive: (data.is_active as boolean) || false,
                    isTestMode: (data.is_test_mode as boolean) ?? true,
                    identityKey: "",
                    secretKey: "",
                    logoUrl: getGatewayLogoUrl(data),
                })
                setHasExistingCredentials(!!data.private_key_encrypted)
                setHasExistingSecret(!!data.integrity_secret_encrypted)
                setWebhookUrl((data.webhook_url as string) || null)
            }
        } catch (error) {
            console.error("Error loading Bold config:", error)
        }
    }

    const handleSave = async () => {
        if (!config.identityKey && !hasExistingCredentials) {
            toast.error("La llave de identidad es requerida")
            return
        }

        if (!config.identityKey && hasExistingCredentials) {
            toast.error("Debes ingresar la llave de identidad nuevamente para guardar cambios")
            return
        }

        if (!config.secretKey && !hasExistingSecret) {
            toast.error("La llave secreta es requerida para validar los webhooks de Bold")
            return
        }

        setLoading(true)
        try {
            const result = await saveBoldConfig({
                is_active: config.isActive,
                is_test_mode: config.isTestMode,
                identity_key: config.identityKey,
                secret_key: config.secretKey,
            })

            if (result.success) {
                toast.success("Configuración guardada correctamente")
                setConnectionStatus("unknown")
                setHasExistingCredentials(true)
                if (config.secretKey) setHasExistingSecret(true)
                loadConfig()
            } else {
                toast.error(result.error || "Error al guardar configuración")
            }
        } catch {
            toast.error("Error inesperado al guardar")
        } finally {
            setLoading(false)
        }
    }

    const handleTestConnection = async () => {
        setTesting(true)
        try {
            const result = await testBoldConnection()
            if (result.success && result.data?.success) {
                setConnectionStatus("success")
                toast.success(result.data.message || "Conexión exitosa con Bold")
            } else {
                setConnectionStatus("error")
                const errorMessage = result.success
                    ? result.data?.message || "Error de conexión"
                    : result.error || "Error de conexión"
                toast.error(errorMessage)
            }
        } catch {
            setConnectionStatus("error")
            toast.error("Error al probar conexión")
        } finally {
            setTesting(false)
        }
    }

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success("Copiado al portapapeles")
    }

    return (
        <div className="space-y-6">
            {/* Estado de Conexión */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                Estado de Bold
                                {connectionStatus === "success" && <CheckCircle className="h-5 w-5 text-green-500" />}
                                {connectionStatus === "error" && <XCircle className="h-5 w-5 text-red-500" />}
                                {connectionStatus === "unknown" && <AlertCircle className="h-5 w-5 text-yellow-500" />}
                            </CardTitle>
                            <CardDescription>
                                Estado actual de tu integración con Bold
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant={config.isActive ? "default" : "secondary"}>
                                {config.isActive ? "Activo" : "Inactivo"}
                            </Badge>
                            <Badge variant={config.isTestMode ? "outline" : "default"}>
                                {config.isTestMode ? "Pruebas" : "Producción"}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            {connectionStatus === "success" && "Conexión verificada correctamente"}
                            {connectionStatus === "error" && "Error en la conexión - verifica tus credenciales"}
                            {connectionStatus === "unknown" && "Conexión no verificada"}
                        </p>
                        <Button
                            variant="outline"
                            onClick={handleTestConnection}
                            disabled={testing || !hasExistingCredentials}
                        >
                            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Probar Conexión
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Configuración */}
            <Card>
                <CardHeader>
                    <CardTitle>Credenciales de Bold</CardTitle>
                    <CardDescription>
                        Configura tus llaves de integración para recibir pagos con link de Bold
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Instrucciones */}
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            <div className="space-y-2">
                                <p className="font-medium">Para obtener tus llaves de integración:</p>
                                <ol className="list-decimal list-inside space-y-1 text-sm">
                                    <li>Inicia sesión en <strong>bold.co</strong> con la cuenta de tu comercio</li>
                                    <li>Ve a <strong>Integraciones → Llaves de integración</strong></li>
                                    <li>Selecciona <strong>Botón de pagos</strong> y presiona <strong>Activar llaves</strong></li>
                                    <li>Copia la <strong>llave de identidad</strong> y la <strong>llave secreta</strong> del ambiente correspondiente (pruebas o producción)</li>
                                </ol>
                                <Button variant="ghost" size="sm" className="p-0 h-auto" asChild>
                                    <a href="https://developers.bold.co/pagos-en-linea/llaves-de-integracion" target="_blank" rel="noopener noreferrer">
                                        Ver documentación de Bold <ExternalLink className="ml-1 h-3 w-3" />
                                    </a>
                                </Button>
                            </div>
                        </AlertDescription>
                    </Alert>

                    {/* Modo de Pruebas */}
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label>Modo de Pruebas</Label>
                            <p className="text-sm text-slate-500">
                                Marca esta opción si configuraste llaves de pruebas de Bold. El ambiente
                                lo define la llave de tu comercio: Bold no usa una URL distinta para pruebas.
                            </p>
                        </div>
                        <Switch
                            checked={config.isTestMode}
                            onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, isTestMode: checked }))}
                        />
                    </div>

                    {/* Llave de Identidad */}
                    <div className="space-y-2">
                        <Label htmlFor="identityKey">
                            Llave de Identidad (API key)
                            {hasExistingCredentials && (
                                <span className="ml-2 text-xs text-green-600">(ya configurada — ingresa para actualizar)</span>
                            )}
                        </Label>
                        <Input
                            id="identityKey"
                            value={config.identityKey}
                            onChange={(e) => setConfig((prev) => ({ ...prev, identityKey: e.target.value }))}
                            placeholder={hasExistingCredentials ? "••••••••••••••••" : "Pega tu llave de identidad de Bold"}
                        />
                        <p className="text-xs text-slate-500">
                            Bold la considera pública: identifica tu comercio en cada transacción.
                        </p>
                    </div>

                    {/* Llave Secreta */}
                    <div className="space-y-2">
                        <Label htmlFor="secretKey">
                            Llave Secreta
                            {hasExistingSecret && (
                                <span className="ml-2 text-xs text-slate-400">(opcional — deja vacío para mantener)</span>
                            )}
                        </Label>
                        <div className="relative">
                            <Input
                                id="secretKey"
                                type={showSecretKey ? "text" : "password"}
                                value={config.secretKey}
                                onChange={(e) => setConfig((prev) => ({ ...prev, secretKey: e.target.value }))}
                                placeholder={hasExistingSecret ? "••••••••••••••••" : "Pega tu llave secreta de Bold"}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowSecretKey(!showSecretKey)}
                            >
                                {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500">
                            Privada. Se usa para validar la firma de los webhooks de Bold. Nunca la compartas.
                        </p>
                    </div>

                    <PaymentBrandingSelector
                        key={config.logoUrl}
                        provider="bold"
                        providerName="Bold"
                        initialLogoUrl={config.logoUrl}
                    />

                    {/* Activar Pasarela */}
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label>Activar Pasarela</Label>
                            <p className="text-sm text-slate-500">
                                Permite que los clientes paguen con Bold
                            </p>
                        </div>
                        <Switch
                            checked={config.isActive}
                            onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, isActive: checked }))}
                        />
                    </div>

                    {/* Save */}
                    <div className="flex gap-3 pt-4">
                        <Button onClick={handleSave} disabled={loading} className="flex-1">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Configuración
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Webhook URL */}
            {webhookUrl && (
                <Card>
                    <CardHeader>
                        <CardTitle>URL de Webhook</CardTitle>
                        <CardDescription>
                            Configura esta URL en tu panel de Bold para recibir notificaciones de pago
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                            <code className="flex-1 truncate text-sm">{webhookUrl}</code>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopy(webhookUrl)}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            Bold → Integraciones → Webhooks → URL de notificación
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
