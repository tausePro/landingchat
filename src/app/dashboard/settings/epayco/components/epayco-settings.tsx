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
import { Loader2, Eye, EyeOff, CheckCircle, XCircle, AlertCircle, ExternalLink } from "lucide-react"
import { saveEpaycoConfig, getEpaycoConfig, testEpaycoConnection } from "@/app/dashboard/settings/epayco/actions"

interface EpaycoConfig {
    isActive: boolean
    isTestMode: boolean
    publicKey: string
    privateKey: string
    customerId: string
}

export function EpaycoSettings() {
    const [loading, setLoading] = useState(false)
    const [testing, setTesting] = useState(false)
    const [showPrivateKey, setShowPrivateKey] = useState(false)
    const [showCustomerId, setShowCustomerId] = useState(false)
    const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'error'>('unknown')
    
    const [config, setConfig] = useState<EpaycoConfig>({
        isActive: false,
        isTestMode: true,
        publicKey: "",
        privateKey: "",
        customerId: ""
    })

    // Cargar configuración existente
    useEffect(() => {
        loadConfig()
    }, [])

    const loadConfig = async () => {
        try {
            const result = await getEpaycoConfig()
            if (result.success && result.data) {
                setConfig({
                    isActive: result.data.is_active || false,
                    isTestMode: result.data.is_test_mode ?? true,
                    publicKey: result.data.public_key || "",
                    privateKey: "", // No mostrar la clave encriptada
                    customerId: "" // No mostrar el ID encriptado
                })
            }
        } catch (error) {
            console.error("Error loading config:", error)
        }
    }

    const handleSave = async () => {
        if (!config.publicKey || !config.privateKey || !config.customerId) {
            toast.error("Todos los campos son requeridos")
            return
        }

        setLoading(true)
        try {
            const result = await saveEpaycoConfig({
                provider: "epayco",
                is_active: config.isActive,
                is_test_mode: config.isTestMode,
                public_key: config.publicKey,
                private_key: config.privateKey,
                integrity_secret: config.customerId
            })

            if (result.success) {
                toast.success("Configuración guardada correctamente")
                setConnectionStatus('unknown')
            } else {
                toast.error(result.error || "Error al guardar configuración")
            }
        } catch (error) {
            toast.error("Error inesperado al guardar")
        } finally {
            setLoading(false)
        }
    }

    const handleTestConnection = async () => {
        if (!config.publicKey || !config.privateKey || !config.customerId) {
            toast.error("Guarda la configuración antes de probar la conexión")
            return
        }

        setTesting(true)
        try {
            const result = await testEpaycoConnection()
            if (result.success && result.data?.success) {
                setConnectionStatus('success')
                toast.success(result.data.message || "Conexión exitosa con ePayco")
            } else {
                setConnectionStatus('error')
                const errorMessage = result.success 
                    ? result.data?.message || "Error de conexión"
                    : result.error || "Error de conexión"
                toast.error(errorMessage)
            }
        } catch (error) {
            setConnectionStatus('error')
            toast.error("Error al probar conexión")
        } finally {
            setTesting(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Estado de Conexión */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                Estado de ePayco
                                {connectionStatus === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
                                {connectionStatus === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
                                {connectionStatus === 'unknown' && <AlertCircle className="h-5 w-5 text-yellow-500" />}
                            </CardTitle>
                            <CardDescription>
                                Estado actual de tu integración con ePayco
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
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                {connectionStatus === 'success' && "Conexión verificada correctamente"}
                                {connectionStatus === 'error' && "Error en la conexión - verifica tus credenciales"}
                                {connectionStatus === 'unknown' && "Conexión no verificada"}
                            </p>
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
                    <CardTitle>Configuración de Credenciales</CardTitle>
                    <CardDescription>
                        Configura tus credenciales de ePayco para procesar pagos
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
                                    <li>Ingresa a tu panel de ePayco</li>
                                    <li>Ve a <strong>Configuración → Llaves secretas</strong></li>
                                    <li>Copia las 3 credenciales requeridas</li>
                                </ol>
                                <Button variant="ghost" size="sm" className="p-0 h-auto" asChild>
                                    <a href="https://dashboard.epayco.com/configuration" target="_blank" rel="noopener noreferrer">
                                        Abrir panel de ePayco <ExternalLink className="ml-1 h-3 w-3" />
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
                            onCheckedChange={(checked) => setConfig(prev => ({ ...prev, isTestMode: checked }))}
                        />
                    </div>

                    {/* PUBLIC_KEY */}
                    <div className="space-y-2">
                        <Label htmlFor="publicKey">PUBLIC_KEY</Label>
                        <Input
                            id="publicKey"
                            value={config.publicKey}
                            onChange={(e) => setConfig(prev => ({ ...prev, publicKey: e.target.value }))}
                            placeholder="01ba37b34854c00df764d760cbc3f52b"
                        />
                        <p className="text-xs text-slate-500">
                            Tu llave pública de ePayco (visible en el panel)
                        </p>
                    </div>

                    {/* P_KEY */}
                    <div className="space-y-2">
                        <Label htmlFor="privateKey">P_KEY (Llave Privada)</Label>
                        <div className="relative">
                            <Input
                                id="privateKey"
                                type={showPrivateKey ? "text" : "password"}
                                value={config.privateKey}
                                onChange={(e) => setConfig(prev => ({ ...prev, privateKey: e.target.value }))}
                                placeholder="3265b1b7df98cd1f49bc0f2d5b3f8f778"
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
                            Tu llave privada de ePayco (mantén esto seguro)
                        </p>
                    </div>

                    {/* P_CUST_ID_CLIENTE */}
                    <div className="space-y-2">
                        <Label htmlFor="customerId">P_CUST_ID_CLIENTE</Label>
                        <div className="relative">
                            <Input
                                id="customerId"
                                type={showCustomerId ? "text" : "password"}
                                value={config.customerId}
                                onChange={(e) => setConfig(prev => ({ ...prev, customerId: e.target.value }))}
                                placeholder="82119"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowCustomerId(!showCustomerId)}
                            >
                                {showCustomerId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500">
                            Tu ID de cliente único de ePayco (número)
                        </p>
                    </div>

                    {/* Activar Pasarela */}
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label>Activar Pasarela</Label>
                            <p className="text-sm text-slate-500">
                                Permite que los clientes paguen con ePayco
                            </p>
                        </div>
                        <Switch
                            checked={config.isActive}
                            onCheckedChange={(checked) => setConfig(prev => ({ ...prev, isActive: checked }))}
                        />
                    </div>

                    {/* Botones */}
                    <div className="flex gap-3 pt-4">
                        <Button onClick={handleSave} disabled={loading} className="flex-1">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Configuración
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* URLs de Webhook */}
            <Card>
                <CardHeader>
                    <CardTitle>URLs de Configuración</CardTitle>
                    <CardDescription>
                        Configura estas URLs en tu panel de ePayco
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label className="text-sm font-medium">URL de Confirmación (Webhook)</Label>
                        <div className="mt-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-md font-mono text-sm">
                            {process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/payments/epayco
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Configura esta URL en ePayco → Configuración → URL Respuesta y Confirmación
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}