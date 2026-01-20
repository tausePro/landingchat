"use client"

import { useState } from "react"
import { FAQContent } from "@/types/page-content"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Trash2, Plus } from "lucide-react"

interface FAQEditorProps {
    content: FAQContent
    onChange: (content: FAQContent) => void
}

export function FAQEditor({ content, onChange }: FAQEditorProps) {
    const [localContent, setLocalContent] = useState<FAQContent>(content)

    const updateContent = (updates: Partial<FAQContent>) => {
        const newContent = { ...localContent, ...updates }
        setLocalContent(newContent)
        onChange(newContent)
    }

    // Categories management
    const addCategory = () => {
        const newCategory = {
            id: `cat-${Date.now()}`,
            name: "Nueva categoría"
        }
        updateContent({ categories: [...localContent.categories, newCategory] })
    }

    const updateCategory = (index: number, name: string) => {
        const categories = [...localContent.categories]
        categories[index] = { ...categories[index], name }
        updateContent({ categories })
    }

    const removeCategory = (index: number) => {
        const categories = localContent.categories.filter((_, i) => i !== index)
        updateContent({ categories })
    }

    // Questions management
    const addQuestion = () => {
        const newQuestion = {
            id: `q-${Date.now()}`,
            question: "",
            answer: "",
            category: localContent.categories[0]?.id
        }
        updateContent({ questions: [...localContent.questions, newQuestion] })
    }

    const updateQuestion = (index: number, updates: Partial<FAQContent['questions'][0]>) => {
        const questions = [...localContent.questions]
        questions[index] = { ...questions[index], ...updates }
        updateContent({ questions })
    }

    const removeQuestion = (index: number) => {
        const questions = localContent.questions.filter((_, i) => i !== index)
        updateContent({ questions })
    }

    // CTA management
    const toggleCTA = (enabled: boolean) => {
        if (enabled) {
            updateContent({
                cta: {
                    title: "¿Necesitas más ayuda?",
                    description: "Nuestro equipo está aquí para responder cualquier duda",
                    buttonText: "Chatear con un experto"
                }
            })
        } else {
            updateContent({ cta: undefined })
        }
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
                        <Label htmlFor="title">Título de la página</Label>
                        <Input
                            id="title"
                            value={localContent.title}
                            onChange={(e) => updateContent({ title: e.target.value })}
                            placeholder="Preguntas Frecuentes"
                        />
                    </div>
                    <div>
                        <Label htmlFor="searchPlaceholder">Placeholder de búsqueda</Label>
                        <Input
                            id="searchPlaceholder"
                            value={localContent.searchPlaceholder || ""}
                            onChange={(e) => updateContent({ searchPlaceholder: e.target.value })}
                            placeholder="¿En qué podemos ayudarte?"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Categories */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        Categorías
                        <Button onClick={addCategory} size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Agregar categoría
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {localContent.categories.map((category, index) => (
                        <div key={category.id} className="flex gap-2">
                            <Input
                                value={category.name}
                                onChange={(e) => updateCategory(index, e.target.value)}
                                placeholder="Nombre de la categoría"
                            />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => removeCategory(index)}
                                disabled={localContent.categories.length === 1}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Questions */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        Preguntas
                        <Button onClick={addQuestion} size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Agregar pregunta
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {localContent.questions.map((question, index) => (
                        <Card key={question.id} className="border-slate-200">
                            <CardContent className="pt-6 space-y-4">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <Label htmlFor={`question-${index}`}>Pregunta</Label>
                                            <Input
                                                id={`question-${index}`}
                                                value={question.question}
                                                onChange={(e) => updateQuestion(index, { question: e.target.value })}
                                                placeholder="¿Cómo puedo...?"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor={`answer-${index}`}>Respuesta</Label>
                                            <Textarea
                                                id={`answer-${index}`}
                                                value={question.answer}
                                                onChange={(e) => updateQuestion(index, { answer: e.target.value })}
                                                placeholder="La respuesta a tu pregunta..."
                                                rows={3}
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor={`category-${index}`}>Categoría</Label>
                                            <Select
                                                value={question.category}
                                                onValueChange={(value) => updateQuestion(index, { category: value })}
                                            >
                                                <SelectTrigger id={`category-${index}`}>
                                                    <SelectValue placeholder="Seleccionar categoría" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {localContent.categories.map((cat) => (
                                                        <SelectItem key={cat.id} value={cat.id}>
                                                            {cat.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeQuestion(index)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </CardContent>
            </Card>

            {/* CTA */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        Call to Action
                        <Switch
                            checked={!!localContent.cta}
                            onCheckedChange={toggleCTA}
                        />
                    </CardTitle>
                </CardHeader>
                {localContent.cta && (
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="cta-title">Título del CTA</Label>
                            <Input
                                id="cta-title"
                                value={localContent.cta.title}
                                onChange={(e) => updateContent({
                                    cta: { ...localContent.cta!, title: e.target.value }
                                })}
                                placeholder="¿Necesitas más ayuda?"
                            />
                        </div>
                        <div>
                            <Label htmlFor="cta-description">Descripción</Label>
                            <Input
                                id="cta-description"
                                value={localContent.cta.description}
                                onChange={(e) => updateContent({
                                    cta: { ...localContent.cta!, description: e.target.value }
                                })}
                                placeholder="Nuestro equipo está aquí..."
                            />
                        </div>
                        <div>
                            <Label htmlFor="cta-button">Texto del botón</Label>
                            <Input
                                id="cta-button"
                                value={localContent.cta.buttonText}
                                onChange={(e) => updateContent({
                                    cta: { ...localContent.cta!, buttonText: e.target.value }
                                })}
                                placeholder="Chatear con un experto"
                            />
                        </div>
                        <div>
                            <Label htmlFor="cta-whatsapp">Número de WhatsApp (Opcional)</Label>
                            <Input
                                id="cta-whatsapp"
                                value={localContent.cta.whatsappNumber || ""}
                                onChange={(e) => updateContent({
                                    cta: { ...localContent.cta!, whatsappNumber: e.target.value }
                                })}
                                placeholder="Ej: 573001234567 (Si se deja vacío usa el del footer)"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Si agregas un número aquí, el botón abrirá un chat directo con este número.
                            </p>
                        </div>
                    </CardContent>
                )}
            </Card>
        </div>
    )
}
