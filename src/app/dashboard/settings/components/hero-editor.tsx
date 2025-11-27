"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { ImageUploader } from "@/components/ui/image-uploader"
import { updateOrganization } from "../actions"
import { useRouter } from "next/navigation"

interface HeroEditorProps {
    organization: {
        id: string
        name: string
        slug: string
        settings: any
    }
}

export function HeroEditor({ organization }: HeroEditorProps) {
    const router = useRouter()
    const heroSettings = organization.settings?.storefront?.hero || {}

    const [title, setTitle] = useState(heroSettings.title || "Descubre nuestras ofertas exclusivas")
    const [subtitle, setSubtitle] = useState(heroSettings.subtitle || "Productos seleccionados con descuento especial.")
    const [backgroundImage, setBackgroundImage] = useState(heroSettings.backgroundImage || "")
    const [showChatButton, setShowChatButton] = useState(heroSettings.showChatButton ?? true)
    const [chatButtonText, setChatButtonText] = useState(heroSettings.chatButtonText || "Iniciar Chat")
    const [isSaving, setIsSaving] = useState(false)

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const updatedSettings = {
                ...organization.settings,
                storefront: {
                    ...organization.settings?.storefront,
                    hero: {
                        title,
                        subtitle,
                        backgroundImage,
                        showChatButton,
                        chatButtonText
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
            console.error("Error saving hero settings:", error)
        } finally {
            setIsSaving(false)
        }
    }

    const titleCharCount = title.length
    const subtitleCharCount = subtitle.length

    return (
        <div className="space-y-6">
            {/* Contenido de Texto */}
            <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shadow-sm">
                <div className="p-6 border-b border-border-light dark:border-border-dark">
                    <h2 className="text-lg font-semibold">Contenido de Texto</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Personaliza los textos principales de tu storefront
                    </p>
                </div>
                <div className="p-6 space-y-6">
                    {/* Título Principal */}
                    <div>
                        <Label htmlFor="hero-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Título Principal
                        </Label>
                        <Input
                            id="hero-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={60}
                            className="mt-1"
                            placeholder="Ej: Descubre nuestras ofertas exclusivas"
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            El texto principal que verán tus clientes. ({titleCharCount}/60)
                        </p>
                    </div>

                    {/* Subtítulo */}
                    <div>
                        <Label htmlFor="hero-subtitle" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Subtítulo
                        </Label>
                        <Textarea
                            id="hero-subtitle"
                            value={subtitle}
                            onChange={(e) => setSubtitle(e.target.value)}
                            maxLength={120}
                            rows={3}
                            className="mt-1"
                            placeholder="Ej: Productos seleccionados con un 20% de descuento solo esta semana."
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            Describe tu propuesta de valor en una frase corta. ({subtitleCharCount}/120)
                        </p>
                    </div>
                </div>
            </div>

            {/* Imagen de Fondo */}
            <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shadow-sm">
                <div className="p-6 border-b border-border-light dark:border-border-dark">
                    <h2 className="text-lg font-semibold">Imagen de Fondo</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Sube una imagen para el fondo del hero (recomendado: 1920x1080px)
                    </p>
                </div>
                <div className="p-6">
                    <ImageUploader
                        currentImageUrl={backgroundImage}
                        onImageUploaded={setBackgroundImage}
                        folder="hero"
                        maxSizeMB={5}
                    />
                </div>
            </div>

            {/* Botón de Chat */}
            <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shadow-sm">
                <div className="p-6 border-b border-border-light dark:border-border-dark">
                    <h2 className="text-lg font-semibold">Botón de Chat</h2>
                </div>
                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-base font-medium text-gray-800 dark:text-gray-200">Mostrar botón de chat</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Activa o desactiva el botón principal de chat en el hero
                            </p>
                        </div>
                        <Switch
                            checked={showChatButton}
                            onCheckedChange={setShowChatButton}
                        />
                    </div>

                    {showChatButton && (
                        <>
                            <div className="border-t border-gray-200 dark:border-gray-700 -mx-6"></div>
                            <div>
                                <Label htmlFor="chat-button-text" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Texto del botón
                                </Label>
                                <Input
                                    id="chat-button-text"
                                    value={chatButtonText}
                                    onChange={(e) => setChatButtonText(e.target.value)}
                                    className="mt-1"
                                    placeholder="Ej: Iniciar Chat"
                                />
                            </div>
                        </>
                    )}
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
