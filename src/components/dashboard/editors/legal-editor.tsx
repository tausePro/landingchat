"use client"

import { useState } from "react"
import { LegalContent } from "@/types/page-content"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Trash2, Plus } from "lucide-react"

interface LegalEditorProps {
    content: LegalContent
    onChange: (content: LegalContent) => void
}

export function LegalEditor({ content, onChange }: LegalEditorProps) {
    const [localContent, setLocalContent] = useState<LegalContent>(content)

    const updateContent = (updates: Partial<LegalContent>) => {
        const newContent = { ...localContent, ...updates }
        setLocalContent(newContent)
        onChange(newContent)
    }

    // Sections management
    const addSection = () => {
        const newSection = {
            id: `section-${Date.now()}`,
            title: "Nueva sección",
            content: "",
            subsections: []
        }
        updateContent({ sections: [...localContent.sections, newSection] })
    }

    const updateSection = (index: number, updates: Partial<LegalContent['sections'][0]>) => {
        const sections = [...localContent.sections]
        sections[index] = { ...sections[index], ...updates }
        updateContent({ sections })
    }

    const removeSection = (index: number) => {
        const sections = localContent.sections.filter((_, i) => i !== index)
        updateContent({ sections })
    }

    // Subsections management
    const addSubsection = (sectionIndex: number) => {
        const newSubsection = {
            id: `subsection-${Date.now()}`,
            title: "Nueva subsección",
            content: ""
        }
        const sections = [...localContent.sections]
        sections[sectionIndex].subsections = [
            ...(sections[sectionIndex].subsections || []),
            newSubsection
        ]
        updateContent({ sections })
    }

    const updateSubsection = (
        sectionIndex: number,
        subsectionIndex: number,
        updates: Partial<NonNullable<LegalContent['sections'][0]['subsections']>[0]>
    ) => {
        const sections = [...localContent.sections]
        const subsections = [...(sections[sectionIndex].subsections || [])]
        subsections[subsectionIndex] = { ...subsections[subsectionIndex], ...updates }
        sections[sectionIndex].subsections = subsections
        updateContent({ sections })
    }

    const removeSubsection = (sectionIndex: number, subsectionIndex: number) => {
        const sections = [...localContent.sections]
        sections[sectionIndex].subsections = sections[sectionIndex].subsections?.filter((_, i) => i !== subsectionIndex)
        updateContent({ sections })
    }

    return (
        <div className="space-y-6">
            {/* Basic Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Información básica</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="title">Título del documento</Label>
                        <Input
                            id="title"
                            value={localContent.title}
                            onChange={(e) => updateContent({ title: e.target.value })}
                            placeholder="Términos y Condiciones"
                        />
                    </div>
                    <div>
                        <Label htmlFor="lastUpdated">Última actualización (opcional)</Label>
                        <Input
                            id="lastUpdated"
                            type="date"
                            value={localContent.lastUpdated || ""}
                            onChange={(e) => updateContent({ lastUpdated: e.target.value })}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Sections */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        Secciones
                        <Button onClick={addSection} size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Agregar sección
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {localContent.sections.map((section, sectionIndex) => (
                        <Card key={section.id} className="border-slate-200">
                            <CardContent className="pt-6 space-y-4">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <Label htmlFor={`section-title-${sectionIndex}`}>
                                                Título de la sección
                                            </Label>
                                            <Input
                                                id={`section-title-${sectionIndex}`}
                                                value={section.title}
                                                onChange={(e) => updateSection(sectionIndex, { title: e.target.value })}
                                                placeholder="1. Introducción"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor={`section-content-${sectionIndex}`}>Contenido</Label>
                                            <Textarea
                                                id={`section-content-${sectionIndex}`}
                                                value={section.content}
                                                onChange={(e) => updateSection(sectionIndex, { content: e.target.value })}
                                                placeholder="El contenido de esta sección..."
                                                rows={4}
                                            />
                                        </div>

                                        {/* Subsections */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-sm text-slate-600">Subsecciones</Label>
                                                <Button
                                                    onClick={() => addSubsection(sectionIndex)}
                                                    size="sm"
                                                    variant="outline"
                                                >
                                                    <Plus className="mr-2 h-3 w-3" />
                                                    Agregar subsección
                                                </Button>
                                            </div>
                                            {section.subsections?.map((subsection, subsectionIndex) => (
                                                <Card key={subsection.id} className="border-slate-100 bg-slate-50">
                                                    <CardContent className="pt-4 space-y-3">
                                                        <div className="flex justify-between items-start gap-4">
                                                            <div className="flex-1 space-y-3">
                                                                <div>
                                                                    <Label htmlFor={`subsection-title-${sectionIndex}-${subsectionIndex}`}>
                                                                        Título de la subsección
                                                                    </Label>
                                                                    <Input
                                                                        id={`subsection-title-${sectionIndex}-${subsectionIndex}`}
                                                                        value={subsection.title}
                                                                        onChange={(e) => updateSubsection(
                                                                            sectionIndex,
                                                                            subsectionIndex,
                                                                            { title: e.target.value }
                                                                        )}
                                                                        placeholder="1.1 Definiciones"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <Label htmlFor={`subsection-content-${sectionIndex}-${subsectionIndex}`}>
                                                                        Contenido
                                                                    </Label>
                                                                    <Textarea
                                                                        id={`subsection-content-${sectionIndex}-${subsectionIndex}`}
                                                                        value={subsection.content}
                                                                        onChange={(e) => updateSubsection(
                                                                            sectionIndex,
                                                                            subsectionIndex,
                                                                            { content: e.target.value }
                                                                        )}
                                                                        placeholder="El contenido de esta subsección..."
                                                                        rows={3}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => removeSubsection(sectionIndex, subsectionIndex)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeSection(sectionIndex)}
                                        disabled={localContent.sections.length === 1}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}
