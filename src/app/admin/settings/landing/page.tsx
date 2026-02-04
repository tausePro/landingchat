"use client"

import { useState, useEffect, useCallback } from "react"
import { type LandingMainConfig, defaultLandingConfig, type LandingFeature, type LandingMarketplaceAgent, type LandingComparisonRow, type LandingFooterColumn, type LandingNavLink, type LandingMetric, type LandingTrustBadge } from "@/types/landing"
import { getLandingMainConfig, saveLandingMainConfig } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Save, RotateCcw, Plus, Trash2, Eye, Loader2, GripVertical, Layers, Type, ImageIcon, Upload } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function LandingSettingsPage() {
    const [config, setConfig] = useState<LandingMainConfig>(defaultLandingConfig)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)
    const [uploadingLogo, setUploadingLogo] = useState(false)

    useEffect(() => {
        loadConfig()
    }, [])

    const loadConfig = async () => {
        setLoading(true)
        const result = await getLandingMainConfig()
        setLoading(false)
        if (result.success) {
            setConfig(result.data)
        } else {
            toast.error("Error al cargar configuración")
        }
    }

    const update = useCallback(<K extends keyof LandingMainConfig>(field: K, value: LandingMainConfig[K]) => {
        setConfig((prev) => ({ ...prev, [field]: value }))
        setHasChanges(true)
    }, [])

    const handleSave = async () => {
        setSaving(true)
        const result = await saveLandingMainConfig(config)
        setSaving(false)

        if (result.success) {
            toast.success("Configuración de landing guardada")
            setHasChanges(false)
        } else {
            toast.error(result.error ?? "Error al guardar")
        }
    }

    const handleLogoUpload = async (file: File) => {
        const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"]
        if (!validTypes.includes(file.type)) {
            toast.error("Formato no válido. Usa PNG, JPG, SVG o WEBP.")
            return
        }
        if (file.size > 2 * 1024 * 1024) {
            toast.error("El archivo es muy grande. Máximo 2MB.")
            return
        }

        setUploadingLogo(true)
        try {
            const supabase = createClient()
            const fileExt = file.name.split(".").pop()
            const fileName = `landing-logo-${Date.now()}.${fileExt}`
            const fullPath = `landing/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from("organization-logos")
                .upload(fullPath, file, { cacheControl: "3600", upsert: false })

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from("organization-logos")
                .getPublicUrl(fullPath)

            update("logo_image_url", publicUrl)
            update("logo_type", "image")
            toast.success("Logo subido correctamente")
        } catch (err) {
            console.error("Error uploading logo:", err)
            toast.error("Error al subir el logo. Intenta de nuevo.")
        } finally {
            setUploadingLogo(false)
        }
    }

    const handleReset = () => {
        setConfig(defaultLandingConfig)
        setHasChanges(true)
        toast.info("Restaurado a valores por defecto (guardar para aplicar)")
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="size-8 animate-spin text-indigo-500" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Landing Page Principal</h2>
                    <p className="text-sm text-slate-500 mt-1">Edita todo el contenido de la landing en landingchat.co</p>
                </div>
                <div className="flex items-center gap-3">
                    <a href="/" target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                            <Eye className="size-4 mr-2" />
                            Ver Landing
                        </Button>
                    </a>
                    <Button variant="outline" size="sm" onClick={handleReset}>
                        <RotateCcw className="size-4 mr-2" />
                        Restaurar Defaults
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
                        {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
                        Guardar
                    </Button>
                </div>
            </div>

            {hasChanges && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400">
                    Tienes cambios sin guardar
                </div>
            )}

            <Tabs defaultValue="hero" className="space-y-6">
                <TabsList className="flex flex-wrap gap-1">
                    <TabsTrigger value="hero">Hero & Header</TabsTrigger>
                    <TabsTrigger value="metrics">Métricas</TabsTrigger>
                    <TabsTrigger value="features">Features</TabsTrigger>
                    <TabsTrigger value="testimonial">Testimonial</TabsTrigger>
                    <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
                    <TabsTrigger value="comparison">Comparación</TabsTrigger>
                    <TabsTrigger value="pricing">Pricing</TabsTrigger>
                    <TabsTrigger value="cta">CTA & Footer</TabsTrigger>
                    <TabsTrigger value="seo">SEO</TabsTrigger>
                </TabsList>

                {/* ====== HERO & HEADER TAB ====== */}
                <TabsContent value="hero" className="space-y-6">
                    {/* Logo / Branding */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Logo / Branding</CardTitle>
                            <CardDescription>Elige cómo se muestra el logo en el header y footer</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Logo type selector */}
                            <div className="grid grid-cols-3 gap-4">
                                <div
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors text-center ${config.logo_type === "icon" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-slate-200 dark:border-slate-700"}`}
                                    onClick={() => update("logo_type", "icon")}
                                >
                                    <Layers className="size-8 mx-auto mb-2 text-slate-600 dark:text-slate-400" />
                                    <p className="text-sm font-medium">Icono + Texto</p>
                                    <p className="text-xs text-slate-500 mt-1">Logo por defecto</p>
                                </div>
                                <div
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors text-center ${config.logo_type === "image" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-slate-200 dark:border-slate-700"}`}
                                    onClick={() => update("logo_type", "image")}
                                >
                                    <ImageIcon className="size-8 mx-auto mb-2 text-slate-600 dark:text-slate-400" />
                                    <p className="text-sm font-medium">Imagen</p>
                                    <p className="text-xs text-slate-500 mt-1">Sube tu logo</p>
                                </div>
                                <div
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors text-center ${config.logo_type === "text" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-slate-200 dark:border-slate-700"}`}
                                    onClick={() => update("logo_type", "text")}
                                >
                                    <Type className="size-8 mx-auto mb-2 text-slate-600 dark:text-slate-400" />
                                    <p className="text-sm font-medium">Solo Texto</p>
                                    <p className="text-xs text-slate-500 mt-1">Nombre de la marca</p>
                                </div>
                            </div>

                            {/* Logo text (applies to icon and text types) */}
                            {(config.logo_type === "icon" || config.logo_type === "text") && (
                                <div>
                                    <Label>Texto del Logo</Label>
                                    <Input value={config.logo_text} onChange={(e) => update("logo_text", e.target.value)} placeholder="LandingChat" />
                                </div>
                            )}

                            {/* Image uploader (only for image type) */}
                            {config.logo_type === "image" && (
                                <div className="space-y-3">
                                    {config.logo_image_url ? (
                                        <div className="flex items-center gap-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
                                            <img
                                                src={config.logo_image_url}
                                                alt="Logo preview"
                                                className="h-16 w-auto max-w-[200px] object-contain rounded-lg border"
                                            />
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Logo actual</p>
                                                <p className="text-xs text-slate-500 truncate max-w-xs">{config.logo_image_url}</p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    update("logo_image_url", null)
                                                }}
                                            >
                                                Cambiar
                                            </Button>
                                        </div>
                                    ) : (
                                        <div
                                            onDrop={(e) => {
                                                e.preventDefault()
                                                const file = e.dataTransfer.files[0]
                                                if (file) handleLogoUpload(file)
                                            }}
                                            onDragOver={(e) => e.preventDefault()}
                                            className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-8 transition-colors hover:border-indigo-400"
                                        >
                                            {uploadingLogo ? (
                                                <Loader2 className="size-8 animate-spin text-indigo-500" />
                                            ) : (
                                                <Upload className="size-8 text-slate-400" />
                                            )}
                                            <div className="text-center">
                                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                                    {uploadingLogo ? "Subiendo..." : "Arrastra y suelta tu logo aquí"}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">PNG, JPG, SVG o WEBP (máx. 2MB)</p>
                                            </div>
                                            <label className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 cursor-pointer">
                                                Seleccionar archivo
                                                <input
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0]
                                                        if (file) handleLogoUpload(file)
                                                    }}
                                                    className="hidden"
                                                    disabled={uploadingLogo}
                                                />
                                            </label>
                                        </div>
                                    )}
                                    <div>
                                        <Label>O pega la URL directamente</Label>
                                        <Input
                                            value={config.logo_image_url ?? ""}
                                            onChange={(e) => update("logo_image_url", e.target.value || null)}
                                            placeholder="https://..."
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Preview */}
                            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-4 border">
                                <p className="text-xs text-slate-500 mb-3">Vista previa del logo:</p>
                                <div className="flex items-center gap-3">
                                    {config.logo_type === "image" && config.logo_image_url ? (
                                        <img src={config.logo_image_url} alt="Logo" className="h-10 w-auto object-contain" />
                                    ) : config.logo_type === "text" ? (
                                        <span className="text-xl font-bold text-slate-900 dark:text-white">{config.logo_text || "LandingChat"}</span>
                                    ) : (
                                        <>
                                            <div className="size-10 bg-slate-900 text-white flex items-center justify-center rounded-xl">
                                                <Layers className="size-6" />
                                            </div>
                                            <span className="text-xl font-bold text-slate-900 dark:text-white">
                                                {config.logo_text || "LandingChat"}{" "}
                                                <span className="text-xs font-normal text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded-full ml-1">OS</span>
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Header / Navegación</CardTitle>
                            <CardDescription>Links del menú y botón CTA</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Texto del CTA</Label>
                                    <Input value={config.header_cta_text} onChange={(e) => update("header_cta_text", e.target.value)} />
                                </div>
                                <div>
                                    <Label>URL del CTA</Label>
                                    <Input value={config.header_cta_href} onChange={(e) => update("header_cta_href", e.target.value)} />
                                </div>
                            </div>
                            <ArrayEditor<LandingNavLink>
                                label="Links de Navegación"
                                items={config.header_nav_links}
                                onChange={(val) => update("header_nav_links", val)}
                                renderItem={(item, i, onChange) => (
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input placeholder="Label" value={item.label} onChange={(e) => onChange({ ...item, label: e.target.value })} />
                                        <Input placeholder="href (#features)" value={item.href} onChange={(e) => onChange({ ...item, href: e.target.value })} />
                                    </div>
                                )}
                                createItem={() => ({ label: "", href: "#" })}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Hero</CardTitle>
                            <CardDescription>Sección principal con título, descripción y CTAs</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Switch checked={config.hero_badge_visible} onCheckedChange={(val) => update("hero_badge_visible", val)} />
                                <Label>Mostrar Badge</Label>
                            </div>
                            {config.hero_badge_visible && (
                                <div>
                                    <Label>Texto del Badge</Label>
                                    <Input value={config.hero_badge_text} onChange={(e) => update("hero_badge_text", e.target.value)} />
                                </div>
                            )}
                            <div>
                                <Label>Título línea 1</Label>
                                <Input value={config.hero_title_line1} onChange={(e) => update("hero_title_line1", e.target.value)} />
                            </div>
                            <div>
                                <Label>Título línea 2 (con gradiente)</Label>
                                <Input value={config.hero_title_line2} onChange={(e) => update("hero_title_line2", e.target.value)} />
                            </div>
                            <div>
                                <Label>Descripción</Label>
                                <Textarea rows={3} value={config.hero_description} onChange={(e) => update("hero_description", e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>CTA Primario — Texto</Label>
                                    <Input value={config.hero_cta_primary_text} onChange={(e) => update("hero_cta_primary_text", e.target.value)} />
                                </div>
                                <div>
                                    <Label>CTA Primario — URL</Label>
                                    <Input value={config.hero_cta_primary_href} onChange={(e) => update("hero_cta_primary_href", e.target.value)} />
                                </div>
                                <div>
                                    <Label>CTA Secundario — Texto</Label>
                                    <Input value={config.hero_cta_secondary_text} onChange={(e) => update("hero_cta_secondary_text", e.target.value)} />
                                </div>
                                <div>
                                    <Label>CTA Secundario — URL</Label>
                                    <Input value={config.hero_cta_secondary_href} onChange={(e) => update("hero_cta_secondary_href", e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <Label>Trust Title</Label>
                                <Input value={config.hero_trust_title} onChange={(e) => update("hero_trust_title", e.target.value)} />
                            </div>
                            <ArrayEditor<LandingTrustBadge>
                                label="Trust Badges"
                                items={config.hero_trust_badges}
                                onChange={(val) => update("hero_trust_badges", val)}
                                renderItem={(item, i, onChange) => (
                                    <div className="grid grid-cols-3 gap-2">
                                        <Input placeholder="Nombre" value={item.name} onChange={(e) => onChange({ ...item, name: e.target.value })} />
                                        <Input placeholder="Estilo (text/italic/icon)" value={item.style ?? "text"} onChange={(e) => onChange({ ...item, style: e.target.value as LandingTrustBadge["style"] })} />
                                        <Input placeholder="Icono (opcional)" value={item.icon ?? ""} onChange={(e) => onChange({ ...item, icon: e.target.value || undefined })} />
                                    </div>
                                )}
                                createItem={() => ({ name: "", style: "text" as const })}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ====== METRICS TAB ====== */}
                <TabsContent value="metrics" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Métricas</CardTitle>
                            <CardDescription>4 indicadores con animación de scroll</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Switch checked={config.metrics_visible} onCheckedChange={(val) => update("metrics_visible", val)} />
                                <Label>Mostrar sección de métricas</Label>
                            </div>
                            {config.metrics_visible && (
                                <ArrayEditor<LandingMetric>
                                    label="Métricas"
                                    items={config.metrics}
                                    onChange={(val) => update("metrics", val)}
                                    renderItem={(item, i, onChange) => (
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input placeholder="Valor (+45%)" value={item.value} onChange={(e) => onChange({ ...item, value: e.target.value })} />
                                            <Input placeholder="Label" value={item.label} onChange={(e) => onChange({ ...item, label: e.target.value })} />
                                        </div>
                                    )}
                                    createItem={() => ({ value: "", label: "" })}
                                />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ====== FEATURES TAB ====== */}
                <TabsContent value="features" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Features (Bento Grid)</CardTitle>
                            <CardDescription>Sección de funcionalidades con tarjetas</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Badge</Label>
                                <Input value={config.features_badge} onChange={(e) => update("features_badge", e.target.value)} />
                            </div>
                            <div>
                                <Label>Título</Label>
                                <Input value={config.features_title} onChange={(e) => update("features_title", e.target.value)} />
                            </div>
                            <div>
                                <Label>Subtítulo</Label>
                                <Textarea rows={2} value={config.features_subtitle} onChange={(e) => update("features_subtitle", e.target.value)} />
                            </div>
                            <ArrayEditor<LandingFeature>
                                label="Features"
                                items={config.features}
                                onChange={(val) => update("features", val)}
                                renderItem={(item, i, onChange) => (
                                    <div className="space-y-2 border-l-2 border-indigo-200 pl-3">
                                        <div className="grid grid-cols-3 gap-2">
                                            <Input placeholder="Icono (Lucide)" value={item.icon} onChange={(e) => onChange({ ...item, icon: e.target.value })} />
                                            <Input placeholder="Título" value={item.title} onChange={(e) => onChange({ ...item, title: e.target.value })} />
                                            <Input placeholder="Span (wide/normal)" value={item.span ?? "normal"} onChange={(e) => onChange({ ...item, span: e.target.value as "wide" | "normal" })} />
                                        </div>
                                        <Textarea rows={2} placeholder="Descripción" value={item.description} onChange={(e) => onChange({ ...item, description: e.target.value })} />
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input placeholder="Badge (opcional)" value={item.badge ?? ""} onChange={(e) => onChange({ ...item, badge: e.target.value || null })} />
                                            <div className="flex items-center gap-2">
                                                <Switch checked={item.highlight ?? false} onCheckedChange={(val) => onChange({ ...item, highlight: val })} />
                                                <Label className="text-xs">Highlight</Label>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                createItem={() => ({ icon: "Star", title: "", description: "", span: "normal" })}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ====== TESTIMONIAL TAB ====== */}
                <TabsContent value="testimonial" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Testimonial</CardTitle>
                            <CardDescription>Quote de un cliente real</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Switch checked={config.testimonial_visible} onCheckedChange={(val) => update("testimonial_visible", val)} />
                                <Label>Mostrar testimonial</Label>
                            </div>
                            {config.testimonial_visible && (
                                <>
                                    <div>
                                        <Label>Badge</Label>
                                        <Input value={config.testimonial_badge} onChange={(e) => update("testimonial_badge", e.target.value)} />
                                    </div>
                                    <div>
                                        <Label>Quote</Label>
                                        <Textarea rows={3} value={config.testimonial.quote} onChange={(e) => update("testimonial", { ...config.testimonial, quote: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Autor</Label>
                                            <Input value={config.testimonial.author} onChange={(e) => update("testimonial", { ...config.testimonial, author: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label>Rol</Label>
                                            <Input value={config.testimonial.role} onChange={(e) => update("testimonial", { ...config.testimonial, role: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label>Empresa</Label>
                                            <Input value={config.testimonial.company} onChange={(e) => update("testimonial", { ...config.testimonial, company: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label>Inicial del Avatar</Label>
                                            <Input maxLength={2} value={config.testimonial.avatar_initial} onChange={(e) => update("testimonial", { ...config.testimonial, avatar_initial: e.target.value })} />
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ====== MARKETPLACE TAB ====== */}
                <TabsContent value="marketplace" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Marketplace de Agentes</CardTitle>
                            <CardDescription>Agentes pre-entrenados y chat demo</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Badge</Label>
                                <Input value={config.marketplace_badge} onChange={(e) => update("marketplace_badge", e.target.value)} />
                            </div>
                            <div>
                                <Label>Título</Label>
                                <Input value={config.marketplace_title} onChange={(e) => update("marketplace_title", e.target.value)} />
                            </div>
                            <div>
                                <Label>Descripción</Label>
                                <Textarea rows={2} value={config.marketplace_description} onChange={(e) => update("marketplace_description", e.target.value)} />
                            </div>
                            <ArrayEditor<LandingMarketplaceAgent>
                                label="Agentes"
                                items={config.marketplace_agents}
                                onChange={(val) => update("marketplace_agents", val)}
                                renderItem={(item, i, onChange) => (
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input placeholder="Nombre" value={item.name} onChange={(e) => onChange({ ...item, name: e.target.value })} />
                                        <Input placeholder="Icono (Lucide)" value={item.icon} onChange={(e) => onChange({ ...item, icon: e.target.value })} />
                                        <Input placeholder="Descripción" value={item.description} onChange={(e) => onChange({ ...item, description: e.target.value })} />
                                        <Input placeholder="Color (pink/orange/blue)" value={item.color} onChange={(e) => onChange({ ...item, color: e.target.value })} />
                                    </div>
                                )}
                                createItem={() => ({ name: "", description: "", icon: "Bot", color: "blue" })}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ====== COMPARISON TAB ====== */}
                <TabsContent value="comparison" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Tabla de Comparación</CardTitle>
                            <CardDescription>Stack Tradicional vs LandingChat OS</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Título</Label>
                                <Input value={config.comparison_title} onChange={(e) => update("comparison_title", e.target.value)} />
                            </div>
                            <div>
                                <Label>Subtítulo</Label>
                                <Input value={config.comparison_subtitle} onChange={(e) => update("comparison_subtitle", e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Título Stack Tradicional</Label>
                                    <Input value={config.comparison_traditional_title} onChange={(e) => update("comparison_traditional_title", e.target.value)} />
                                </div>
                                <div>
                                    <Label>Título LandingChat</Label>
                                    <Input value={config.comparison_landingchat_title} onChange={(e) => update("comparison_landingchat_title", e.target.value)} />
                                </div>
                            </div>
                            <ArrayEditor<LandingComparisonRow>
                                label="Filas de Comparación"
                                items={config.comparison_rows}
                                onChange={(val) => update("comparison_rows", val)}
                                renderItem={(item, i, onChange) => (
                                    <div className="flex items-center gap-3">
                                        <Input className="flex-1" placeholder="Feature" value={item.feature} onChange={(e) => onChange({ ...item, feature: e.target.value })} />
                                        <div className="flex items-center gap-1">
                                            <Switch checked={item.traditional} onCheckedChange={(val) => onChange({ ...item, traditional: val })} />
                                            <Label className="text-xs w-16">Tradicional</Label>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Switch checked={item.landingchat} onCheckedChange={(val) => onChange({ ...item, landingchat: val })} />
                                            <Label className="text-xs w-16">LC</Label>
                                        </div>
                                    </div>
                                )}
                                createItem={() => ({ feature: "", traditional: false, landingchat: true })}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ====== PRICING TAB ====== */}
                <TabsContent value="pricing" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pricing Labels</CardTitle>
                            <CardDescription>Los precios reales vienen de la tabla de Planes. Aquí editas los textos.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Título</Label>
                                <Input value={config.pricing_title} onChange={(e) => update("pricing_title", e.target.value)} />
                            </div>
                            <div>
                                <Label>Subtítulo</Label>
                                <Input value={config.pricing_subtitle} onChange={(e) => update("pricing_subtitle", e.target.value)} />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Badge Popular</Label>
                                    <Input value={config.pricing_popular_label} onChange={(e) => update("pricing_popular_label", e.target.value)} />
                                </div>
                                <div>
                                    <Label>CTA Texto</Label>
                                    <Input value={config.pricing_cta_text} onChange={(e) => update("pricing_cta_text", e.target.value)} />
                                </div>
                                <div>
                                    <Label>CTA Enterprise</Label>
                                    <Input value={config.pricing_enterprise_cta_text} onChange={(e) => update("pricing_enterprise_cta_text", e.target.value)} />
                                </div>
                            </div>
                            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                                💡 Para cambiar los precios, ve a{" "}
                                <a href="/admin/plans" className="font-medium underline">Planes</a>.
                                Los precios se cargan automáticamente desde la base de datos.
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ====== CTA & FOOTER TAB ====== */}
                <TabsContent value="cta" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>CTA Final</CardTitle>
                            <CardDescription>Sección de llamado a la acción antes del footer</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Título</Label>
                                <Input value={config.final_cta_title} onChange={(e) => update("final_cta_title", e.target.value)} />
                            </div>
                            <div>
                                <Label>Descripción</Label>
                                <Textarea rows={2} value={config.final_cta_description} onChange={(e) => update("final_cta_description", e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Botón Primario — Texto</Label>
                                    <Input value={config.final_cta_button_primary_text} onChange={(e) => update("final_cta_button_primary_text", e.target.value)} />
                                </div>
                                <div>
                                    <Label>Botón Primario — URL</Label>
                                    <Input value={config.final_cta_button_primary_href} onChange={(e) => update("final_cta_button_primary_href", e.target.value)} />
                                </div>
                                <div>
                                    <Label>Botón Secundario — Texto</Label>
                                    <Input value={config.final_cta_button_secondary_text} onChange={(e) => update("final_cta_button_secondary_text", e.target.value)} />
                                </div>
                                <div>
                                    <Label>Botón Secundario — URL</Label>
                                    <Input value={config.final_cta_button_secondary_href} onChange={(e) => update("final_cta_button_secondary_href", e.target.value)} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Footer</CardTitle>
                            <CardDescription>Columnas de links y copyright</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Descripción de la marca</Label>
                                <Textarea rows={2} value={config.footer_description} onChange={(e) => update("footer_description", e.target.value)} />
                            </div>
                            <div>
                                <Label>Copyright</Label>
                                <Input value={config.footer_copyright} onChange={(e) => update("footer_copyright", e.target.value)} />
                            </div>

                            {/* Footer columns editor */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label className="text-base font-semibold">Columnas del Footer</Label>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            update("footer_columns", [...config.footer_columns, { title: "Nueva Columna", links: [] }])
                                        }}
                                    >
                                        <Plus className="size-3 mr-1" /> Columna
                                    </Button>
                                </div>
                                {config.footer_columns.map((col, ci) => (
                                    <div key={ci} className="border rounded-lg p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Input
                                                className="max-w-xs font-semibold"
                                                value={col.title}
                                                onChange={(e) => {
                                                    const updated = [...config.footer_columns]
                                                    updated[ci] = { ...col, title: e.target.value }
                                                    update("footer_columns", updated)
                                                }}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-500 hover:text-red-700"
                                                onClick={() => {
                                                    update("footer_columns", config.footer_columns.filter((_, j) => j !== ci))
                                                }}
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                        <ArrayEditor<LandingNavLink>
                                            label="Links"
                                            items={col.links}
                                            onChange={(links) => {
                                                const updated = [...config.footer_columns]
                                                updated[ci] = { ...col, links }
                                                update("footer_columns", updated)
                                            }}
                                            renderItem={(link, li, onChange) => (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <Input placeholder="Label" value={link.label} onChange={(e) => onChange({ ...link, label: e.target.value })} />
                                                    <Input placeholder="href" value={link.href} onChange={(e) => onChange({ ...link, href: e.target.value })} />
                                                </div>
                                            )}
                                            createItem={() => ({ label: "", href: "#" })}
                                        />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ====== SEO TAB ====== */}
                <TabsContent value="seo" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>SEO & Open Graph</CardTitle>
                            <CardDescription>Meta tags para motores de búsqueda y redes sociales</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Title (título en Google)</Label>
                                <Input value={config.seo_title} onChange={(e) => update("seo_title", e.target.value)} />
                                <p className="text-xs text-slate-500 mt-1">{config.seo_title.length}/70 caracteres</p>
                            </div>
                            <div>
                                <Label>Description (descripción en Google)</Label>
                                <Textarea rows={3} value={config.seo_description} onChange={(e) => update("seo_description", e.target.value)} />
                                <p className="text-xs text-slate-500 mt-1">{config.seo_description.length}/160 caracteres</p>
                            </div>
                            <div>
                                <Label>OG Image URL (opcional)</Label>
                                <Input value={config.seo_og_image_url ?? ""} onChange={(e) => update("seo_og_image_url", e.target.value || null)} placeholder="https://..." />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}

// ============================================
// Generic Array Editor Component
// ============================================
interface ArrayEditorProps<T> {
    label: string
    items: T[]
    onChange: (items: T[]) => void
    renderItem: (item: T, index: number, onChange: (item: T) => void) => React.ReactNode
    createItem: () => T
}

function ArrayEditor<T>({ label, items, onChange, renderItem, createItem }: ArrayEditorProps<T>) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{label}</Label>
                <Button variant="outline" size="sm" onClick={() => onChange([...items, createItem()])}>
                    <Plus className="size-3 mr-1" /> Agregar
                </Button>
            </div>
            {items.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                    <div className="flex-1">
                        {renderItem(item, i, (updated) => {
                            const newItems = [...items]
                            newItems[i] = updated
                            onChange(newItems)
                        })}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mt-0.5 text-red-400 hover:text-red-600"
                        onClick={() => onChange(items.filter((_, j) => j !== i))}
                    >
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            ))}
            {items.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">Sin elementos. Click &quot;Agregar&quot; para crear uno.</p>
            )}
        </div>
    )
}
