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

    const [provider, setProvider] = useState<PaymentProvider>(
        initialConfig?.provider || "wompi"
    )
    const [isTestMode, setIsTestMode] = useState(
        initialConfig?.is_test_mode ?? true
    )
    const [publicKey, setPublicKey] = useState(initialConfig?.public_key || "")
    const [privateKey, setPrivateKey] = useState("")
    const [integritySecret, setIntegritySecret] = useState("")

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
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
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
                    <Label htmlFor="publicKey">Llave Pública</Label>
                    <Input
                        id="publicKey"
                        value={publicKey}
                        onChange={(e) => setPublicKey(e.target.value)}
                        placeholder={
                            provider === "wompi"
                                ? "pub_test_xxxxx o pub_prod_xxxxx"
                                : "Tu llave pública de ePayco"
                        }
                        required
                    />
                    <p className="text-xs text-slate-500">
                        {provider === "wompi"
                            ? "Encuéntrala en tu panel de Wompi → Desarrolladores"
                            : "Encuéntrala en tu panel de ePayco → Integraciones"}
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="privateKey">Llave Privada</Label>
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
                                        : "Tu llave privada de ePayco"
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
            </div>

            <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {initialConfig ? "Actualizar Configuración" : "Guardar Configuración"}
            </Button>
        </form>
    )
}
