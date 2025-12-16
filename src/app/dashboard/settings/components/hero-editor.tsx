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
    const [overlayColor, setOverlayColor] = useState(heroSettings.overlayColor || "rgba(0, 0, 0, 0.4)")
    
    // Check if current color is a predefined one or custom
    const predefinedColors = ['rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0)', 'rgba(37, 99, 235, 0.5)', 'rgba(34, 197, 94, 0.5)']
    const [isCustomColor, setIsCustomColor] = useState(!predefinedColors.includes(heroSettings.overlayColor || "rgba(0, 0, 0, 0.4)"))
    const [showStats, setShowStats] = useState(heroSettings.showStats ?? true)
    const [stats, setStats] = useState(heroSettings.stats || [
        { icon: 'Truck', text: 'Envíos Nacionales' },
        { icon: 'ShieldCheck', text: 'Compra Segura' }
    ])
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
                        chatButtonText,
                        overlayColor,
                        showStats,
                        stats
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
                <div className="p-6 space-y-6">
                    <ImageUploader
                        currentImageUrl={backgroundImage}
                        onImageUploaded={setBackgroundImage}
                        folder="hero"
                        maxSizeMB={5}
                    />
                    
                    {/* Color Overlay */}
                    {backgroundImage && (
                        <div>
                            <Label htmlFor="overlay-color" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Color de Overlay
                            </Label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Oscuro', value: 'rgba(0, 0, 0, 0.4)' },
                                    { label: 'Medio', value: 'rgba(0, 0, 0, 0.6)' },
                                    { label: 'Sin Overlay', value: 'rgba(0, 0, 0, 0)' },
                                    { label: 'Azul', value: 'rgba(37, 99, 235, 0.5)' },
                                    { label: 'Verde', value: 'rgba(34, 197, 94, 0.5)' },
                                    { label: 'Personalizado', value: 'custom' }
                                ].map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => {
                                            if (option.value === 'custom') {
                                                setIsCustomColor(true)
                                                setOverlayColor("rgba(0, 0, 0, 0.5)") // Default custom color
                                            } else {
                                                setIsCustomColor(false)
                                                setOverlayColor(option.value)
                                            }
                                        }}
                                        className={`p-3 rounded-lg border-2 transition-all ${
                                            (overlayColor === option.value) || (option.value === 'custom' && isCustomColor)
                                                ? 'border-primary bg-primary/10'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                        }`}
                                    >
                                        {option.value === 'custom' ? (
                                            <div className="w-full h-8 rounded mb-2 bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500" />
                                        ) : (
                                            <div
                                                className="w-full h-8 rounded mb-2"
                                                style={{ backgroundColor: option.value }}
                                            />
                                        )}
                                        <span className="text-sm font-medium">{option.label}</span>
                                    </button>
                                ))}
                            </div>
                            
                            {/* Custom Color Input */}
                            {isCustomColor && (
                                <div className="mt-4">
                                    <Label htmlFor="custom-overlay" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Color Personalizado (formato: rgba(r, g, b, a))
                                    </Label>
                                    <Input
                                        id="custom-overlay"
                                        value={overlayColor}
                                        onChange={(e) => setOverlayColor(e.target.value)}
                                        placeholder="rgba(0, 0, 0, 0.5)"
                                        className="font-mono text-sm"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Ejemplo: rgba(255, 0, 0, 0.3) para rojo semi-transparente
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
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

            {/* Elementos Informativos */}
            <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shadow-sm">
                <div className="p-6 border-b border-border-light dark:border-border-dark">
                    <h2 className="text-lg font-semibold">Elementos Informativos</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Configura los elementos que aparecen debajo del hero
                    </p>
                </div>
                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-base font-medium text-gray-800 dark:text-gray-200">Mostrar elementos informativos</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Muestra elementos como "Envíos Nacionales", "Compra Segura", etc.
                            </p>
                        </div>
                        <Switch
                            checked={showStats}
                            onCheckedChange={setShowStats}
                        />
                    </div>

                    {showStats && (
                        <>
                            <div className="border-t border-gray-200 dark:border-gray-700 -mx-6"></div>
                            <div className="space-y-4">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Elementos configurados:</p>
                                {stats.map((stat: any, index: number) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-full bg-primary/10">
                                                {stat.icon === 'Truck' && '🚚'}
                                                {stat.icon === 'ShieldCheck' && '🛡️'}
                                                {stat.icon === 'MessageCircle' && '💬'}
                                            </div>
                                            <span className="text-sm font-medium">{stat.text}</span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const newStats = stats.filter((_: any, i: number) => i !== index)
                                                setStats(newStats)
                                            }}
                                            className="text-red-500 hover:text-red-700 text-sm"
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                ))}
                                
                                {stats.length < 3 && (
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { icon: 'Truck', text: 'Envíos Nacionales' },
                                            { icon: 'ShieldCheck', text: 'Compra Segura' },
                                            { icon: 'MessageCircle', text: 'Soporte 24/7' }
                                        ].filter(option => !stats.some((s: any) => s.icon === option.icon)).map((option) => (
                                            <button
                                                key={option.icon}
                                                onClick={() => setStats([...stats, option])}
                                                className="p-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                                            >
                                                + {option.text}
                                            </button>
                                        ))}
                                    </div>
                                )}
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
