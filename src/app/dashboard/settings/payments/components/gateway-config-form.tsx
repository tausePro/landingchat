"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, Eye, EyeOff } from "lucide-react"
import type { PaymentGatewayConfig, PaymentProvider } from "@/types"
import { savePaymentConfig } from "../actions"

interface GatewayConfigFormProps {
    initialConfig: PaymentGatewayConfig | null
    onSaved: () => void
}

export function GatewayConfigForm({
    initialConfig,
    onSaved,
}: GatewayConfigFormProps) {
    const [loading, setLoading] = useState(false)
    const [showPrivateKey, setShowPrivateKey] = useState(false)
    const [showIntegritySecret, setShowIntegritySecret] = useState(false)
    const [showEncryptionKey, setShowEncryptionKey] = useState(false)

    const [provider, setProvider] = useState<PaymentProvider>(
        initialConfig?.provider || "wompi"
    )
    const [isTestMode, setIsTestMode] = useState(
        initialConfig?.is_test_mode ?? true
    )
    const [publicKey, setPublicKey] = useState(initialConfig?.public_key || "")
    const [privateKey, setPrivateKey] = useState("")
    const [integritySecret, setIntegritySecret] = useState("")
    const [encryptionKey, setEncryptionKey] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const result = await savePaymentConfig({
                provider,
                is_test_mode: isTestMode,
                public_key: publicKey,
                private_key: privateKey,
                integrity_secret: integritySecret || undefined,
                encryption_key: encryptionKey || undefined,
            })

            if (result.success) {
                toast.success("Configuración guardada", {
                    description: "La pasarela de pago ha sido configurada correctamente.",
                })
                onSaved()
            } else {
                toast.error("Error", { description: result.error })
            }
        } catch {
            toast.error("Error", { description: "No se pudo guardar la configuración" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="provider">Proveedor de Pago</Label>
                    <Select
                        value={provider}
                        onValueChange={(v) => setProvider(v as PaymentProvider)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Selecciona un proveedor" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="wompi">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">Wompi</span>
                                    <span className="text-xs text-slate-500">
                                        (Bancolombia)
                                    </span>
                                </div>
                            </SelectItem>
                            <SelectItem value="epayco">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">ePayco</span>
                                    <span className="text-xs text-slate-500">
                                        (Tarjetas, PSE, Nequi)
                                    </span>
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    {provider === "epayco" && (
                        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 text-sm">
                            <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                                📋 Configuración de ePayco
                            </p>
                            <p className="text-blue-800 dark:text-blue-200 mb-2">
                                Para configurar ePayco necesitas estos datos de tu panel:
                            </p>
                            <ul className="text-blue-700 dark:text-blue-300 space-y-1 ml-4">
                                <li>• <strong>PUBLIC_KEY</strong> - Tu llave pública</li>
                                <li>• <strong>P_KEY</strong> - Tu llave privada</li>
                                <li>• <strong>P_CUST_ID_CLIENTE</strong> - Tu ID de cliente</li>
                                <li>• <strong>P_ENCRYPTION_KEY</strong> - Tu llave de encriptación</li>
                            </ul>
                            <p className="text-blue-600 dark:text-blue-400 mt-2 text-xs">
                                Los encuentras en: ePayco → Configuración → Llaves secretas
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label>Modo de Pruebas</Label>
                        <p className="text-sm text-slate-500">
                            Activa el modo sandbox para pruebas sin cobros reales
                        </p>
                    </div>
                    <Switch checked={isTestMode} onCheckedChange={setIsTestMode} />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="publicKey">
                        {provider === "epayco" ? "Llave Pública (PUBLIC_KEY)" : "Llave Pública"}
                    </Label>
                    <Input
                        id="publicKey"
                        value={publicKey}
                        onChange={(e) => setPublicKey(e.target.value)}
                        placeholder={
                            provider === "wompi"
                                ? "pub_test_xxxxx o pub_prod_xxxxx"
                                : provider === "epayco"
                                    ? "01ba37b34854c00df764d760cbc3f52b"
                                    : "Tu llave pública"
                        }
                        required
                    />
                    <p className="text-xs text-slate-500">
                        {provider === "wompi"
                            ? "Encuéntrala en tu panel de Wompi → Desarrolladores"
                            : provider === "epayco"
                                ? "Encuéntrala en tu panel de ePayco → Configuración → Llaves secretas"
                                : "Encuéntrala en tu panel del proveedor"}
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="privateKey">
                        {provider === "epayco" ? "Llave Privada (P_KEY)" : "Llave Privada"}
                    </Label>
                    <div className="relative">
                        <Input
                            id="privateKey"
                            type={showPrivateKey ? "text" : "password"}
                            value={privateKey}
                            onChange={(e) => setPrivateKey(e.target.value)}
                            placeholder={
                                initialConfig?.private_key_encrypted
                                    ? "••••••••••••••••"
                                    : provider === "wompi"
                                        ? "prv_test_xxxxx o prv_prod_xxxxx"
                                        : provider === "epayco"
                                            ? "Tu P_KEY de ePayco"
                                            : "Tu llave privada"
                            }
                            required={!initialConfig?.private_key_encrypted}
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowPrivateKey(!showPrivateKey)}
                        >
                            {showPrivateKey ? (
                                <EyeOff className="h-4 w-4" />
                            ) : (
                                <Eye className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                    {initialConfig?.private_key_encrypted && (
                        <p className="text-xs text-slate-500">
                            Deja vacío para mantener la llave actual
                        </p>
                    )}
                    {provider === "epayco" && (
                        <p className="text-xs text-slate-500">
                            Esta es tu P_KEY que encuentras en ePayco → Configuración → Llaves secretas
                        </p>
                    )}
                </div>

                {provider === "wompi" && (
                    <div className="space-y-2">
                        <Label htmlFor="integritySecret">
                            Secreto de Integridad (Opcional)
                        </Label>
                        <div className="relative">
                            <Input
                                id="integritySecret"
                                type={showIntegritySecret ? "text" : "password"}
                                value={integritySecret}
                                onChange={(e) => setIntegritySecret(e.target.value)}
                                placeholder={
                                    initialConfig?.integrity_secret_encrypted
                                        ? "••••••••••••••••"
                                        : "Secreto para validar webhooks"
                                }
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowIntegritySecret(!showIntegritySecret)}
                            >
                                {showIntegritySecret ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500">
                            Necesario para validar webhooks de Wompi
                        </p>
                    </div>
                )}

                {provider === "epayco" && (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="integritySecret">
                                P_CUST_ID_CLIENTE
                            </Label>
                            <div className="relative">
                                <Input
                                    id="integritySecret"
                                    type={showIntegritySecret ? "text" : "password"}
                                    value={integritySecret}
                                    onChange={(e) => setIntegritySecret(e.target.value)}
                                    placeholder={
                                        initialConfig?.integrity_secret_encrypted
                                            ? "••••••••••••••••"
                                            : "Tu P_CUST_ID_CLIENTE de ePayco"
                                    }
                                    required
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3"
                                    onClick={() => setShowIntegritySecret(!showIntegritySecret)}
                                >
                                    {showIntegritySecret ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            <p className="text-xs text-slate-500">
                                Tu ID de cliente único de ePayco (ejemplo: 82119)
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="encryptionKey">
                                P_ENCRYPTION_KEY
                            </Label>
                            <div className="relative">
                                <Input
                                    id="encryptionKey"
                                    type={showEncryptionKey ? "text" : "password"}
                                    value={encryptionKey}
                                    onChange={(e) => setEncryptionKey(e.target.value)}
                                    placeholder={
                                        initialConfig?.encryption_key_encrypted
                                            ? "••••••••••••••••"
                                            : "Tu P_ENCRYPTION_KEY de ePayco"
                                    }
                                    required={!initialConfig?.encryption_key_encrypted}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3"
                                    onClick={() => setShowEncryptionKey(!showEncryptionKey)}
                                >
                                    {showEncryptionKey ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            {initialConfig?.encryption_key_encrypted && (
                                <p className="text-xs text-slate-500">
                                    Deja vacío para mantener la llave actual
                                </p>
                            )}
                            <p className="text-xs text-slate-500">
                                Tu llave de encriptación de ePayco para validar webhooks
                            </p>
                        </div>
                    </>
                )}
            </div>

            <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {initialConfig ? "Actualizar Configuración" : "Guardar Configuración"}
            </Button>
        </form>
    )
}
