"use client"

import { AboutContent } from "@/types/page-content"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { ImageUploader } from "@/components/ui/image-uploader"
import { useState } from "react"

interface AboutEditorProps {
    content: AboutContent
    onChange: (content: AboutContent) => void
}

export function AboutEditor({ content, onChange }: AboutEditorProps) {
    const [localContent, setLocalContent] = useState<AboutContent>(content)

    const updateContent = (updates: Partial<AboutContent>) => {
        const newContent = { ...localContent, ...updates }
        setLocalContent(newContent)
        onChange(newContent)
    }

    // Hero handlers
    const updateHero = (updates: Partial<AboutContent['hero']>) => {
        updateContent({
            hero: { ...localContent.hero, ...updates } as AboutContent['hero']
        })
    }

    // Story handlers
    const updateStory = (updates: Partial<AboutContent['story']>) => {
        updateContent({
            story: { ...localContent.story, ...updates } as AboutContent['story']
        })
    }

    const addParagraph = () => {
        if (localContent.story) {
            updateStory({
                paragraphs: [...localContent.story.paragraphs, ""]
            })
        }
    }

    const updateParagraph = (index: number, value: string) => {
        if (localContent.story) {
            const newParagraphs = [...localContent.story.paragraphs]
            newParagraphs[index] = value
            updateStory({ paragraphs: newParagraphs })
        }
    }

    const removeParagraph = (index: number) => {
        if (localContent.story) {
            updateStory({
                paragraphs: localContent.story.paragraphs.filter((_, i) => i !== index)
            })
        }
    }

    // Values handlers
    const addValue = () => {
        updateContent({
            values: [
                ...(localContent.values || []),
                { icon: "check_circle", title: "", description: "" }
            ]
        })
    }


    const updateValue = (index: number, updates: Partial<{ icon: string; title: string; description: string }>) => {
        const newValues = [...(localContent.values || [])]
        newValues[index] = { ...newValues[index], ...updates }
        updateContent({ values: newValues })
    }


    const removeValue = (index: number) => {
        updateContent({
            values: localContent.values?.filter((_, i) => i !== index)
        })
    }

    // Stats handlers
    const addStat = () => {
        updateContent({
            stats: [
                ...(localContent.stats || []),
                { value: "", label: "" }
            ]
        })
    }

    const updateStat = (index: number, updates: Partial<{ value: string; label: string }>) => {
        const newStats = [...(localContent.stats || [])]
        newStats[index] = { ...newStats[index], ...updates }
        updateContent({ stats: newStats })
    }

    const removeStat = (index: number) => {
        updateContent({
            stats: localContent.stats?.filter((_, i) => i !== index)
        })
    }

    // Team handlers
    const addTeamMember = () => {
        updateContent({
            team: [
                ...(localContent.team || []),
                { name: "", role: "", image: "", email: "" }
            ]
        })
    }

    const updateTeamMember = (index: number, updates: Partial<{ name: string; role: string; image?: string; email?: string }>) => {
        const newTeam = [...(localContent.team || [])]
        newTeam[index] = { ...newTeam[index], ...updates }
        updateContent({ team: newTeam })
    }

    const removeTeamMember = (index: number) => {
        updateContent({
            team: localContent.team?.filter((_, i) => i !== index)
        })
    }

    // CTA handlers
    const [showCTA, setShowCTA] = useState(!!localContent.cta)

    const toggleCTA = (enabled: boolean) => {
        setShowCTA(enabled)
        if (enabled && !localContent.cta) {
            updateContent({
                cta: { title: "", description: "", buttonText: "" }
            })
        } else if (!enabled) {
            updateContent({ cta: undefined })
        }
    }

    const updateCTA = (updates: Partial<AboutContent['cta']>) => {
        if (localContent.cta) {
            updateContent({
                cta: { ...localContent.cta, ...updates }
            })
        }
    }

    return (
        <div className="space-y-6">
            {/* Hero Section */}
            <Card className="p-6">
                <h3 className="text-lg font-bold mb-4">Hero Section</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium mb-2 block">Título</label>
                        <Input
                            value={localContent.hero?.title || ""}
                            onChange={(e) => updateHero({ title: e.target.value })}
                            placeholder="Nuestra Esencia"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-2 block">Subtítulo</label>
                        <Textarea
                            value={localContent.hero?.subtitle || ""}
                            onChange={(e) => updateHero({ subtitle: e.target.value })}
                            placeholder="Creando conexiones que trascienden..."
                            rows={3}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-2 block">Imagen de fondo del Hero</label>
                        <ImageUploader
                            currentImageUrl={localContent.hero?.image}
                            onImageUploaded={(url) => updateHero({ image: url })}
                            folder="about/hero"
                            maxSizeMB={10}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-2 block">Texto CTA (opcional)</label>
                        <Input
                            value={localContent.hero?.ctaText || ""}
                            onChange={(e) => updateHero({ ctaText: e.target.value })}
                            placeholder="Conoce nuestra historia"
                        />
                    </div>
                </div>
            </Card>

            {/* Story Section */}
            <Card className="p-6">
                <h3 className="text-lg font-bold mb-4">Nuestra Historia</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium mb-2 block">Tagline</label>
                        <Input
                            value={localContent.story?.tagline || ""}
                            onChange={(e) => updateStory({ tagline: e.target.value })}
                            placeholder="Donde Todo Comenzó"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-2 block">Título</label>
                        <Input
                            value={localContent.story?.title || ""}
                            onChange={(e) => updateStory({ title: e.target.value })}
                            placeholder="Una visión compartida por la excelencia"
                        />
                    </div>

                    {/* Paragraphs */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-medium">Párrafos</label>
                            <Button
                                type="button"
                                size="sm"
                                onClick={addParagraph}
                                variant="outline"
                            >
                                + Agregar párrafo
                            </Button>
                        </div>
                        <div className="space-y-3">
                            {localContent.story?.paragraphs.map((paragraph, index) => (
                                <div key={index} className="flex gap-2">
                                    <Textarea
                                        value={paragraph}
                                        onChange={(e) => updateParagraph(index, e.target.value)}
                                        placeholder={`Párrafo ${index + 1}`}
                                        rows={3}
                                        className="flex-1"
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => removeParagraph(index)}
                                    >
                                        ✕
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>


                    <div>
                        <label className="text-sm font-medium mb-2 block">Imagen de Historia</label>
                        <ImageUploader
                            currentImageUrl={localContent.story?.image}
                            onImageUploaded={(url) => updateStory({ image: url })}
                            folder="about/story"
                            maxSizeMB={5}
                        />
                    </div>
                </div>
            </Card>

            {/* Values Section */}
            <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Valores</h3>
                    <Button
                        type="button"
                        size="sm"
                        onClick={addValue}
                        variant="outline"
                    >
                        + Agregar valor
                    </Button>
                </div>
                <div className="space-y-4">
                    {localContent.values?.map((value, index) => (
                        <Card key={index} className="p-4 bg-gray-50 dark:bg-gray-900">
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-sm font-medium">Valor {index + 1}</span>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => removeValue(index)}
                                >
                                    Eliminar
                                </Button>
                            </div>
                            <div className="space-y-3">
                                <Input
                                    value={value.icon}
                                    onChange={(e) => updateValue(index, { icon: e.target.value })}
                                    placeholder="Icono (Material Symbol, ej: energy_savings_leaf)"
                                />
                                <Input
                                    value={value.title}
                                    onChange={(e) => updateValue(index, { title: e.target.value })}
                                    placeholder="Título del valor"
                                />
                                <Textarea
                                    value={value.description}
                                    onChange={(e) => updateValue(index, { description: e.target.value })}
                                    placeholder="Descripción"
                                    rows={3}
                                />
                            </div>
                        </Card>
                    ))}
                </div>
            </Card>

            {/* Stats Section */}
            <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Estadísticas de Impacto</h3>
                    <Button
                        type="button"
                        size="sm"
                        onClick={addStat}
                        variant="outline"
                    >
                        + Agregar estadística
                    </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {localContent.stats?.map((stat, index) => (
                        <Card key={index} className="p-4 bg-gray-50 dark:bg-gray-900">
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-sm font-medium">Stat {index + 1}</span>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => removeStat(index)}
                                >
                                    ✕
                                </Button>
                            </div>
                            <div className="space-y-2">
                                <Input
                                    value={stat.value}
                                    onChange={(e) => updateStat(index, { value: e.target.value })}
                                    placeholder="20+,  +100k, 100%"
                                />
                                <Input
                                    value={stat.label}
                                    onChange={(e) => updateStat(index, { label: e.target.value })}
                                    placeholder="Años de Experiencia"
                                />
                            </div>
                        </Card>
                    ))}
                </div>
            </Card>

            {/* Team Section */}
            <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Equipo</h3>
                    <Button
                        type="button"
                        size="sm"
                        onClick={addTeamMember}
                        variant="outline"
                    >
                        + Agregar miembro
                    </Button>
                </div>
                <div className="space-y-4">
                    {localContent.team?.map((member, index) => (
                        <Card key={index} className="p-4 bg-gray-50 dark:bg-gray-900">
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-sm font-medium">Miembro {index + 1}</span>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => removeTeamMember(index)}
                                >
                                    Eliminar
                                </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <Input
                                    value={member.name}
                                    onChange={(e) => updateTeamMember(index, { name: e.target.value })}
                                    placeholder="Nombre"
                                />
                                <Input
                                    value={member.role}
                                    onChange={(e) => updateTeamMember(index, { role: e.target.value })}
                                    placeholder="Cargo"
                                />
                                <Input
                                    value={member.image || ""}
                                    onChange={(e) => updateTeamMember(index, { image: e.target.value })}
                                    placeholder="URL imagen (opcional)"
                                    className="md:col-span-2"
                                />
                                <Input
                                    value={member.email || ""}
                                    onChange={(e) => updateTeamMember(index, { email: e.target.value })}
                                    placeholder="Email (opcional)"
                                    className="md:col-span-2"
                                />
                            </div>
                        </Card>
                    ))}
                </div>
            </Card>

            {/* CTA Section */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Call to Action Final</h3>
                    <Switch
                        checked={showCTA}
                        onCheckedChange={toggleCTA}
                    />
                </div>
                {showCTA && localContent.cta && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">Título</label>
                            <Input
                                value={localContent.cta.title}
                                onChange={(e) => updateCTA({ title: e.target.value })}
                                placeholder="¿Quieres saber más?"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Descripción</label>
                            <Textarea
                                value={localContent.cta.description}
                                onChange={(e) => updateCTA({ description: e.target.value })}
                                placeholder="Estamos a un clic de distancia..."
                                rows={3}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Texto del botón</label>
                            <Input
                                value={localContent.cta.buttonText}
                                onChange={(e) => updateCTA({ buttonText: e.target.value })}
                                placeholder="Chatear con nosotros ahora"
                            />
                        </div>
                    </div>
                )}
            </Card>
        </div>
    )
}
