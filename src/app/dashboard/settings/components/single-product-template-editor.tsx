"use client"

import { useState } from "react"
import { ListEditor } from "./list-editor"
import { updateOrganization } from "../actions"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface SingleProductTemplateEditorProps {
    organization: any
}

export function SingleProductTemplateEditor({ organization }: SingleProductTemplateEditorProps) {
    const router = useRouter()
    const templateConfig = organization.settings?.storefront?.templateConfig?.singleProduct || {}

    const [specs, setSpecs] = useState(templateConfig.specs || [
        { id: "1", title: "Característica 1", description: "Descripción detallada de la característica 1" },
        { id: "2", title: "Característica 2", description: "Descripción detallada de la característica 2" },
        { id: "3", title: "Característica 3", description: "Descripción detallada de la característica 3" },
        { id: "4", title: "Característica 4", description: "Descripción detallada de la característica 4" }
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
                        singleProduct: {
                            specs
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
            console.error("Error saving single product template config:", error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <ListEditor
                title="Características del Producto"
                description="Lista las características principales que aparecerán en la sección de detalles"
                items={specs}
                onItemsChange={setSpecs}
                maxItems={6}
                itemLabel="Característica"
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
