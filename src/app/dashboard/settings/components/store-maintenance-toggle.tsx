"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Wrench, Eye, EyeOff, Copy, RefreshCw, Link } from "lucide-react"

interface StoreMaintenanceToggleProps {
    organizationId: string
    storeSlug: string
    customDomain?: string | null
    initialMaintenanceMode?: boolean
    initialMaintenanceMessage?: string
    initialBypassToken?: string | null
}

export function StoreMaintenanceToggle({ 
    organizationId, 
    storeSlug,
    customDomain,
    initialMaintenanceMode = false,
    initialMaintenanceMessage = "Estamos realizando mejoras en nuestra tienda. Volveremos pronto con novedades increíbles.",
    initialBypassToken
}: StoreMaintenanceToggleProps) {
    const [isActive, setIsActive] = useState(initialMaintenanceMode)
    const [message, setMessage] = useState(initialMaintenanceMessage)
    const [bypassToken, setBypassToken] = useState(initialBypassToken || "")
    const [loading, setLoading] = useState(false)
    const [showMessageEditor, setShowMessageEditor] = useState(false)
    const [generatingToken, setGeneratingToken] = useState(false)



    const handleToggle = async (checked: boolean) => {
        setLoading(true)
        setIsActive(checked) // Optimistic update
        
        try {
            const res = await fetch("/api/dashboard/maintenance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    organizationId,
                    maintenanceMode: checked,
                    maintenanceMessage: message
                })
            })

            const responseData = await res.json()

            if (!res.ok) {
                throw new Error(responseData.error || "Failed to update")
            }

            toast.success(checked ? "Modo Mantenimiento Activado" : "Modo Mantenimiento Desactivado", {
                description: checked
                    ? "Tu tienda ahora muestra el mensaje de mantenimiento a los visitantes."
                    : "Tu tienda vuelve a estar visible para todos los visitantes.",
            })
        } catch (error: any) {
            setIsActive(!checked) // Revert on error
            toast.error("Error", {
                description: error.message || "No se pudo actualizar el modo de mantenimiento."
            })
        } finally {
            setLoading(false)
        }
    }

    const handleMessageUpdate = async () => {
        setLoading(true)
        
        try {
            const res = await fetch("/api/dashboard/maintenance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    organizationId,
                    maintenanceMode: isActive,
                    maintenanceMessage: message
                })
            })

            if (!res.ok) throw new Error("Failed to update")

            toast.success("Mensaje Actualizado", {
                description: "El mensaje de mantenimiento ha sido actualizado."
            })
            setShowMessageEditor(false)
        } catch (error) {
            toast.error("Error", {
                description: "No se pudo actualizar el mensaje."
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Main Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-4">
                <div className="flex items-center gap-3">
                    <div className={`size-2 rounded-full ${isActive ? "bg-yellow-500" : "bg-green-500"}`}></div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <Wrench className="size-4 text-text-light-secondary dark:text-text-dark-secondary" />
                            <span className="font-medium text-text-light-primary dark:text-text-dark-primary">
                                Modo Mantenimiento
                            </span>
                        </div>
                        <span className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                            {isActive ? "Tu tienda está oculta para el público" : "Tu tienda está visible para todos"}
                        </span>
                    </div>
                </div>
                <Switch
                    checked={isActive}
                    onCheckedChange={handleToggle}
                    disabled={loading}
                />
            </div>

            {/* Message Editor */}
            <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-4">
                <div className="flex items-center justify-between mb-4">
                    <Label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                        Mensaje de Mantenimiento
                    </Label>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowMessageEditor(!showMessageEditor)}
                        className="text-xs"
                    >
                        {showMessageEditor ? (
                            <>
                                <EyeOff className="size-3 mr-1" />
                                Ocultar
                            </>
                        ) : (
                            <>
                                <Eye className="size-3 mr-1" />
                                Editar
                            </>
                        )}
                    </Button>
                </div>

                {showMessageEditor ? (
                    <div className="space-y-3">
                        <Textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Escribe el mensaje que verán tus visitantes..."
                            className="min-h-[100px] resize-none"
                            maxLength={500}
                        />
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                {message.length}/500 caracteres
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setMessage(initialMaintenanceMessage)
                                        setShowMessageEditor(false)
                                    }}
                                    disabled={loading}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleMessageUpdate}
                                    disabled={loading || message.trim().length === 0}
                                >
                                    Guardar
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-text-light-secondary dark:text-text-dark-secondary bg-background-light dark:bg-background-dark rounded-md p-3">
                        {message}
                    </div>
                )}
            </div>

            {/* Bypass Token Section - Only show when maintenance is active */}
            {isActive && (
                <div className="rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Link className="size-4 text-text-light-secondary dark:text-text-dark-secondary" />
                            <Label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                Enlace de Previsualización
                            </Label>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleGenerateToken}
                            disabled={generatingToken}
                            className="text-xs"
                        >
                            <RefreshCw className={`size-3 mr-1 ${generatingToken ? 'animate-spin' : ''}`} />
                            {bypassToken ? 'Regenerar' : 'Generar'}
                        </Button>
                    </div>
                    
                    {bypassToken ? (
                        <div className="space-y-3">
                            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                Usa este enlace para ver tu tienda mientras está en mantenimiento:
                            </p>
                            <div className="flex gap-2">
                                <Input
                                    readOnly
                                    value={getBypassUrl()}
                                    className="text-xs font-mono bg-background-light dark:bg-background-dark"
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyBypassUrl}
                                    className="shrink-0"
                                >
                                    <Copy className="size-3" />
                                </Button>
                            </div>
                            <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                ⚠️ No compartas este enlace. Cualquiera con él puede ver tu tienda.
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                            Genera un enlace para previsualizar tu tienda mientras está en mantenimiento.
                        </p>
                    )}
                </div>
            )}

            {/* Info */}
            {isActive && (
                <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <div className="size-5 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Wrench className="size-3 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div className="text-sm">
                            <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                                Tu tienda está en mantenimiento
                            </p>
                            <ul className="text-yellow-700 dark:text-yellow-300 space-y-1">
                                <li>• Los visitantes verán el mensaje de mantenimiento</li>
                                <li>• Usa el enlace de previsualización para ver tu tienda</li>
                                <li>• Los pedidos existentes no se ven afectados</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )

    function getBypassUrl() {
        const domain = customDomain || `${storeSlug}.landingchat.co`
        return `https://${domain}?bypass=${bypassToken}`
    }

    async function handleCopyBypassUrl() {
        try {
            await navigator.clipboard.writeText(getBypassUrl())
            toast.success("Enlace copiado", {
                description: "El enlace de previsualización ha sido copiado al portapapeles."
            })
        } catch {
            toast.error("Error al copiar", {
                description: "No se pudo copiar el enlace."
            })
        }
    }

    async function handleGenerateToken() {
        setGeneratingToken(true)
        try {
            const res = await fetch("/api/dashboard/maintenance/bypass-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ organizationId })
            })

            if (!res.ok) throw new Error("Failed to generate token")

            const data = await res.json()
            setBypassToken(data.token)
            
            toast.success("Token generado", {
                description: "Se ha generado un nuevo enlace de previsualización."
            })
        } catch {
            toast.error("Error", {
                description: "No se pudo generar el token."
            })
        } finally {
            setGeneratingToken(false)
        }
    }
}