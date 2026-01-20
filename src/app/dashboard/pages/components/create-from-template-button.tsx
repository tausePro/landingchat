"use client"

import { Button } from "@/components/ui/button"
import { createFromTemplate } from "../actions"
import { PageTemplate } from "../templates"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface CreateFromTemplateButtonProps {
    template: PageTemplate
}

export function CreateFromTemplateButton({ template }: CreateFromTemplateButtonProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)

    const handleClick = async () => {
        setIsLoading(true)
        try {
            const result = await createFromTemplate(template.slug)
            if (result.success && result.page) {
                toast.success(`Página "${template.title}" creada`)
                router.push(`/dashboard/pages/${result.page.id}`)
            } else {
                toast.error(result.error || "Error al crear la página")
            }
        } catch (error) {
            toast.error("Error inesperado")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleClick}
            disabled={isLoading}
        >
            {isLoading ? (
                <span className="material-symbols-outlined text-sm mr-1 animate-spin">progress_activity</span>
            ) : (
                <span className="material-symbols-outlined text-sm mr-1">add</span>
            )}
            {template.title}
        </Button>
    )
}
