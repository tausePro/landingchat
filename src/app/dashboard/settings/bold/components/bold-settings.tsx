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
import {
    Loader2,
    Eye,
    EyeOff,
    CheckCircle,
    XCircle,
    AlertCircle,
    ExternalLink,
    Copy,
    Info,
} from "lucide-react"
import { saveBoldConfig, getBoldConfig, testBoldConnection } from "../actions"
import { PaymentBrandingSelector } from "../../payments/components/payment-branding-selector"

interface BoldConfigState {
    isActive: boolean
    isTestMode: boolean
    publicKey: string
    privateKey: string
    integritySecret: string
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
    const [showPrivateKey, setShowPrivateKey] = useState(false)
    const [showIntegritySecret, setShowIntegritySecret] = useState(false)
    const [connectionStatus, setConnectionStatus] = useState<"unknown" | "success" | "error">("unknown")
    const [webhookUrl, setWebhookUrl] = useState<string | null>(null)
    const [hasExistingCredentials, setHasExistingCredentials] = useState(false)

    const [config, setConfig] = useState<BoldConfigState>({
        isActive: false,
        isTestMode: true,
        publicKey: "",
        privateKey: "",
        integritySecret: "",
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
                    publicKey: (data.public_key as string) || "",
                    privateKey: "",
                    integritySecret: "",
                    logoUrl: getGatewayLogoUrl(data),
                })
                setHasExistingCredentials(!!data.private_key_encrypted)
                setWebhookUrl((data.webhook_url as string) || null)
            }
        } catch (error) {
            console.error("Error loading Bold config:", error)
        }
    }

    const handleSave = async () => {
        if (!config.privateKey && !hasExistingCredentials) {
            toast.error("El API Key es requerido")
            return
        }

        if (!config.privateKey && hasExistingCredentials) {
            toast.error("Debes ingresar el API Key nuevamente para guardar cambios")
            return
        }

        setLoading(true)
        try {
            const result = await saveBoldConfig({
                provider: "bold",
                is_active: config.isActive,
                is_test_mode: config.isTestMode,
                public_key: config.publicKey,
                private_key: config.privateKey,
                integrity_secret: config.integritySecret,
            })

            if (result.success) {
                toast.success("Configuración guardada correctamente")
                setConnectionStatus("unknown")
                setHasExistingCredentials(true)
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
            {/* Banner: Bold está en preview / activable cuando el equipo lo valide */}
            <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300">
                <Info className="h-4 w-4" />
                <AlertDescription>
                    Bold está en <strong>preview</strong>. Puedes guardar tus credenciales y probar la
                    conexión, pero la activación en checkout la habilita el equipo de LandingChat tras
                    validación end-to-end. Contáctanos cuando termines la configuración.
                </AlertDescription>
            </Alert>

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
                                {config.isTestMode ? "Sandbox" : "Producción"}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                {connectionStatus === "success" && "Conexión verificada correctamente"}
                                {connectionStatus === "error" && "Error en la conexión — verifica tu API Key"}
                                {connectionStatus === "unknown" && "Conexión no verificada"}
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={handleTestConnection}
                            disabled={testing || (!hasExistingCredentials && !config.privateKey)}
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
                        Configura tu API Key y Signature Key para procesar pagos con Bold
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Instrucciones */}
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            <div className="space-y-2">
                                <p className="font-medium">Para obtener tus credenciales:</p>
                                <ol className="list-decimal list-inside space-y-1 text-sm">
                                    <li>Ingresa a tu panel de comercios Bold</li>
                                    <li>Ve a <strong>Integraciones → API Keys</strong> y copia tu API Key</li>
                                    <li>Ve a <strong>Integraciones → Webhooks</strong> y copia la Signature Key</li>
                                    <li>Registra la URL de webhook (abajo) en ese mismo panel</li>
                                </ol>
                                <Button variant="ghost" size="sm" className="p-0 h-auto" asChild>
                                    <a
                                        href="https://comercios.bold.co"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Abrir panel de Bold <ExternalLink className="ml-1 h-3 w-3" />
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
                                Activa para usar el sandbox de Bold (sin cobros reales)
                            </p>
                        </div>
                        <Switch
                            checked={config.isTestMode}
                            onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, isTestMode: checked }))}
                        />
                    </div>

                    {/* Identity Key (pública) */}
                    <div className="space-y-2">
                        <Label htmlFor="publicKey">
                            Identity Key <span className="text-xs text-slate-400">(opcional)</span>
                        </Label>
                        <Input
                            id="publicKey"
                            value={config.publicKey}
                            onChange={(e) => setConfig((prev) => ({ ...prev, publicKey: e.target.value }))}
                            placeholder="identity_xxxxx"
                        />
                        <p className="text-xs text-slate-500">
                            Solo si vas a usar el botón embebido de Bold. Hoy el flujo de LandingChat
                            usa el checkout hospedado y no lo requiere.
                        </p>
                    </div>

                    {/* API Key (privada) */}
                    <div className="space-y-2">
                        <Label htmlFor="privateKey">
                            API Key
                            {hasExistingCredentials && (
                                <span className="ml-2 text-xs text-green-600">
                                    (ya configurada — ingresa para actualizar)
                                </span>
                            )}
                        </Label>
                        <div className="relative">
                            <Input
                                id="privateKey"
                                type={showPrivateKey ? "text" : "password"}
                                value={config.privateKey}
                                onChange={(e) => setConfig((prev) => ({ ...prev, privateKey: e.target.value }))}
                                placeholder={
                                    hasExistingCredentials
                                        ? "••••••••••••••••"
                                        : config.isTestMode
                                            ? "test_api_xxxxx"
                                            : "api_xxxxx"
                                }
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowPrivateKey(!showPrivateKey)}
                            >
                                {showPrivateKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500">
                            Se envía como header <code className="font-mono text-[11px]">Authorization: x-api-key ...</code> al crear payment links.
                            Mantenla segura.
                        </p>
                    </div>

                    {/* Signature Key (webhooks) */}
                    <div className="space-y-2">
                        <Label htmlFor="integritySecret">
                            Signature Key
                            {hasExistingCredentials && (
                                <span className="ml-2 text-xs text-slate-400">
                                    (opcional — deja vacío para mantener)
                                </span>
                            )}
                        </Label>
                        <div className="relative">
                            <Input
                                id="integritySecret"
                                type={showIntegritySecret ? "text" : "password"}
                                value={config.integritySecret}
                                onChange={(e) => setConfig((prev) => ({ ...prev, integritySecret: e.target.value }))}
                                placeholder={
                                    hasExistingCredentials
                                        ? "••••••••••••••••"
                                        : "secret_xxxxx"
                                }
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowIntegritySecret(!showIntegritySecret)}
                            >
                                {showIntegritySecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500">
                            Necesaria para validar el header <code className="font-mono text-[11px]">x-bold-signature</code> de los webhooks.
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
                                Permite que los clientes paguen con Bold. El equipo de LandingChat puede
                                bloquear esto hasta validar end-to-end.
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
                            <Button variant="ghost" size="sm" onClick={() => handleCopy(webhookUrl)}>
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
