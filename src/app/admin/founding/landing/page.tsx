"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    ArrowLeft,
    Save,
    Loader2,
    Plus,
    Trash2,
    Eye,
    Image,
    Type,
    Building2,
    Sparkles,
    Layout,
    Zap,
} from "lucide-react"
import Link from "next/link"
import { getLandingConfig, updateLandingConfig } from "./actions"

interface Company {
    name: string
    logo_url: string | null
}

interface Benefit {
    icon: string
    icon_color: string
    title: string
    description: string
}

interface Feature {
    icon: string
    title: string
    description: string
}

interface FooterLink {
    label: string
    href: string
}

interface LandingConfig {
    // Logo
    logo_type: "icon" | "image" | "text"
    logo_icon: string
    logo_image_url: string | null
    logo_text: string

    // Colors
    primary_gradient_from: string
    primary_gradient_to: string
    accent_color: string

    // Header
    header_badge_text: string
    header_badge_visible: boolean

    // Hero
    hero_badge_text: string
    hero_badge_visible: boolean

    // Social proof
    social_proof_title: string
    social_proof_companies: Company[]
    social_proof_badge_text: string
    social_proof_badge_visible: boolean

    // Benefits
    benefits_title: string
    benefits_discount_badge: string
    benefits: Benefit[]

    // Features
    features_subtitle: string
    features_title: string
    features: Feature[]

    // Final CTA
    final_cta_title: string
    final_cta_subtitle: string
    final_cta_description: string
    final_cta_button_text: string
    final_cta_badges: string[]

    // Footer
    footer_links: FooterLink[]
    footer_copyright: string
}

const defaultConfig: LandingConfig = {
    logo_type: "icon",
    logo_icon: "Zap",
    logo_image_url: null,
    logo_text: "LandingChat",
    primary_gradient_from: "#10b981",
    primary_gradient_to: "#06b6d4",
    accent_color: "#f59e0b",
    header_badge_text: "EARLY ADOPTER 2026",
    header_badge_visible: true,
    hero_badge_text: "LANZAMIENTO EXCLUSIVO COLOMBIA",
    hero_badge_visible: true,
    social_proof_title: "Empresas que confían:",
    social_proof_companies: [],
    social_proof_badge_text: "Meta Business Partner",
    social_proof_badge_visible: true,
    benefits_title: "CONVIÉRTETE EN FUNDADOR Y CONGELA TU PRECIO.",
    benefits_discount_badge: "60% OFF LIFE",
    benefits: [],
    features_subtitle: "CONSTRUCTOR DE CHAT-COMMERCE PROFESIONAL",
    features_title: "Construye experiencias de alto nivel",
    features: [],
    final_cta_title: "ÚNETE A LA ÉLITE",
    final_cta_subtitle: "CONSTRUYE EL 2026.",
    final_cta_description: "No permitas que el mercado te pase por encima.",
    final_cta_button_text: "ASEGURAR MI LUGAR AHORA",
    final_cta_badges: [],
    footer_links: [],
    footer_copyright: "© 2026 LANDINGCHAT GLOBAL. 100% COLOMBIA",
}

const iconOptions = [
    "Zap", "Star", "Shield", "MessageSquare", "BarChart3",
    "Users", "Clock", "Sparkles", "Heart", "Rocket",
    "Target", "Award", "Crown", "Gem", "Gift"
]

const colorOptions = ["emerald", "cyan", "amber", "purple", "blue", "red", "pink"]

