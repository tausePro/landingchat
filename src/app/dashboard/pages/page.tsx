import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { getStorePages } from "./actions"
import { PAGE_TEMPLATES } from "./templates"
import { CreateFromTemplateButton } from "./components/create-from-template-button"

export const dynamic = 'force-dynamic'

export default async function PagesPage() {
    const pages = await getStorePages()

    // Templates que aún no se han creado
    const existingSlugs = pages.map(p => p.slug)
    const availableTemplates = PAGE_TEMPLATES.filter(t => !existingSlugs.includes(t.slug))

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Páginas Informativas
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                            Crea y edita páginas como FAQ, Términos y Condiciones, Políticas, etc.
                        </p>
                    </div>
                    <Link href="/dashboard/pages/new">
                        <Button>
                            <span className="material-symbols-outlined text-lg mr-2">add</span>
                            Nueva Página
                        </Button>
                    </Link>
                </div>

                {/* Templates disponibles */}
                {availableTemplates.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Páginas Sugeridas</CardTitle>
                            <CardDescription>
                                Crea páginas comunes con un clic usando nuestros templates
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {availableTemplates.map((template) => (
                                    <CreateFromTemplateButton
                                        key={template.slug}
                                        template={template}
                                    />
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Lista de páginas */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Mis Páginas</CardTitle>
                        <CardDescription>
                            {pages.length} página{pages.length !== 1 ? 's' : ''} creada{pages.length !== 1 ? 's' : ''}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {pages.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="flex size-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mx-auto mb-4">
                                    <span className="material-symbols-outlined text-2xl text-slate-400">article</span>
                                </div>
                                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                                    No hay páginas creadas
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 mb-4">
                                    Crea tu primera página informativa
                                </p>
                                <Link href="/dashboard/pages/new">
                                    <Button>Crear Página</Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {pages.map((page) => (
                                    <div
                                        key={page.id}
                                        className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                                                <span className="material-symbols-outlined text-lg text-slate-600 dark:text-slate-400">
                                                    description
                                                </span>
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-slate-900 dark:text-white">
                                                    {page.title}
                                                </h4>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    /{page.slug}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge variant={page.is_published ? "default" : "secondary"}>
                                                {page.is_published ? "Publicada" : "Borrador"}
                                            </Badge>
                                            <Link href={`/dashboard/pages/${page.id}`}>
                                                <Button variant="ghost" size="sm">
                                                    <span className="material-symbols-outlined text-lg">edit</span>
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
