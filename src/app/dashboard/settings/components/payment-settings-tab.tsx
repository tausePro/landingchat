"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Info, CreditCard, Copy, TestTube } from "lucide-react"
import { toast } from "sonner"
import { 
    getPaymentConfig, 
    savePaymentConfig, 
    testConnection, 
    toggleGateway,
    getManualPaymentMethods,
    saveManualPaymentMethods 
} from "../payments/actions"
import type { PaymentGatewayConfig, ManualPaymentMethods } from "@/types"

export function PaymentSettingsTab() {
    // Estados para pasarelas online
    const [gatewayConfig, setGatewayConfig] = useState<PaymentGatewayConfig | null>(null)
    const [gatewayLoading, setGatewayLoading] = useState(true)
    const [gatewaySaving, setGatewaySaving] = useState(false)
    const [testing, setTesting] = useState(false)
    
    // Estados para métodos manuales
    const [, setManualConfig] = useState<ManualPaymentMethods | null>(null)
    const [manualLoading, setManualLoading] = useState(true)
    const [manualSaving, setManualSaving] = useState(false)
    
    const [gatewayFormData, setGatewayFormData] = useState({
        provider: "wompi" as "wompi" | "epayco",
        is_active: false,
        is_test_mode: true,
        public_key: "",
        private_key: "",
        integrity_secret: "",
        encryption_key: "",
    })
    
    const [manualFormData, setManualFormData] = useState({
        // Transferencia Bancaria
        bank_transfer_enabled: false,
        bank_name: "",
        account_type: "ahorros" as "ahorros" | "corriente",
        account_number: "",
        account_holder: "",
        nequi_number: "",
        // Pago Contra Entrega
        cod_enabled: false,
        cod_additional_cost: 0,
        cod_zones: [] as string[],
    })

    const fetchGatewayConfig = async () => {
        const result = await getPaymentConfig()
        if (result.success && result.data) {
            setGatewayConfig(result.data)
            setGatewayFormData({
                provider: result.data.provider,
                is_active: result.data.is_active,
                is_test_mode: result.data.is_test_mode,
                public_key: result.data.public_key || "",
                private_key: "", // No mostrar la clave encriptada
                integrity_secret: "",
                encryption_key: "",
            })
        }
        setGatewayLoading(false)
    }

    const fetchManualConfig = async () => {
        const result = await getManualPaymentMethods()
        if (result.success && result.data) {
            setManualConfig(result.data)
            setManualFormData({
                bank_transfer_enabled: result.data.bank_transfer_enabled,
                bank_name: result.data.bank_name || "",
                account_type: result.data.account_type || "ahorros",
                account_number: result.data.account_number || "",
                account_holder: result.data.account_holder || "",
                nequi_number: result.data.nequi_number || "",
                cod_enabled: result.data.cod_enabled,
                cod_additional_cost: result.data.cod_additional_cost,
                cod_zones: result.data.cod_zones,
            })
        }
        setManualLoading(false)
    }

    useEffect(() => {
        fetchGatewayConfig()
        fetchManualConfig()
    }, [])

    const handleGatewayInputChange = (field: string, value: any) => {
        setGatewayFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleManualInputChange = (field: string, value: any) => {
        setManualFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSaveGateway = async () => {
        setGatewaySaving(true)
        try {
            const result = await savePaymentConfig(gatewayFormData)
            if (result.success) {
                toast.success("Configuración de pasarela guardada exitosamente")
                fetchGatewayConfig()
            } else {
                toast.error(result.error || "Error al guardar configuración")
            }
        } catch (error) {
            toast.error("Error inesperado")
        } finally {
            setGatewaySaving(false)
        }
    }

    const handleSaveManual = async () => {
        setManualSaving(true)
        try {
            const result = await saveManualPaymentMethods(manualFormData)
            if (result.success) {
                toast.success("Métodos de pago guardados exitosamente")
                fetchManualConfig()
            } else {
                toast.error(result.error || "Error al guardar configuración")
            }
        } catch (error) {
            toast.error("Error inesperado")
        } finally {
            setManualSaving(false)
        }
    }

    const handleTestConnection = async () => {
        setTesting(true)
        try {
            const result = await testConnection()
            if (result.success) {
                if (result.data?.success) {
                    toast.success(result.data.message)
                } else {
                    toast.error(result.data?.message || "Error en la conexión")
                }
            } else {
                toast.error(result.error || "Error al probar conexión")
            }
        } catch (error) {
            toast.error("Error inesperado")
        } finally {
            setTesting(false)
        }
    }

    const handleToggleGateway = async (isActive: boolean) => {
        try {
            const result = await toggleGateway(isActive)
            if (result.success) {
                toast.success(isActive ? "Pasarela activada" : "Pasarela desactivada")
                fetchGatewayConfig()
            } else {
                toast.error(result.error || "Error al cambiar estado")
            }
        } catch (error) {
            toast.error("Error inesperado")
        }
    }

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success("Copiado al portapapeles")
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(amount)
    }

    if (gatewayLoading || manualLoading) {
        return (
            <div className="space-y-6">
                <div className="h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Configuración de Pagos</h3>
                <p className="text-sm text-muted-foreground">
                    Configura tus pasarelas de pago y métodos alternativos para recibir pagos de clientes.
                </p>
            </div>

            {/* Pasarelas de Pago Online */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5" />
                                Pasarelas de Pago Online
                            </CardTitle>
                            <CardDescription>
                                Configura Wompi o ePayco para recibir pagos con tarjeta, PSE y Nequi
                            </CardDescription>
                        </div>
                        {gatewayConfig && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                    {gatewayConfig.is_active ? "Activa" : "Inactiva"}
                                </span>
                                <Switch
                                    checked={gatewayConfig.is_active}
                                    onCheckedChange={handleToggleGateway}
                                />
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Proveedor */}
                    <div className="space-y-2">
                        <Label htmlFor="provider" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Proveedor de Pago
                        </Label>
                        <Select
                            value={gatewayFormData.provider}
                            onValueChange={(value) => handleGatewayInputChange('provider', value)}
                        >
                            <SelectTrigger className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="wompi">Wompi - Tarjetas, PSE, Nequi</SelectItem>
                                <SelectItem value="epayco">ePayco - Tarjetas, PSE, Nequi</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Modo de Pruebas */}
                    <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900">
                        <div className="flex items-center gap-3">
                            <TestTube className="h-5 w-5 text-orange-500" />
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white">Modo de Pruebas</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Activa el modo sandbox para pruebas sin cobros reales
                                </p>
                            </div>
                        </div>
                        <Switch
                            checked={gatewayFormData.is_test_mode}
                            onCheckedChange={(checked) => handleGatewayInputChange('is_test_mode', checked)}
                        />
                    </div>

                    {/* Credenciales */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="public_key" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Llave Pública (PUBLIC_KEY)
                            </Label>
                            <Input
                                id="public_key"
                                placeholder="Tu llave pública"
                                value={gatewayFormData.public_key}
                                onChange={(e) => handleGatewayInputChange('public_key', e.target.value)}
                                className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="private_key" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Llave Privada (P_KEY)
                            </Label>
                            <Input
                                id="private_key"
                                type="password"
                                placeholder="Tu llave privada"
                                value={gatewayFormData.private_key}
                                onChange={(e) => handleGatewayInputChange('private_key', e.target.value)}
                                className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                            />
                        </div>
                        {gatewayFormData.provider === "epayco" && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="integrity_secret" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        P_CUST_ID_CLIENTE
                                    </Label>
                                    <Input
                                        id="integrity_secret"
                                        placeholder={
                                            gatewayConfig?.integrity_secret_encrypted
                                                ? "••••••••••••••••"
                                                : "Tu P_CUST_ID_CLIENTE de ePayco (ej: 82119)"
                                        }
                                        value={gatewayFormData.integrity_secret}
                                        onChange={(e) => handleGatewayInputChange('integrity_secret', e.target.value)}
                                        className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                                        required={!gatewayConfig?.integrity_secret_encrypted}
                                    />
                                    {gatewayConfig?.integrity_secret_encrypted && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Deja vacío para mantener el valor actual
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Tu ID de cliente único de ePayco
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="encryption_key" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        P_ENCRYPTION_KEY
                                    </Label>
                                    <Input
                                        id="encryption_key"
                                        type="password"
                                        placeholder={
                                            gatewayConfig?.encryption_key_encrypted
                                                ? "••••••••••••••••"
                                                : "Tu P_ENCRYPTION_KEY de ePayco"
                                        }
                                        value={gatewayFormData.encryption_key}
                                        onChange={(e) => handleGatewayInputChange('encryption_key', e.target.value)}
                                        className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                                        required={!gatewayConfig?.encryption_key_encrypted}
                                    />
                                    {gatewayConfig?.encryption_key_encrypted && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Deja vacío para mantener la llave actual
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Tu llave de encriptación de ePayco para validar webhooks
                                    </p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Información de ayuda */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                        <div className="flex items-start gap-3">
                            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                            <div className="space-y-2">
                                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                                    📋 Configuración de {gatewayFormData.provider === "wompi" ? "Wompi" : "ePayco"}
                                </p>
                                {gatewayFormData.provider === "epayco" ? (
                                    <div className="space-y-2">
                                        <p className="text-sm text-blue-800 dark:text-blue-200">
                                            Para configurar ePayco necesitas estos datos de tu panel:
                                        </p>
                                        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 ml-4">
                                            <li>• <strong>PUBLIC_KEY</strong> - Tu llave pública</li>
                                            <li>• <strong>P_KEY</strong> - Tu llave privada</li>
                                            <li>• <strong>P_CUST_ID_CLIENTE</strong> - Tu ID de cliente</li>
                                            <li>• <strong>P_ENCRYPTION_KEY</strong> - Tu llave de encriptación</li>
                                        </ul>
                                        <p className="text-xs text-blue-600 dark:text-blue-400">
                                            Los encuentras en: ePayco → Configuración → Llaves secretas
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-sm text-blue-800 dark:text-blue-200">
                                            Para configurar Wompi necesitas:
                                        </p>
                                        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 ml-4">
                                            <li>• <strong>Llave Pública</strong> - pub_test_xxxxx o pub_prod_xxxxx</li>
                                            <li>• <strong>Llave Privada</strong> - prv_test_xxxxx o prv_prod_xxxxx</li>
                                        </ul>
                                        <p className="text-xs text-blue-600 dark:text-blue-400">
                                            Los encuentras en: Wompi → Desarrolladores
                                        </p>
                                    </div>
                                )}
                                <div className="space-y-1 text-xs text-blue-600 dark:text-blue-400">
                                    <a 
                                        href={gatewayFormData.provider === "wompi" ? "https://docs.wompi.co/" : "https://docs.epayco.co/"} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 hover:underline"
                                    >
                                        <span>Guía de configuración completa</span>
                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Webhook URL */}
                    {gatewayConfig?.webhook_url && (
                        <div className="space-y-3">
                            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                URL de Webhook
                            </Label>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Configura esta URL en tu panel de {gatewayConfig.provider} para recibir notificaciones de pago:
                            </p>
                            <div className="flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-800 p-3">
                                <code className="flex-1 truncate text-sm font-mono">{gatewayConfig.webhook_url}</code>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCopy(gatewayConfig.webhook_url!)}
                                    className="h-8 w-8 p-0"
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Botones de acción */}
                    <div className="flex gap-3 pt-4">
                        <Button 
                            onClick={handleSaveGateway} 
                            disabled={gatewaySaving}
                            className="h-12 rounded-xl bg-primary text-white hover:bg-primary/90 font-medium"
                        >
                            {gatewaySaving ? "Guardando..." : "Guardar Configuración"}
                        </Button>
                        {gatewayConfig && (
                            <Button 
                                variant="outline"
                                onClick={handleTestConnection} 
                                disabled={testing}
                                className="h-12 rounded-xl border-gray-300 dark:border-gray-700"
                            >
                                {testing ? "Probando..." : "Probar Conexión"}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Métodos de Pago Manuales */}
            <Card>
                <CardHeader>
                    <CardTitle>Otros Métodos de Pago Directos</CardTitle>
                    <CardDescription>
                        Configura transferencias bancarias y pago contra entrega para ofrecer más opciones a tus clientes
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Transferencia Bancaria */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-medium text-gray-900 dark:text-white">Transferencia Bancaria</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Habilita transferencias directas a tu cuenta bancaria
                                </p>
                            </div>
                            <Switch
                                checked={manualFormData.bank_transfer_enabled}
                                onCheckedChange={(checked) => handleManualInputChange('bank_transfer_enabled', checked)}
                            />
                        </div>

                        {manualFormData.bank_transfer_enabled && (
                            <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="bank_name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Nombre del Banco
                                        </Label>
                                        <Input
                                            id="bank_name"
                                            placeholder="Ej. Bancolombia"
                                            value={manualFormData.bank_name}
                                            onChange={(e) => handleManualInputChange('bank_name', e.target.value)}
                                            className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="account_type" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Tipo de Cuenta
                                        </Label>
                                        <Select
                                            value={manualFormData.account_type}
                                            onValueChange={(value) => handleManualInputChange('account_type', value)}
                                        >
                                            <SelectTrigger className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ahorros">Ahorros</SelectItem>
                                                <SelectItem value="corriente">Corriente</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="account_number" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Número de Cuenta
                                        </Label>
                                        <Input
                                            id="account_number"
                                            placeholder="000-000000-00"
                                            value={manualFormData.account_number}
                                            onChange={(e) => handleManualInputChange('account_number', e.target.value)}
                                            className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="account_holder" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Titular de la Cuenta
                                        </Label>
                                        <Input
                                            id="account_holder"
                                            placeholder="Nombre completo del titular"
                                            value={manualFormData.account_holder}
                                            onChange={(e) => handleManualInputChange('account_holder', e.target.value)}
                                            className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                                        />
                                    </div>
                                </div>
                                <div className="md:w-1/2 space-y-2">
                                    <Label htmlFor="nequi_number" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Nequi (Opcional)
                                    </Label>
                                    <Input
                                        id="nequi_number"
                                        placeholder="300 123 4567"
                                        value={manualFormData.nequi_number}
                                        onChange={(e) => handleManualInputChange('nequi_number', e.target.value)}
                                        className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                                    />
                                </div>
                                
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
                                    <div className="flex items-start gap-2">
                                        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-blue-700 dark:text-blue-300">
                                            El cliente recibirá estos datos al confirmar su pedido para realizar el pago manual.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Pago Contra Entrega */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-medium text-gray-900 dark:text-white">Pago Contra Entrega (COD)</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Permite a tus clientes pagar en efectivo al recibir el producto
                                </p>
                            </div>
                            <Switch
                                checked={manualFormData.cod_enabled}
                                onCheckedChange={(checked) => handleManualInputChange('cod_enabled', checked)}
                            />
                        </div>

                        {manualFormData.cod_enabled && (
                            <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                                <div className="md:w-1/2 space-y-2">
                                    <Label htmlFor="cod_additional_cost" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Costo Adicional por COD (Opcional)
                                    </Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                        <Input
                                            id="cod_additional_cost"
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm pl-8 pr-12"
                                            value={manualFormData.cod_additional_cost}
                                            onChange={(e) => handleManualInputChange('cod_additional_cost', parseInt(e.target.value) || 0)}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">COP</span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Este valor se sumará al total del pedido si el cliente elige este método de pago.
                                    </p>
                                    {manualFormData.cod_additional_cost > 0 && (
                                        <p className="text-xs text-blue-600 dark:text-blue-400">
                                            Costo adicional: {formatCurrency(manualFormData.cod_additional_cost)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Botón Guardar */}
                    <div className="pt-4">
                        <Button 
                            onClick={handleSaveManual} 
                            disabled={manualSaving}
                            className="h-12 rounded-xl bg-primary text-white hover:bg-primary/90 font-medium"
                        >
                            {manualSaving ? "Guardando..." : "Guardar Métodos de Pago"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}