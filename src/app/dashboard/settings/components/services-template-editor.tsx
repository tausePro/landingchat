"use client"

import { useState } from "react"
import { ListEditor } from "./list-editor"
import { updateOrganization } from "../actions"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface ServicesTemplateEditorProps {
    organization: any
}

export function ServicesTemplateEditor({ organization }: ServicesTemplateEditorProps) {
    const router = useRouter()
    const templateConfig = organization.settings?.storefront?.templateConfig?.services || {}

    const [testimonials, setTestimonials] = useState(templateConfig.testimonials || [
        { id: "1", title: "Cliente Verificado", description: "El servicio superó todas mis expectativas. La atención al detalle y la profesionalidad del equipo son inigualables." },
        { id: "2", title: "CEO, Tech Company", description: "Increíble experiencia de trabajo. Altamente recomendados para cualquier proyecto serio." }
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
                        services: {
                            testimonials
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
            console.error("Error saving services template config:", error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <ListEditor
                title="Testimonios de Clientes"
                description="Agrega testimonios para generar confianza (Título = Nombre/Cargo)"
                items={testimonials}
                onItemsChange={setTestimonials}
                maxItems={4}
                itemLabel="Testimonio"
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