export default function FoundingLandingEditorPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [config, setConfig] = useState<LandingConfig>(defaultConfig)

    useEffect(() => {
        loadConfig()
    }, [])

    const loadConfig = async () => {
        setLoading(true)
        const result = await getLandingConfig()
        if (result.success && result.data) {
            setConfig({ ...defaultConfig, ...result.data })
        }
        setLoading(false)
    }

    const handleSave = async () => {
        setSaving(true)
        const result = await updateLandingConfig(config)
        if (!result.success) {
            alert(result.error || "Error al guardar")
        }
        setSaving(false)
    }

    const updateConfig = <K extends keyof LandingConfig>(key: K, value: LandingConfig[K]) => {
        setConfig(prev => ({ ...prev, [key]: value }))
    }

    // Company helpers
    const addCompany = () => {
        updateConfig("social_proof_companies", [
            ...config.social_proof_companies,
            { name: "Nueva Empresa", logo_url: null }
        ])
    }

    const updateCompany = (index: number, field: keyof Company, value: string | null) => {
        const updated = [...config.social_proof_companies]
        updated[index] = { ...updated[index], [field]: value }
        updateConfig("social_proof_companies", updated)
    }

    const removeCompany = (index: number) => {
        updateConfig("social_proof_companies", config.social_proof_companies.filter((_, i) => i !== index))
    }

    // Benefit helpers
    const addBenefit = () => {
        updateConfig("benefits", [
            ...config.benefits,
            { icon: "Star", icon_color: "amber", title: "Nuevo Beneficio", description: "Descripción del beneficio" }
        ])
    }

    const updateBenefit = (index: number, field: keyof Benefit, value: string) => {
        const updated = [...config.benefits]
        updated[index] = { ...updated[index], [field]: value }
        updateConfig("benefits", updated)
    }

    const removeBenefit = (index: number) => {
        updateConfig("benefits", config.benefits.filter((_, i) => i !== index))
    }

    // Feature helpers
    const addFeature = () => {
        updateConfig("features", [
            ...config.features,
            { icon: "Sparkles", title: "Nueva Feature", description: "Descripción de la feature" }
        ])
    }

    const updateFeature = (index: number, field: keyof Feature, value: string) => {
        const updated = [...config.features]
        updated[index] = { ...updated[index], [field]: value }
        updateConfig("features", updated)
    }

    const removeFeature = (index: number) => {
        updateConfig("features", config.features.filter((_, i) => i !== index))
    }

    // Footer link helpers
    const addFooterLink = () => {
        updateConfig("footer_links", [
            ...config.footer_links,
            { label: "NUEVO ENLACE", href: "/" }
        ])
    }

    const updateFooterLink = (index: number, field: keyof FooterLink, value: string) => {
        const updated = [...config.footer_links]
        updated[index] = { ...updated[index], [field]: value }
        updateConfig("footer_links", updated)
    }

    const removeFooterLink = (index: number) => {
        updateConfig("footer_links", config.footer_links.filter((_, i) => i !== index))
    }

    // CTA badges helpers
    const addCtaBadge = () => {
        updateConfig("final_cta_badges", [...config.final_cta_badges, "Nuevo Badge"])
    }

    const updateCtaBadge = (index: number, value: string) => {
        const updated = [...config.final_cta_badges]
        updated[index] = value
        updateConfig("final_cta_badges", updated)
    }

    const removeCtaBadge = (index: number) => {
        updateConfig("final_cta_badges", config.final_cta_badges.filter((_, i) => i !== index))
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="size-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/admin/founding">
                            <ArrowLeft className="size-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Editor de Landing</h1>
                        <p className="text-sm text-muted-foreground">
                            Personaliza la landing page de Founding Members
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/founding" target="_blank">
                            <Eye className="size-4 mr-2" />
                            Vista Previa
                        </Link>
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <Loader2 className="size-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="size-4 mr-2" />
                        )}
                        Guardar Cambios
                    </Button>
                </div>
            </div>

            {/* Editor Tabs */}
            <Tabs defaultValue="branding" className="space-y-6">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="branding">
                        <Image className="size-4 mr-2" />
                        Branding
                    </TabsTrigger>
                    <TabsTrigger value="social">
                        <Building2 className="size-4 mr-2" />
                        Social Proof
                    </TabsTrigger>
                    <TabsTrigger value="benefits">
                        <Sparkles className="size-4 mr-2" />
                        Beneficios
                    </TabsTrigger>
                    <TabsTrigger value="features">
                        <Layout className="size-4 mr-2" />
                        Features
                    </TabsTrigger>
                    <TabsTrigger value="cta">
                        <Zap className="size-4 mr-2" />
                        CTAs & Footer
                    </TabsTrigger>
                </TabsList>

                {/* Branding Tab */}
                <TabsContent value="branding" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Logo</CardTitle>
                            <CardDescription>Configura el logo de la landing</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${config.logo_type === "icon" ? "border-primary bg-primary/5" : "border-muted"
                                        }`}
                                    onClick={() => updateConfig("logo_type", "icon")}
                                >
                                    <Zap className="size-8 mx-auto mb-2" />
                                    <p className="text-center text-sm font-medium">Icono</p>
                                </div>
                                <div
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${config.logo_type === "image" ? "border-primary bg-primary/5" : "border-muted"
                                        }`}
                                    onClick={() => updateConfig("logo_type", "image")}
                                >
                                    <Image className="size-8 mx-auto mb-2" />
                                    <p className="text-center text-sm font-medium">Imagen</p>
                                </div>
                                <div
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${config.logo_type === "text" ? "border-primary bg-primary/5" : "border-muted"
                                        }`}
                                    onClick={() => updateConfig("logo_type", "text")}
                                >
                                    <Type className="size-8 mx-auto mb-2" />
                                    <p className="text-center text-sm font-medium">Solo Texto</p>
                                </div>
                            </div>

                            {config.logo_type === "icon" && (
                                <div className="space-y-2">
                                    <Label>Icono del Logo</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {iconOptions.map(icon => (
                                            <Badge
                                                key={icon}
                                                variant={config.logo_icon === icon ? "default" : "outline"}
                                                className="cursor-pointer"
                                                onClick={() => updateConfig("logo_icon", icon)}
                                            >
                                                {icon}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {config.logo_type === "image" && (
                                <div className="space-y-2">
                                    <Label>URL de la Imagen</Label>
                                    <Input
                                        value={config.logo_image_url || ""}
                                        onChange={(e) => updateConfig("logo_image_url", e.target.value || null)}
                                        placeholder="https://..."
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Texto del Logo</Label>
                                <Input
                                    value={config.logo_text}
                                    onChange={(e) => updateConfig("logo_text", e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Colores</CardTitle>
                            <CardDescription>Colores principales del tema</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Gradiente Primario (Desde)</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="color"
                                            value={config.primary_gradient_from}
                                            onChange={(e) => updateConfig("primary_gradient_from", e.target.value)}
                                            className="w-16 h-10 p-1"
                                        />
                                        <Input
                                            value={config.primary_gradient_from}
                                            onChange={(e) => updateConfig("primary_gradient_from", e.target.value)}
                                            className="font-mono"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Gradiente Primario (Hasta)</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="color"
                                            value={config.primary_gradient_to}
                                            onChange={(e) => updateConfig("primary_gradient_to", e.target.value)}
                                            className="w-16 h-10 p-1"
                                        />
                                        <Input
                                            value={config.primary_gradient_to}
                                            onChange={(e) => updateConfig("primary_gradient_to", e.target.value)}
                                            className="font-mono"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Color Acento</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="color"
                                            value={config.accent_color}
                                            onChange={(e) => updateConfig("accent_color", e.target.value)}
                                            className="w-16 h-10 p-1"
                                        />
                                        <Input
                                            value={config.accent_color}
                                            onChange={(e) => updateConfig("accent_color", e.target.value)}
                                            className="font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="pt-4 border-t">
                                <p className="text-sm text-muted-foreground mb-2">Vista previa del gradiente:</p>
                                <div
                                    className="h-12 rounded-lg"
                                    style={{
                                        background: `linear-gradient(to right, ${config.primary_gradient_from}, ${config.primary_gradient_to})`
                                    }}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Badges del Header y Hero</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label>Badge del Header</Label>
                                    <Input
                                        value={config.header_badge_text}
                                        onChange={(e) => updateConfig("header_badge_text", e.target.value)}
                                        className="w-64"
                                    />
                                </div>
                                <Switch
                                    checked={config.header_badge_visible}
                                    onCheckedChange={(v) => updateConfig("header_badge_visible", v)}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label>Badge del Hero</Label>
                                    <Input
                                        value={config.hero_badge_text}
                                        onChange={(e) => updateConfig("hero_badge_text", e.target.value)}
                                        className="w-64"
                                    />
                                </div>
                                <Switch
                                    checked={config.hero_badge_visible}
                                    onCheckedChange={(v) => updateConfig("hero_badge_visible", v)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Social Proof Tab */}
                <TabsContent value="social" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Empresas que Confían</CardTitle>
                            <CardDescription>Logos de empresas para social proof</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Título de la Sección</Label>
                                <Input
                                    value={config.social_proof_title}
                                    onChange={(e) => updateConfig("social_proof_title", e.target.value)}
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Empresas</Label>
                                    <Button size="sm" variant="outline" onClick={addCompany}>
                                        <Plus className="size-4 mr-1" />
                                        Agregar
                                    </Button>
                                </div>

                                {config.social_proof_companies.map((company, index) => (
                                    <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                        <Input
                                            value={company.name}
                                            onChange={(e) => updateCompany(index, "name", e.target.value)}
                                            placeholder="Nombre"
                                            className="flex-1"
                                        />
                                        <Input
                                            value={company.logo_url || ""}
                                            onChange={(e) => updateCompany(index, "logo_url", e.target.value || null)}
                                            placeholder="URL del logo (opcional)"
                                            className="flex-1"
                                        />
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => removeCompany(index)}
                                        >
                                            <Trash2 className="size-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}

                                {config.social_proof_companies.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        No hay empresas agregadas
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t">
                                <div className="space-y-1">
                                    <Label>Badge Extra (ej: &quot;Meta Business Partner&quot;)</Label>
                                    <Input
                                        value={config.social_proof_badge_text}
                                        onChange={(e) => updateConfig("social_proof_badge_text", e.target.value)}
                                        className="w-64"
                                    />
                                </div>
                                <Switch
                                    checked={config.social_proof_badge_visible}
                                    onCheckedChange={(v) => updateConfig("social_proof_badge_visible", v)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Benefits Tab */}
                <TabsContent value="benefits" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Sección de Beneficios</CardTitle>
                            <CardDescription>Beneficios exclusivos para founding members</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Título de la Sección</Label>
                                    <Input
                                        value={config.benefits_title}
                                        onChange={(e) => updateConfig("benefits_title", e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Badge de Descuento</Label>
                                    <Input
                                        value={config.benefits_discount_badge}
                                        onChange={(e) => updateConfig("benefits_discount_badge", e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 pt-4 border-t">
                                <div className="flex items-center justify-between">
                                    <Label>Beneficios</Label>
                                    <Button size="sm" variant="outline" onClick={addBenefit}>
                                        <Plus className="size-4 mr-1" />
                                        Agregar
                                    </Button>
                                </div>

                                {config.benefits.map((benefit, index) => (
                                    <div key={index} className="p-4 bg-muted/50 rounded-lg space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium">Beneficio #{index + 1}</span>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => removeBenefit(index)}
                                            >
                                                <Trash2 className="size-4 text-destructive" />
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Icono</Label>
                                                <select
                                                    value={benefit.icon}
                                                    onChange={(e) => updateBenefit(index, "icon", e.target.value)}
                                                    className="w-full h-9 px-3 rounded-md border bg-background"
                                                >
                                                    {iconOptions.map(icon => (
                                                        <option key={icon} value={icon}>{icon}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Color</Label>
                                                <select
                                                    value={benefit.icon_color}
                                                    onChange={(e) => updateBenefit(index, "icon_color", e.target.value)}
                                                    className="w-full h-9 px-3 rounded-md border bg-background"
                                                >
                                                    {colorOptions.map(color => (
                                                        <option key={color} value={color}>{color}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs">Título</Label>
                                            <Input
                                                value={benefit.title}
                                                onChange={(e) => updateBenefit(index, "title", e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs">Descripción</Label>
                                            <Textarea
                                                value={benefit.description}
                                                onChange={(e) => updateBenefit(index, "description", e.target.value)}
                                                rows={2}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Features Tab */}
                <TabsContent value="features" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Sección de Features</CardTitle>
                            <CardDescription>Características de la plataforma</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Subtítulo</Label>
                                    <Input
                                        value={config.features_subtitle}
                                        onChange={(e) => updateConfig("features_subtitle", e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Título</Label>
                                    <Input
                                        value={config.features_title}
                                        onChange={(e) => updateConfig("features_title", e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 pt-4 border-t">
                                <div className="flex items-center justify-between">
                                    <Label>Features</Label>
                                    <Button size="sm" variant="outline" onClick={addFeature}>
                                        <Plus className="size-4 mr-1" />
                                        Agregar
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {config.features.map((feature, index) => (
                                        <div key={index} className="p-4 bg-muted/50 rounded-lg space-y-3">
                                            <div className="flex items-center justify-between">
                                                <select
                                                    value={feature.icon}
                                                    onChange={(e) => updateFeature(index, "icon", e.target.value)}
                                                    className="h-8 px-2 rounded-md border bg-background text-sm"
                                                >
                                                    {iconOptions.map(icon => (
                                                        <option key={icon} value={icon}>{icon}</option>
                                                    ))}
                                                </select>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="size-8"
                                                    onClick={() => removeFeature(index)}
                                                >
                                                    <Trash2 className="size-3 text-destructive" />
                                                </Button>
                                            </div>
                                            <Input
                                                value={feature.title}
                                                onChange={(e) => updateFeature(index, "title", e.target.value)}
                                                placeholder="Título"
                                                className="h-8 text-sm"
                                            />
                                            <Input
                                                value={feature.description}
                                                onChange={(e) => updateFeature(index, "description", e.target.value)}
                                                placeholder="Descripción"
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* CTA & Footer Tab */}
                <TabsContent value="cta" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>CTA Final</CardTitle>
                            <CardDescription>Llamada a la acción al final de la página</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Título Principal</Label>
                                    <Input
                                        value={config.final_cta_title}
                                        onChange={(e) => updateConfig("final_cta_title", e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Subtítulo (con gradiente)</Label>
                                    <Input
                                        value={config.final_cta_subtitle}
                                        onChange={(e) => updateConfig("final_cta_subtitle", e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Descripción</Label>
                                <Textarea
                                    value={config.final_cta_description}
                                    onChange={(e) => updateConfig("final_cta_description", e.target.value)}
                                    rows={2}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Texto del Botón</Label>
                                <Input
                                    value={config.final_cta_button_text}
                                    onChange={(e) => updateConfig("final_cta_button_text", e.target.value)}
                                />
                            </div>

                            <div className="space-y-3 pt-4 border-t">
                                <div className="flex items-center justify-between">
                                    <Label>Badges debajo del botón</Label>
                                    <Button size="sm" variant="outline" onClick={addCtaBadge}>
                                        <Plus className="size-4 mr-1" />
                                        Agregar
                                    </Button>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {config.final_cta_badges.map((badge, index) => (
                                        <div key={index} className="flex items-center gap-1 bg-muted rounded-lg p-1">
                                            <Input
                                                value={badge}
                                                onChange={(e) => updateCtaBadge(index, e.target.value)}
                                                className="h-7 w-40 text-sm"
                                            />
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="size-7"
                                                onClick={() => removeCtaBadge(index)}
                                            >
                                                <Trash2 className="size-3 text-destructive" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Footer</CardTitle>
                            <CardDescription>Enlaces y copyright del pie de página</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Enlaces del Footer</Label>
                                    <Button size="sm" variant="outline" onClick={addFooterLink}>
                                        <Plus className="size-4 mr-1" />
                                        Agregar
                                    </Button>
                                </div>

                                {config.footer_links.map((link, index) => (
                                    <div key={index} className="flex items-center gap-3">
                                        <Input
                                            value={link.label}
                                            onChange={(e) => updateFooterLink(index, "label", e.target.value)}
                                            placeholder="Texto"
                                            className="flex-1"
                                        />
                                        <Input
                                            value={link.href}
                                            onChange={(e) => updateFooterLink(index, "href", e.target.value)}
                                            placeholder="URL"
                                            className="flex-1"
                                        />
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => removeFooterLink(index)}
                                        >
                                            <Trash2 className="size-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2 pt-4 border-t">
                                <Label>Texto de Copyright</Label>
                                <Input
                                    value={config.footer_copyright}
                                    onChange={(e) => updateConfig("footer_copyright", e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
