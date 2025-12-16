"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { updateOrganization } from "../actions"
import { useRouter } from "next/navigation"

interface TypographySelectorProps {
    organization: {
        id: string
        name: string
        slug: string
        settings: any
    }
}

const FONT_OPTIONS = [
    { value: "Inter", label: "Inter", className: "font-sans" },
    { value: "Poppins", label: "Poppins", className: "font-sans" },
    { value: "Roboto", label: "Roboto", className: "font-sans" },
    { value: "Montserrat", label: "Montserrat", className: "font-sans" },
    { value: "Playfair Display", label: "Playfair Display", className: "font-serif" },
    { value: "Cinzel", label: "Cinzel", className: "font-serif" },
]

const TEXT_COLOR_OPTIONS = [
    { value: "default", label: "Por defecto", color: "#1F2937" },
    { value: "warm", label: "Cálido", color: "#92400E" },
    { value: "cool", label: "Frío", color: "#1E40AF" },
    { value: "elegant", label: "Elegante", color: "#374151" },
    { value: "modern", label: "Moderno", color: "#111827" },
    { value: "soft", label: "Suave", color: "#6B7280" },
]

export function TypographySelector({ organization }: TypographySelectorProps) {
    const router = useRouter()
    const typographySettings = organization.settings?.storefront?.typography || {}

    const [fontFamily, setFontFamily] = useState(typographySettings.fontFamily || "Inter")
    const [textColor, setTextColor] = useState(typographySettings.textColor || "default")
    const [isSaving, setIsSaving] = useState(false)

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const updatedSettings = {
                ...organization.settings,
                storefront: {
                    ...organization.settings?.storefront,
                    typography: {
                        fontFamily,
                        textColor
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
            console.error("Error saving typography settings:", error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shadow-sm">
                <div className="p-6 border-b border-border-light dark:border-border-dark">
                    <h2 className="text-lg font-semibold">Tipografía</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Selecciona la fuente principal para tu storefront
                    </p>
                </div>
                <div className="p-6">
                    <Label htmlFor="font-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Fuente Principal
                    </Label>
                    <div className="relative">
                        <select
                            id="font-select"
                            value={fontFamily}
                            onChange={(e) => setFontFamily(e.target.value)}
                            className="appearance-none w-full h-12 pl-4 pr-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-gray-900 dark:text-white"
                        >
                            {FONT_OPTIONS.map((font) => (
                                <option key={font.value} value={font.value} className={font.className}>
                                    {font.label}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                            <span className="material-symbols-outlined">expand_more</span>
                        </div>
                    </div>

                    {/* Text Color */}
                    <div className="mt-6">
                        <Label htmlFor="color-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Color de Texto
                        </Label>
                        <div className="grid grid-cols-3 gap-3">
                            {TEXT_COLOR_OPTIONS.map((colorOption) => (
                                <button
                                    key={colorOption.value}
                                    onClick={() => setTextColor(colorOption.value)}
                                    className={`p-3 rounded-lg border-2 transition-all ${
                                        textColor === colorOption.value
                                            ? 'border-primary bg-primary/10'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-4 h-4 rounded-full border border-gray-300"
                                            style={{ backgroundColor: colorOption.color }}
                                        />
                                        <span className="text-sm font-medium">{colorOption.label}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="mt-6 p-6 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Vista Previa</p>
                        <div style={{ fontFamily: fontFamily }}>
                            <h3 
                                className="text-2xl font-bold mb-2"
                                style={{ 
                                    color: TEXT_COLOR_OPTIONS.find(c => c.value === textColor)?.color || "#1F2937"
                                }}
                            >
                                Título de Ejemplo
                            </h3>
                            <p 
                                className="text-base"
                                style={{ 
                                    color: TEXT_COLOR_OPTIONS.find(c => c.value === textColor)?.color || "#6B7280",
                                    opacity: 0.8
                                }}
                            >
                                Este es un texto de ejemplo para que veas cómo se verá la tipografía en tu storefront.
                            </p>
                        </div>
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
