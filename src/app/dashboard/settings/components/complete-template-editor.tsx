"use client"

import { useState, useEffect } from "react"
import { ListEditor } from "./list-editor"
import { updateOrganization } from "../actions"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface CompleteTemplateEditorProps {
    organization: any
}

export function CompleteTemplateEditor({ organization }: CompleteTemplateEditorProps) {
    const router = useRouter()
    const templateConfig = organization.settings?.storefront?.templateConfig?.complete || {}

    const [steps, setSteps] = useState(templateConfig.steps || [
        { id: "1", title: "1. Chatea", description: "Cuéntale a nuestro asistente qué necesitas, como si hablaras con un amigo." },
        { id: "2", title: "2. Elige", description: "Recibe recomendaciones personalizadas y selecciona tu favorita." },
        { id: "3", title: "3. Recibe", description: "Coordina el envío y el pago directamente en el chat. ¡Listo!" }
    ])

    const [isSaving, setIsSaving] = useState(false)

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const updatedSettings = {
                ...organization.settings,
                storefront: {
                    ...organization.settings?.storefront,
                    templateConfig: {
                        ...organization.settings?.storefront?.templateConfig,
                        complete: {
                            steps
                        }
                    }
                }
            }

            await updateOrganization({
                name: organization.name,
                slug: organization.slug,
                settings: updatedSettings
            })

            router.refresh()
        } catch (error) {
            console.error("Error saving complete template config:", error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <ListEditor
                title="Pasos 'Cómo funciona'"
                description="Configura los 3 pasos que explican el proceso de compra"
                items={steps}
                onItemsChange={setSteps}
                maxItems={3}
                itemLabel="Paso"
            />

            <div className="flex justify-end">
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-primary hover:bg-primary/90"
                >
                    {isSaving ? "Guardando..." : "Guardar Configuración"}
                </Button>
            </div>
        </div>
    )
}
