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
import { saveWompiConfig, getWompiConfig, testWompiConnection } from "../actions"

interface WompiConfig {
    isActive: boolean
    isTestMode: boolean
    publicKey: string
    privateKey: string
    integritySecret: string
}

export function WompiSettings() {
    const [loading, setLoading] = useState(false)
    const [testing, setTesting] = useState(false)
    const [showPrivateKey, setShowPrivateKey] = useState(false)
    const [showIntegritySecret, setShowIntegritySecret] = useState(false)
    const [connectionStatus, setConnectionStatus] = useState<"unknown" | "success" | "error">("unknown")
    const [merchantInfo, setMerchantInfo] = useState<{ name: string; legal_name: string; accepted_currencies: string[] } | null>(null)
    const [webhookUrl, setWebhookUrl] = useState<string | null>(null)
    const [hasExistingCredentials, setHasExistingCredentials] = useState(false)

    const [config, setConfig] = useState<WompiConfig>({
        isActive: false,
        isTestMode: true,
        publicKey: "",
        privateKey: "",
        integritySecret: "",
    })

    useEffect(() => {
        loadConfig()
    }, [])

    const loadConfig = async () => {
        try {
            const result = await getWompiConfig()
            if (result.success && result.data) {
                const data = result.data as Record<string, unknown>
                setConfig({
                    isActive: (data.is_active as boolean) || false,
                    isTestMode: (data.is_test_mode as boolean) ?? true,
                    publicKey: (data.public_key as string) || "",
                    privateKey: "",
                    integritySecret: "",
                })
                setHasExistingCredentials(!!(data.private_key_encrypted))
                setWebhookUrl((data.webhook_url as string) || null)
            }
        } catch (error) {
            console.error("Error loading Wompi config:", error)
        }
    }

    const handleSave = async () => {
        if (!config.publicKey) {
            toast.error("La llave pública es requerida")
            return
        }

        if (!config.privateKey && !hasExistingCredentials) {
            toast.error("La llave privada es requerida")
            return
        }

        if (!config.privateKey && hasExistingCredentials) {
            toast.error("Debes ingresar la llave privada nuevamente para guardar cambios")
            return
        }

        setLoading(true)
        try {
            const result = await saveWompiConfig({
                provider: "wompi",
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
            const result = await testWompiConnection()
            if (result.success && result.data?.success) {
                setConnectionStatus("success")
                setMerchantInfo(result.data.merchant || null)
                toast.success(result.data.message || "Conexión exitosa con Wompi")
            } else {
                setConnectionStatus("error")
                setMerchantInfo(null)
                const errorMessage = result.success
                    ? result.data?.message || "Error de conexión"
                    : result.error || "Error de conexión"
                toast.error(errorMessage)
            }
        } catch {
            setConnectionStatus("error")
            setMerchantInfo(null)
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
                                Estado de Wompi
                                {connectionStatus === "success" && <CheckCircle className="h-5 w-5 text-green-500" />}
                                {connectionStatus === "error" && <XCircle className="h-5 w-5 text-red-500" />}
                                {connectionStatus === "unknown" && <AlertCircle className="h-5 w-5 text-yellow-500" />}
                            </CardTitle>
                            <CardDescription>
                                Estado actual de tu integración con Wompi
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
                                {connectionStatus === "error" && "Error en la conexión - verifica tus credenciales"}
                                {connectionStatus === "unknown" && "Conexión no verificada"}
                            </p>
                            {merchantInfo && (
                                <div className="mt-2 rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-sm">
                                    <p className="font-medium text-green-800 dark:text-green-300">
                                        Comercio: {merchantInfo.name}
                                    </p>
                                    {merchantInfo.legal_name && (
                                        <p className="text-green-700 dark:text-green-400">
                                            Razón Social: {merchantInfo.legal_name}
                                        </p>
                                    )}
                                    {merchantInfo.accepted_currencies?.length > 0 && (
                                        <p className="text-green-700 dark:text-green-400">
                                            Monedas: {merchantInfo.accepted_currencies.join(", ")}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                        <Button
                            variant="outline"
                            onClick={handleTestConnection}
                            disabled={testing || !config.publicKey}
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
                    <CardTitle>Credenciales de Wompi</CardTitle>
                    <CardDescription>
                        Configura tus credenciales para procesar pagos con tarjetas, PSE y Nequi
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
                                    <li>Ingresa a tu panel de Wompi</li>
                                    <li>Ve a <strong>Desarrolladores → Llaves de API</strong></li>
                                    <li>Copia la llave pública y privada</li>
                                    <li>Para webhooks: <strong>Configuración → Events</strong></li>
                                </ol>
                                <Button variant="ghost" size="sm" className="p-0 h-auto" asChild>
                                    <a href="https://comercios.wompi.co" target="_blank" rel="noopener noreferrer">
                                        Abrir panel de Wompi <ExternalLink className="ml-1 h-3 w-3" />
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
                                Activa para usar credenciales de sandbox (sin cobros reales)
                            </p>
                        </div>
                        <Switch
                            checked={config.isTestMode}
                            onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, isTestMode: checked }))}
                        />
                    </div>

                    {/* Public Key */}
                    <div className="space-y-2">
                        <Label htmlFor="publicKey">Llave Pública</Label>
                        <Input
                            id="publicKey"
                            value={config.publicKey}
                            onChange={(e) => setConfig((prev) => ({ ...prev, publicKey: e.target.value }))}
                            placeholder={config.isTestMode ? "pub_test_xxxxx" : "pub_prod_xxxxx"}
                        />
                        <p className="text-xs text-slate-500">
                            Encuéntrala en Wompi → Desarrolladores → Llaves de API
                        </p>
                    </div>

                    {/* Private Key */}
                    <div className="space-y-2">
                        <Label htmlFor="privateKey">
                            Llave Privada
                            {hasExistingCredentials && (
                                <span className="ml-2 text-xs text-green-600">(ya configurada — ingresa para actualizar)</span>
                            )}
                        </Label>
                        <div className="relative">
                            <Input
                                id="privateKey"
                                type={showPrivateKey ? "text" : "password"}
                                value={config.privateKey}
                                onChange={(e) => setConfig((prev) => ({ ...prev, privateKey: e.target.value }))}
                                placeholder={hasExistingCredentials ? "••••••••••••••••" : config.isTestMode ? "prv_test_xxxxx" : "prv_prod_xxxxx"}
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
                            Mantén esta llave segura. Nunca la compartas.
                        </p>
                    </div>

                    {/* Integrity Secret */}
                    <div className="space-y-2">
                        <Label htmlFor="integritySecret">
                            Secreto de Integridad (Events)
                            {hasExistingCredentials && (
                                <span className="ml-2 text-xs text-slate-400">(opcional — deja vacío para mantener)</span>
                            )}
                        </Label>
                        <div className="relative">
                            <Input
                                id="integritySecret"
                                type={showIntegritySecret ? "text" : "password"}
                                value={config.integritySecret}
                                onChange={(e) => setConfig((prev) => ({ ...prev, integritySecret: e.target.value }))}
                                placeholder={hasExistingCredentials ? "••••••••••••••••" : "Secreto para validar webhooks"}
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
                            Necesario para validar webhooks. Encuéntralo en Wompi → Configuración → Events
                        </p>
                    </div>

                    {/* Activar Pasarela */}
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label>Activar Pasarela</Label>
                            <p className="text-sm text-slate-500">
                                Permite que los clientes paguen con Wompi
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
                            Configura esta URL en tu panel de Wompi para recibir notificaciones de pago
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
                            Wompi → Configuración → Events → URL de notificación
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
