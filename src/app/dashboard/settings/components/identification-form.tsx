"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { updateOrganization } from "../actions"
import { useRouter } from "next/navigation"

interface IdentificationFormProps {
    organization: {
        id: string
        name: string
        slug: string
        settings: any
    }
}

export function IdentificationForm({ organization }: IdentificationFormProps) {
    const router = useRouter()
    const identificationSettings = organization.settings?.identification || {}

    const [enabled, setEnabled] = useState(identificationSettings.enabled ?? true)
    const [whatsappVerification, setWhatsappVerification] = useState(identificationSettings.whatsappVerification ?? false)
    const [returningUserVariant, setReturningUserVariant] = useState(identificationSettings.returningUserVariant ?? true)
    const [title, setTitle] = useState(identificationSettings.title || "¡Hola! Identifícate para continuar")
    const [subtitle, setSubtitle] = useState(identificationSettings.subtitle || "Necesitamos tu nombre y WhatsApp para darte una atención personalizada.")
    const [resendDelay, setResendDelay] = useState(identificationSettings.resendDelay || 60)
    const [allowOverride, setAllowOverride] = useState(identificationSettings.allowOverride ?? false)
    const [isSaving, setIsSaving] = useState(false)

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const updatedSettings = {
                ...organization.settings,
                identification: {
                    enabled,
                    whatsappVerification,
                    returningUserVariant,
                    title,
                    subtitle,
                    resendDelay,
                    allowOverride
                }
            }

            await updateOrganization({
                name: organization.name,
                slug: organization.slug,
                settings: updatedSettings
            })

            router.refresh()
        } catch (error) {
            console.error("Error saving identification settings:", error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-8">
            {/* Configuración General */}
            <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shadow-sm">
                <div className="p-6">
                    <h2 className="text-lg font-semibold">Configuración General</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Activa o desactiva las principales funciones del modal de identificación.
                    </p>
                </div>
                <div className="border-t border-border-light dark:border-border-dark">
                    <ul className="divide-y divide-border-light dark:divide-border-dark">
                        <li className="flex items-center justify-between p-6">
                            <div>
                                <h3 className="font-medium">Activar Modal de Identificación</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Requerir que el usuario se identifique antes de iniciar un chat.
                                </p>
                            </div>
                            <Switch
                                checked={enabled}
                                onCheckedChange={setEnabled}
                            />
                        </li>
                        <li className="flex items-center justify-between p-6">
                            <div>
                                <h3 className="font-medium">Requerir verificación de WhatsApp</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Enviar un código de verificación al WhatsApp del usuario.
                                </p>
                            </div>
                            <Switch
                                checked={whatsappVerification}
                                onCheckedChange={setWhatsappVerification}
                            />
                        </li>
                        <li className="flex items-center justify-between p-6">
                            <div>
                                <h3 className="font-medium">Mostrar Variante de Usuario que Regresa</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Si el número ya existe, mostrar un modal de bienvenida personalizado.
                                </p>
                            </div>
                            <Switch
                                checked={returningUserVariant}
                                onCheckedChange={setReturningUserVariant}
                            />
                        </li>
                    </ul>
                </div>
            </div>

            {/* Personalización de Textos */}
            <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shadow-sm">
                <div className="p-6 border-b border-border-light dark:border-border-dark">
                    <h2 className="text-lg font-semibold">Personalización de Textos</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Edita los textos que se muestran en el modal de identificación.
                    </p>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <Label htmlFor="modal-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Texto del Título
                        </Label>
                        <Input
                            id="modal-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <Label htmlFor="modal-subtitle" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Texto del Subtítulo
                        </Label>
                        <Textarea
                            id="modal-subtitle"
                            rows={3}
                            value={subtitle}
                            onChange={(e) => setSubtitle(e.target.value)}
                            className="mt-1"
                        />
                    </div>
                </div>
            </div>

            {/* Configuración Avanzada */}
            <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shadow-sm">
                <div className="p-6 border-b border-border-light dark:border-border-dark">
                    <h2 className="text-lg font-semibold">Configuración Avanzada</h2>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <Label htmlFor="resend-time" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Tiempo de reenvío de código
                        </Label>
                        <div className="relative mt-1">
                            <Input
                                id="resend-time"
                                type="number"
                                value={resendDelay}
                                onChange={(e) => setResendDelay(parseInt(e.target.value) || 60)}
                                className="pr-20"
                            />
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                <span className="text-gray-500 dark:text-gray-400 text-sm">segundos</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Permisos de Configuración */}
            <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shadow-sm">
                <div className="p-6">
                    <h2 className="text-lg font-semibold">Permisos de Configuración</h2>
                </div>
                <div className="border-t border-border-light dark:border-border-dark">
                    <div className="flex items-start justify-between p-6">
                        <div>
                            <h3 className="font-medium">Permitir sobrescritura por empresas</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
                                Si está activo, las empresas cliente podrán modificar esta configuración para sus propias tiendas.
                            </p>
                        </div>
                        <Switch
                            checked={allowOverride}
                            onCheckedChange={setAllowOverride}
                        />
                    </div>
                </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex justify-end gap-3 border-t border-border-light dark:border-border-dark pt-6">
                <Button
                    variant="outline"
                    onClick={() => router.refresh()}
                    disabled={isSaving}
                    className="h-10 px-5 text-sm font-semibold"
                >
                    Cancelar
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="h-10 px-5 text-sm font-semibold bg-primary hover:bg-primary/90"
                >
                    {isSaving ? "Guardando..." : "Guardar Cambios"}
                </Button>
            </div>
        </div>
    )
}
