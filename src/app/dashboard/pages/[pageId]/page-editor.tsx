"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { StorePage, updateStorePage, deleteStorePage } from "../actions"
import Link from "next/link"
import { FAQEditor } from "@/components/dashboard/editors/faq-editor"
import { LegalEditor } from "@/components/dashboard/editors/legal-editor"
import { AboutEditor } from "@/components/dashboard/editors/about-editor"
import { PageContent, isFAQContent, isLegalContent, isAboutContent } from "@/types/page-content"

interface PageEditorProps {
    page: StorePage & { organization_slug?: string }
}

export function PageEditor({ page }: PageEditorProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const [title, setTitle] = useState(page.title)
    const [content, setContent] = useState(page.content || "")
    const [contentJsonb, setContentJsonb] = useState<PageContent | null>(page.content_jsonb || null)
    const [seoTitle, setSeoTitle] = useState(page.seo_title || "")
    const [seoDescription, setSeoDescription] = useState(page.seo_description || "")
    const [isPublished, setIsPublished] = useState(page.is_published)

    // Detect content type
    const contentType = contentJsonb?.type || 'html'

    const handleSave = async () => {
        setIsLoading(true)
        try {
            const result = await updateStorePage(page.id, {
                title,
                content,
                content_jsonb: contentJsonb,
                seo_title: seoTitle,
                seo_description: seoDescription,
                is_published: isPublished
            })

            if (result.success) {
                toast.success("Página guardada")
            } else {
                toast.error(result.error || "Error al guardar")
            }
        } catch (error) {
            toast.error("Error inesperado")
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm("¿Estás seguro de eliminar esta página?")) return

        setIsDeleting(true)
        try {
            const result = await deleteStorePage(page.id)
            if (result.success) {
                toast.success("Página eliminada")
                router.push("/dashboard/pages")
            } else {
                toast.error(result.error || "Error al eliminar")
            }
        } catch (error) {
            toast.error("Error inesperado")
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/pages">
                        <Button variant="ghost" size="sm">
                            <span className="material-symbols-outlined text-lg mr-1">arrow_back</span>
                            Volver
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Editar Página
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            /{page.slug}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isPublished && page.organization_slug && (
                        <a
                            href={`/store/${page.organization_slug}/${page.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Button variant="outline" size="sm">
                                <span className="material-symbols-outlined text-lg mr-2">visibility</span>
                                Ver página
                            </Button>
                        </a>
                    )}
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={isPublished}
                            onCheckedChange={setIsPublished}
                            id="publish-switch"
                        />
                        <Label htmlFor="publish-switch" className="text-sm">
                            {isPublished ? "Publicada" : "Borrador"}
                        </Label>
                    </div>
                    <Button onClick={handleSave} disabled={isLoading}>
                        {isLoading ? (
                            <span className="material-symbols-outlined text-lg mr-2 animate-spin">progress_activity</span>
                        ) : (
                            <span className="material-symbols-outlined text-lg mr-2">save</span>
                        )}
                        Guardar
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Editor principal */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Contenido</CardTitle>
                            <CardDescription>
                                {contentType === 'faq' && 'Editor estructurado para Preguntas Frecuentes'}
                                {contentType === 'legal' && 'Editor estructurado para documentos legales'}
                                {contentType === 'html' && 'Editor HTML básico'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {contentType === 'faq' && isFAQContent(contentJsonb) && (
                                <FAQEditor
                                    content={contentJsonb}
                                    onChange={(newContent) => {
                                        setContentJsonb(newContent)
                                        setTitle(newContent.title)
                                    }}
                                />
                            )}

                            {contentType === 'legal' && isLegalContent(contentJsonb) && (
                                <LegalEditor
                                    content={contentJsonb}
                                    onChange={(newContent) => {
                                        setContentJsonb(newContent)
                                        setTitle(newContent.title)
                                    }}
                                />
                            )}

                            {contentType === 'about' && isAboutContent(contentJsonb) && (
                                <AboutEditor
                                    content={contentJsonb}
                                    onChange={(newContent) => {
                                        setContentJsonb(newContent)
                                        setTitle(newContent.hero?.title || newContent.story?.title || '')
                                    }}
                                />
                            )}

                            {contentType === 'html' && (
                                <>
                                    <div>
                                        <Label htmlFor="title">Título de la página</Label>
                                        <Input
                                            id="title"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="Ej: Preguntas Frecuentes"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="content">Contenido (HTML)</Label>
                                        <textarea
                                            id="content"
                                            value={content}
                                            onChange={(e) => setContent(e.target.value)}
                                            placeholder="<h2>Tu contenido aquí...</h2>"
                                            className="mt-1 w-full min-h-[400px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300 font-mono"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">
                                            Puedes usar HTML para formatear el contenido
                                        </p>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Preview - only for HTML type */}
                    {contentType === 'html' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Vista previa</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className="prose prose-slate dark:prose-invert max-w-none"
                                    dangerouslySetInnerHTML={{ __html: content }}
                                />
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* SEO */}
                    <Card>
                        <CardHeader>
                            <CardTitle>SEO</CardTitle>
                            <CardDescription>
                                Optimiza para buscadores
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="seo-title">Título SEO</Label>
                                <Input
                                    id="seo-title"
                                    value={seoTitle}
                                    onChange={(e) => setSeoTitle(e.target.value)}
                                    placeholder={title}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label htmlFor="seo-description">Meta descripción</Label>
                                <textarea
                                    id="seo-description"
                                    value={seoDescription}
                                    onChange={(e) => setSeoDescription(e.target.value)}
                                    placeholder="Descripción para buscadores..."
                                    rows={3}
                                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Danger zone */}
                    <Card className="border-red-200 dark:border-red-900">
                        <CardHeader>
                            <CardTitle className="text-red-600">Zona de peligro</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Button
                                variant="secondary"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="w-full bg-red-600 hover:bg-red-700 text-white"
                            >
                                {isDeleting ? (
                                    <span className="material-symbols-outlined text-lg mr-2 animate-spin">progress_activity</span>
                                ) : (
                                    <span className="material-symbols-outlined text-lg mr-2">delete</span>
                                )}
                                Eliminar página
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
