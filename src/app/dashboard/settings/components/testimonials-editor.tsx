"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { updateOrganization } from "../actions"
import Image from "next/image"

interface TestimonialsEditorProps {
    organization: {
        id: string
        name: string
        slug: string
        settings: any
    }
}

interface Testimonial {
    name: string
    role?: string
    text: string
    avatar?: string
    enabled: boolean
}

const DEFAULT_TESTIMONIALS: Testimonial[] = [
    {
        name: "María González",
        role: "Cliente frecuente",
        text: "Excelente servicio, muy rápido y confiable. Lo recomiendo totalmente.",
        enabled: true
    },
    {
        name: "Carlos Rodríguez",
        role: "Empresario",
        text: "La atención personalizada hace la diferencia. Muy satisfecho con mi compra.",
        enabled: true
    },
    {
        name: "Ana Martínez",
        text: "Productos de calidad y entrega súper rápida. Volveré a comprar sin duda.",
        enabled: true
    }
]

export function TestimonialsEditor({ organization }: TestimonialsEditorProps) {
    const [loading, setLoading] = useState(false)
    const [testimonials, setTestimonials] = useState<Testimonial[]>(
        organization.settings?.storefront?.testimonials || DEFAULT_TESTIMONIALS
    )

    // Guardar testimonios por defecto si no existen
    useEffect(() => {
        const saveDefaultTestimonials = async () => {
            // Solo guardar si no hay testimonios configurados
            if (!organization.settings?.storefront?.testimonials) {
                try {
                    await updateOrganization({
                        ...organization,
                        settings: {
                            ...organization.settings,
                            storefront: {
                                ...organization.settings?.storefront,
                                testimonials: DEFAULT_TESTIMONIALS
                            }
                        }
                    })
                } catch (error) {
                    console.error("Error saving default testimonials:", error)
                }
            }
        }

        saveDefaultTestimonials()
    }, [organization])

    const handleToggle = (index: number) => {
        const updated = [...testimonials]
        updated[index].enabled = !updated[index].enabled
        setTestimonials(updated)
    }

    const handleFieldChange = (index: number, field: keyof Testimonial, value: string) => {
        const updated = [...testimonials]
        updated[index] = { ...updated[index], [field]: value }
        setTestimonials(updated)
    }

    const handleAddTestimonial = () => {
        setTestimonials([...testimonials, {
            name: "Nuevo Cliente",
            role: "",
            text: "Testimonio del cliente...",
            enabled: true
        }])
    }

    const handleRemoveTestimonial = (index: number) => {
        setTestimonials(testimonials.filter((_, i) => i !== index))
    }

    const handleSave = async () => {
        setLoading(true)
        try {
            await updateOrganization({
                ...organization,
                settings: {
                    ...organization.settings,
                    storefront: {
                        ...organization.settings?.storefront,
                        testimonials: testimonials
                    }
                }
            })
            alert("Testimonios guardados correctamente")
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
            <CardHeader className="pb-6">
                <CardTitle className="text-xl font-bold text-[#1F2937] dark:text-white">Testimonios / Social Proof</CardTitle>
                <CardDescription className="text-base text-[#6B7280] dark:text-gray-400">
                    Configura los testimonios de clientes que aparecen en tu tienda
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-6">
                    {testimonials.map((testimonial, index) => (
                        <div key={index} className="border border-gray-200 dark:border-gray-800 rounded-xl p-6">
                            {/* Input Row */}
                            <div className="grid grid-cols-12 gap-4 items-start mb-4">
                                <div className="col-span-3">
                                    <label className="text-sm font-medium text-[#1F2937] dark:text-gray-300 block mb-2">
                                        Nombre
                                    </label>
                                    <Input
                                        value={testimonial.name}
                                        onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                                        className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                                        placeholder="Nombre del cliente"
                                    />
                                </div>
                                <div className="col-span-3">
                                    <label className="text-sm font-medium text-[#1F2937] dark:text-gray-300 block mb-2">
                                        Rol (opcional)
                                    </label>
                                    <Input
                                        value={testimonial.role || ''}
                                        onChange={(e) => handleFieldChange(index, 'role', e.target.value)}
                                        className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                                        placeholder="Ej: Cliente frecuente"
                                    />
                                </div>
                                <div className="col-span-3">
                                    <label className="text-sm font-medium text-[#1F2937] dark:text-gray-300 block mb-2">
                                        Avatar URL (opcional)
                                    </label>
                                    <Input
                                        value={testimonial.avatar || ''}
                                        onChange={(e) => handleFieldChange(index, 'avatar', e.target.value)}
                                        className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                                        placeholder="https://..."
                                    />
                                </div>
                                <div className="col-span-2 flex flex-col items-center pt-7">
                                    <Switch
                                        checked={testimonial.enabled}
                                        onCheckedChange={() => handleToggle(index)}
                                    />
                                    <span className="text-xs text-[#6B7280] dark:text-gray-400 mt-1">
                                        Activo
                                    </span>
                                </div>
                                <div className="col-span-1 flex justify-end pt-7">
                                    <button
                                        onClick={() => handleRemoveTestimonial(index)}
                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-xl">delete</span>
                                    </button>
                                </div>
                            </div>

                            {/* Testimonial Text */}
                            <div className="mb-4">
                                <label className="text-sm font-medium text-[#1F2937] dark:text-gray-300 block mb-2">
                                    Testimonio
                                </label>
                                <Textarea
                                    value={testimonial.text}
                                    onChange={(e) => handleFieldChange(index, 'text', e.target.value)}
                                    className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                                    placeholder="Escribe el testimonio del cliente..."
                                    rows={3}
                                />
                            </div>

                            {/* Preview Row */}
                            <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                                    <div className="flex justify-center mb-2">
                                        {[...Array(5)].map((_, i) => (
                                            <span key={i} className="text-yellow-400 text-sm">★</span>
                                        ))}
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 italic mb-3 text-center">
                                        "{testimonial.text}"
                                    </p>
                                    <div className="flex items-center justify-center gap-2">
                                        {testimonial.avatar && (
                                            <Image
                                                src={testimonial.avatar}
                                                alt={testimonial.name}
                                                width={24}
                                                height={24}
                                                className="rounded-full object-cover"
                                            />
                                        )}
                                        <div className="text-center">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                {testimonial.name}
                                            </p>
                                            {testimonial.role && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {testimonial.role}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleAddTestimonial}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-gray-200 dark:border-gray-700 rounded-lg text-base font-medium text-[#1F2937] dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                    <span className="material-symbols-outlined text-xl">add</span>
                    Agregar Testimonio
                </button>

                <Button
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-white text-base font-bold"
                >
                    {loading ? "Guardando..." : "Guardar Testimonios"}
                </Button>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                    <p className="text-sm text-[#6B7280] dark:text-gray-400">
                        💡 <strong>Tip:</strong> Los testimonios auténticos aumentan la confianza. Usa nombres reales y fotos si es posible.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}