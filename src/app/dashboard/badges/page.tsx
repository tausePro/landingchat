"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getBadges, createBadge, deleteBadge, BadgeData } from "./actions"

export default function BadgesPage() {
    const [badges, setBadges] = useState<BadgeData[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)

    // Form State
    const [name, setName] = useState("")
    const [displayText, setDisplayText] = useState("")
    const [backgroundColor, setBackgroundColor] = useState("#000000")
    const [textColor, setTextColor] = useState("#FFFFFF")
    const [type, setType] = useState<'manual' | 'automatic'>('manual')

    useEffect(() => {
        loadBadges()
    }, [])

    const loadBadges = async () => {
        try {
            const data = await getBadges()
            setBadges(data)
        } catch (error) {
            console.error("Error loading badges:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await createBadge({
                name,
                display_text: displayText,
                background_color: backgroundColor,
                text_color: textColor,
                type
            })
            setIsCreating(false)
            resetForm()
            loadBadges()
        } catch (error) {
            alert("Error creating badge")
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este badge?")) return
        try {
            await deleteBadge(id)
            loadBadges()
        } catch (error) {
            alert("Error deleting badge")
        }
    }

    const resetForm = () => {
        setName("")
        setDisplayText("")
        setBackgroundColor("#000000")
        setTextColor("#FFFFFF")
        setType("manual")
    }

    return (
        <DashboardLayout>
            <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-text-light-primary dark:text-text-dark-primary">Badges</h1>
                        <p className="text-text-light-secondary dark:text-text-dark-secondary mt-1">Gestiona las etiquetas de tus productos</p>
                    </div>
                    <Button onClick={() => setIsCreating(true)}>
                        <span className="material-symbols-outlined mr-2">add</span>
                        Nuevo Badge
                    </Button>
                </div>

                {isCreating && (
                    <div className="mb-8 p-6 bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark">
                        <h2 className="text-xl font-semibold mb-4">Crear Nuevo Badge</h2>
                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <Label>Nombre Interno</Label>
                                <Input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Ej: Nuevo Lanzamiento"
                                    required
                                    className="mt-2"
                                />
                            </div>
                            <div>
                                <Label>Texto a Mostrar</Label>
                                <Input
                                    value={displayText}
                                    onChange={e => setDisplayText(e.target.value)}
                                    placeholder="Ej: NUEVO"
                                    required
                                    className="mt-2"
                                />
                            </div>
                            <div>
                                <Label>Color de Fondo</Label>
                                <div className="flex gap-2 mt-2">
                                    <Input
                                        type="color"
                                        value={backgroundColor}
                                        onChange={e => setBackgroundColor(e.target.value)}
                                        className="w-12 h-10 p-1"
                                    />
                                    <Input
                                        value={backgroundColor}
                                        onChange={e => setBackgroundColor(e.target.value)}
                                        placeholder="#000000"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Color de Texto</Label>
                                <div className="flex gap-2 mt-2">
                                    <Input
                                        type="color"
                                        value={textColor}
                                        onChange={e => setTextColor(e.target.value)}
                                        className="w-12 h-10 p-1"
                                    />
                                    <Input
                                        value={textColor}
                                        onChange={e => setTextColor(e.target.value)}
                                        placeholder="#FFFFFF"
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-2 flex justify-end gap-4 mt-4">
                                <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                                    Cancelar
                                </Button>
                                <Button type="submit">
                                    Guardar Badge
                                </Button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {badges.map(badge => (
                        <div key={badge.id} className="p-6 bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark flex items-center justify-between">
                            <div>
                                <div
                                    className="px-3 py-1 rounded-full text-xs font-bold inline-block mb-2"
                                    style={{ backgroundColor: badge.background_color, color: badge.text_color }}
                                >
                                    {badge.display_text}
                                </div>
                                <h3 className="font-medium">{badge.name}</h3>
                                <p className="text-sm text-muted-foreground capitalize">{badge.type}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(badge.id)}>
                                <span className="material-symbols-outlined text-red-500">delete</span>
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    )
}
