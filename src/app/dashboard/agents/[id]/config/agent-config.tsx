"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { updateAgentGeneral, updateAgentPersonality, updateAgentKnowledge, updateAgentSkills, updateAgentSchedule } from "./actions"
import { ImageUploader } from "@/components/shared/image-uploader"
import { SKILL_DEFINITIONS, getSkillsForMode, type SkillsConfig } from "@/lib/ai/skills"
import type { OrgMode } from "@/lib/ai/agent-factory"

interface OrgContextData {
    industry: string | null
    features: Record<string, boolean> | null
    planName: string | null
}

interface OrgMediaFile {
    id: string
    name: string
    description: string | null
    file_name: string
    file_url: string
    file_type: string
    file_size: number
    media_category: string
    tags: string[]
    is_active: boolean
    usage_count: number
    created_at: string
}

interface AgentConfigProps {
    agent: any
    orgContext: OrgContextData
}

// Mapeo de features a info visual para la UI de módulos
const MODULE_INFO: Record<string, { label: string; icon: string; description: string; tools: string[] }> = {
    ecommerce: {
        label: "E-Commerce",
        icon: "shopping_cart",
        description: "Búsqueda de productos, carrito, checkout, cupones y envíos",
        tools: ["search_products", "show_product", "get_product_availability", "add_to_cart", "get_cart", "remove_from_cart", "update_cart_quantity", "start_checkout", "get_shipping_options", "apply_discount"],
    },
    real_estate: {
        label: "Inmobiliario",
        icon: "apartment",
        description: "Búsqueda de propiedades, filtros avanzados y agendamiento de visitas",
        tools: ["search_properties", "show_property", "schedule_appointment"],
    },
    appointments: {
        label: "Agendamiento de Citas",
        icon: "calendar_month",
        description: "Programación de citas y gestión de disponibilidad",
        tools: ["schedule_appointment"],
    },
}

const SHARED_MODULE = {
    label: "Compartidas",
    icon: "hub",
    description: "Identificación de clientes, historial, info de tienda, estado de órdenes",
    tools: ["identify_customer", "get_store_info", "get_order_status", "get_customer_history", "escalate_to_human", "send_media"],
}

function getActiveMode(orgContext: OrgContextData): string {
    if (orgContext.features?.real_estate && orgContext.features?.ecommerce) return "hybrid"
    if (orgContext.features?.real_estate) return "real_estate"
    if (orgContext.features?.ecommerce) return "ecommerce"
    if (orgContext.industry === "real_estate") return "real_estate"
    if (orgContext.industry === "ecommerce") return "ecommerce"
    return "ecommerce"
}

export function AgentConfig({ agent, orgContext }: AgentConfigProps) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState("general")
    const [loading, setLoading] = useState(false)
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    // General form state
    const [name, setName] = useState(agent.name)
    const [status, setStatus] = useState(agent.status)
    const [avatarUrl, setAvatarUrl] = useState(agent.avatar_url || "")

    // Personality form state
    const [tone, setTone] = useState(agent.configuration?.personality?.tone || "professional")
    const [instructions, setInstructions] = useState(agent.configuration?.personality?.instructions || agent.configuration?.system_prompt || "")

    // Knowledge form state
    const [productKnowledge, setProductKnowledge] = useState(agent.configuration?.knowledge?.product_knowledge !== false)
    const [documents, setDocuments] = useState<Array<{ id: string; name: string; status: string; file_size: number; created_at: string; error_message?: string }>>([])
    const [uploading, setUploading] = useState(false)
    const [docsLoading, setDocsLoading] = useState(true)

    // Skills form state
    const activeMode = getActiveMode(orgContext) as OrgMode
    const modeSkills = getSkillsForMode(activeMode)
    const [skillsConfig, setSkillsConfig] = useState<SkillsConfig>(() => {
        const saved = agent.configuration?.skills || {}
        const initial: SkillsConfig = {}
        for (const skill of modeSkills) {
            initial[skill.id] = {
                enabled: saved[skill.id]?.enabled ?? true,
                customInstructions: saved[skill.id]?.customInstructions ?? null,
            }
        }
        return initial
    })
    const [editingSkill, setEditingSkill] = useState<string | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const mediaFileInputRef = useRef<HTMLInputElement>(null)

    // Media files state
    const [mediaFiles, setMediaFiles] = useState<OrgMediaFile[]>([])
    const [mediaLoading, setMediaLoading] = useState(true)
    const [mediaUploading, setMediaUploading] = useState(false)
    const [mediaForm, setMediaForm] = useState({
        name: "",
        description: "",
        category: "document",
        tags: "",
    })
    const [showMediaForm, setShowMediaForm] = useState(false)

    // Schedule state
    const DAY_LABELS: Record<string, string> = {
        mon: "Lunes", tue: "Martes", wed: "Miércoles", thu: "Jueves",
        fri: "Viernes", sat: "Sábado", sun: "Domingo",
    }
    const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    const TIMEZONES = [
        { value: "America/Bogota", label: "Colombia (GMT-5)" },
        { value: "America/Mexico_City", label: "México Centro (GMT-6)" },
        { value: "America/Lima", label: "Perú (GMT-5)" },
        { value: "America/Santiago", label: "Chile (GMT-3)" },
        { value: "America/Argentina/Buenos_Aires", label: "Argentina (GMT-3)" },
        { value: "America/Sao_Paulo", label: "Brasil (GMT-3)" },
        { value: "America/Guayaquil", label: "Ecuador (GMT-5)" },
        { value: "America/Caracas", label: "Venezuela (GMT-4)" },
        { value: "America/Panama", label: "Panamá (GMT-5)" },
        { value: "America/Costa_Rica", label: "Costa Rica (GMT-6)" },
    ]

    const savedSchedule = agent.configuration?.schedule
    const [scheduleEnabled, setScheduleEnabled] = useState(savedSchedule?.enabled || false)
    const [scheduleTimezone, setScheduleTimezone] = useState(savedSchedule?.timezone || "America/Bogota")
    const [scheduleChannels, setScheduleChannels] = useState<Record<string, Record<string, { from: string; to: string } | null>>>(() => {
        const defaultDays: Record<string, { from: string; to: string } | null> = {}
        for (const day of DAY_KEYS) {
            defaultDays[day] = day === "sun" ? null : { from: "08:00", to: "18:00" }
        }
        return savedSchedule?.channels || { whatsapp: defaultDays }
    })
    const [scheduleSaving, setScheduleSaving] = useState(false)

    // Cargar documentos existentes
    const loadDocuments = useCallback(async () => {
        setDocsLoading(true)
        try {
            const { createClient } = await import("@/lib/supabase/client")
            const supabase = createClient()
            const { data } = await supabase
                .from("agent_documents")
                .select("id, name, status, file_size, created_at, error_message")
                .eq("agent_id", agent.id)
                .order("created_at", { ascending: false })
            setDocuments(data || [])
        } catch (err) {
            console.error("Error loading documents:", err)
        } finally {
            setDocsLoading(false)
        }
    }, [agent.id])

    const loadMediaFiles = useCallback(async () => {
        setMediaLoading(true)
        try {
            const res = await fetch("/api/media")
            const data = await res.json()
            setMediaFiles(data.media || [])
        } catch (err) {
            console.error("Error loading media:", err)
        } finally {
            setMediaLoading(false)
        }
    }, [])

    useEffect(() => {
        if (isMounted) {
            loadDocuments()
            loadMediaFiles()
        }
    }, [isMounted, loadDocuments, loadMediaFiles])

    const handleUploadDocument = async (file: File) => {
        setUploading(true)
        try {
            const formData = new FormData()
            formData.append("agentId", agent.id)
            formData.append("file", file)

            const res = await fetch("/api/agents/documents", {
                method: "POST",
                body: formData,
            })
            const data = await res.json()

            if (data.success) {
                await loadDocuments()
            } else {
                alert(data.error || "Error al subir documento")
            }
        } catch {
            alert("Error de conexión al subir documento")
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const handleDeleteDocument = async (docId: string, docName: string) => {
        if (!confirm(`¿Eliminar "${docName}"? El agente ya no tendrá acceso a este documento.`)) return

        try {
            const res = await fetch(`/api/agents/documents?id=${docId}`, { method: "DELETE" })
            const data = await res.json()
            if (data.success) {
                setDocuments(prev => prev.filter(d => d.id !== docId))
            } else {
                alert(data.error || "Error al eliminar")
            }
        } catch {
            alert("Error de conexión")
        }
    }

    if (!isMounted) {
        return null
    }

    const handleSaveGeneral = async () => {
        setLoading(true)
        try {
            await updateAgentGeneral(agent.id, { name, avatar_url: avatarUrl, status })
            router.refresh()
        } catch (error) {
            alert("Error al guardar configuración general")
        } finally {
            setLoading(false)
        }
    }

    const handleSavePersonality = async () => {
        setLoading(true)
        try {
            await updateAgentPersonality(agent.id, { tone, instructions })
            router.refresh()
        } catch (error) {
            alert("Error al guardar personalidad")
        } finally {
            setLoading(false)
        }
    }

    const handleSaveKnowledge = async () => {
        setLoading(true)
        try {
            await updateAgentKnowledge(agent.id, { product_knowledge: productKnowledge })
            router.refresh()
        } catch (error) {
            alert("Error al guardar base de conocimiento")
        } finally {
            setLoading(false)
        }
    }

    const handleSaveSkills = async () => {
        setLoading(true)
        try {
            await updateAgentSkills(agent.id, skillsConfig)
            setEditingSkill(null)
            router.refresh()
        } catch (error) {
            alert("Error al guardar skills")
        } finally {
            setLoading(false)
        }
    }

    const handleUploadMedia = async (file: File) => {
        if (!mediaForm.name.trim()) {
            alert("El nombre es requerido")
            return
        }
        setMediaUploading(true)
        try {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("name", mediaForm.name.trim())
            formData.append("description", mediaForm.description.trim())
            formData.append("media_category", mediaForm.category)
            formData.append("tags", mediaForm.tags)

            const res = await fetch("/api/media", { method: "POST", body: formData })
            const data = await res.json()

            if (data.success) {
                setMediaFiles(prev => [data.media, ...prev])
                setMediaForm({ name: "", description: "", category: "document", tags: "" })
                setShowMediaForm(false)
            } else {
                alert(data.error || "Error al subir archivo")
            }
        } catch {
            alert("Error de conexión al subir archivo")
        } finally {
            setMediaUploading(false)
            if (mediaFileInputRef.current) mediaFileInputRef.current.value = ""
        }
    }

    const handleDeleteMedia = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar "${name}"? El agente ya no podrá compartir este archivo.`)) return
        try {
            const res = await fetch(`/api/media?id=${id}`, { method: "DELETE" })
            const data = await res.json()
            if (data.success) {
                setMediaFiles(prev => prev.filter(f => f.id !== id))
            } else {
                alert(data.error || "Error al eliminar")
            }
        } catch {
            alert("Error de conexión")
        }
    }

    const MEDIA_CATEGORIES = [
        { value: "document", label: "Documento / PDF", icon: "description" },
        { value: "audio", label: "Audio", icon: "audio_file" },
        { value: "image", label: "Imagen", icon: "image" },
        { value: "video", label: "Video", icon: "video_file" },
        { value: "catalog", label: "Catálogo", icon: "menu_book" },
    ]

    const tabs = [
        { id: "general", label: "General", icon: "settings" },
        { id: "personality", label: "Personalidad", icon: "psychology" },
        { id: "modules", label: "Módulos", icon: "extension" },
        { id: "knowledge", label: "Conocimiento", icon: "menu_book" },
        { id: "media", label: "Archivos", icon: "attach_file" },
        { id: "schedule", label: "Horarios", icon: "schedule" },
    ]

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/agents")} className="rounded-full">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-text-light-primary dark:text-text-dark-primary">{agent.name}</h1>
                        <p className="text-text-light-secondary dark:text-text-dark-secondary">Configuración y personalización del agente</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant={agent.status === 'available' ? 'default' : 'secondary'} className={agent.status === 'available' ? 'bg-green-500 hover:bg-green-600 text-white' : ''}>
                        {agent.status === 'available' ? 'Disponible' : 'Offline'}
                    </Badge>
                    <Button variant="outline" size="sm">
                        <span className="material-symbols-outlined mr-2 text-lg">visibility</span>
                        Ver Preview
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-border-light dark:border-border-dark">
                <nav className="flex gap-8">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 pb-4 border-b-2 transition-all ${activeTab === tab.id
                                ? "border-primary text-primary font-semibold"
                                : "border-transparent text-text-light-secondary dark:text-text-dark-secondary hover:text-text-light-primary dark:hover:text-text-dark-primary"
                                }`}
                        >
                            <span className={`material-symbols-outlined text-xl ${activeTab === tab.id ? "filled" : ""}`}>{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-6">
                    {activeTab === "general" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Información Básica</CardTitle>
                                <CardDescription>Detalles principales de la identidad del agente</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label>Nombre del Agente</Label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Ej: Alejandra"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Rol / Cargo</Label>
                                    <Input
                                        placeholder="Ej: Asistente de Ventas"
                                        defaultValue="Asistente Virtual"
                                    />
                                </div>
                                <div className="flex justify-end pt-4">
                                    <Button onClick={handleSaveGeneral} disabled={loading}>
                                        {loading ? "Guardando..." : "Guardar Cambios"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === "personality" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Personalidad y Comportamiento</CardTitle>
                                <CardDescription>Define el tono y las instrucciones del sistema</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label>Tono de Voz</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        {['professional', 'friendly', 'casual', 'formal'].map((t) => (
                                            <div
                                                key={t}
                                                onClick={() => setTone(t)}
                                                className={`cursor-pointer rounded-lg border p-4 transition-all hover:border-primary ${tone === t
                                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                    : 'border-border-light dark:border-border-dark'
                                                    }`}
                                            >
                                                <div className="font-medium capitalize mb-1">{t}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {t === 'professional' && 'Claro, directo y eficiente.'}
                                                    {t === 'friendly' && 'Cálido, empático y cercano.'}
                                                    {t === 'casual' && 'Relajado y conversacional.'}
                                                    {t === 'formal' && 'Respetuoso y estructurado.'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Instrucciones del Sistema (Prompt)</Label>
                                    <Textarea
                                        value={instructions}
                                        onChange={(e) => setInstructions(e.target.value)}
                                        placeholder="Describe detalladamente cómo debe actuar el agente..."
                                        rows={10}
                                        className="resize-none font-mono text-sm bg-slate-50 dark:bg-slate-900/50"
                                    />
                                </div>
                                <div className="flex justify-end pt-4">
                                    <Button onClick={handleSavePersonality} disabled={loading}>
                                        {loading ? "Guardando..." : "Guardar Cambios"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === "modules" && (
                        <>
                        <Card>
                            <CardHeader>
                                <CardTitle>Módulos del Agente</CardTitle>
                                <CardDescription>
                                    Capacidades activas según tu plan{orgContext.planName ? ` (${orgContext.planName})` : ""}.
                                    Los módulos determinan qué herramientas tiene disponibles el agente AI.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Modo activo */}
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                                    <span className="material-symbols-outlined text-primary">auto_awesome</span>
                                    <div>
                                        <p className="font-semibold text-sm">Modo: <span className="capitalize">{getActiveMode(orgContext).replace("_", " ")}</span></p>
                                        <p className="text-xs text-muted-foreground">
                                            {getActiveMode(orgContext) === "hybrid"
                                                ? "Combina herramientas de e-commerce e inmobiliario"
                                                : getActiveMode(orgContext) === "real_estate"
                                                    ? "Herramientas especializadas para inmobiliarias"
                                                    : "Herramientas de tienda en línea y ventas"}
                                        </p>
                                    </div>
                                </div>

                                {/* Módulo compartido (siempre activo) */}
                                <div className="p-4 border border-border-light dark:border-border-dark rounded-xl">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                            <span className="material-symbols-outlined">{SHARED_MODULE.icon}</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold">{SHARED_MODULE.label}</p>
                                                <Badge variant="secondary" className="text-xs">Siempre activo</Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{SHARED_MODULE.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                        {SHARED_MODULE.tools.map(tool => (
                                            <Badge key={tool} variant="outline" className="text-xs font-mono">{tool}</Badge>
                                        ))}
                                    </div>
                                </div>

                                {/* Módulos verticales */}
                                {Object.entries(MODULE_INFO).map(([key, mod]) => {
                                    const isActive = key === "appointments"
                                        ? orgContext.features?.appointments === true
                                        : getActiveMode(orgContext) === key || getActiveMode(orgContext) === "hybrid"
                                    return (
                                        <div
                                            key={key}
                                            className={`p-4 border rounded-xl transition-all ${
                                                isActive
                                                    ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20"
                                                    : "border-border-light dark:border-border-dark opacity-50"
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className={`p-2 rounded-lg ${
                                                    isActive
                                                        ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                                                        : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                                                }`}>
                                                    <span className="material-symbols-outlined">{mod.icon}</span>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold">{mod.label}</p>
                                                        {isActive ? (
                                                            <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs">Activo</Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="text-xs">No incluido</Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">{mod.description}</p>
                                                </div>
                                            </div>
                                            {isActive && (
                                                <div className="flex flex-wrap gap-1.5 mt-3">
                                                    {mod.tools.map(tool => (
                                                        <Badge key={tool} variant="outline" className="text-xs font-mono">{tool}</Badge>
                                                    ))}
                                                </div>
                                            )}
                                            {!isActive && (
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    Actualiza tu plan para habilitar este módulo.
                                                </p>
                                            )}
                                        </div>
                                    )
                                })}
                            </CardContent>
                        </Card>

                        {/* Skills configurables */}
                        {modeSkills.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Skills del Agente</CardTitle>
                                    <CardDescription>
                                        Instrucciones procedurales que determinan cómo actúa el agente.
                                        Puedes personalizar cada skill o deshabilitarlo.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {modeSkills.map(skill => {
                                        const config = skillsConfig[skill.id]
                                        const isEnabled = config?.enabled !== false
                                        const isEditing = editingSkill === skill.id
                                        const hasCustom = !!config?.customInstructions

                                        return (
                                            <div
                                                key={skill.id}
                                                className={`p-4 border rounded-xl transition-all ${
                                                    isEnabled
                                                        ? "border-border-light dark:border-border-dark"
                                                        : "border-border-light dark:border-border-dark opacity-50"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                                                            <span className="material-symbols-outlined text-lg">psychology</span>
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-semibold text-sm">{skill.name}</p>
                                                                <Badge variant="outline" className="text-[10px] capitalize">{skill.mode}</Badge>
                                                                {hasCustom && (
                                                                    <Badge className="bg-violet-500 hover:bg-violet-600 text-white text-[10px]">Personalizado</Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">{skill.description}</p>
                                                        </div>
                                                    </div>
                                                    <Switch
                                                        checked={isEnabled}
                                                        onCheckedChange={(checked) => {
                                                            setSkillsConfig(prev => ({
                                                                ...prev,
                                                                [skill.id]: { ...prev[skill.id], enabled: checked }
                                                            }))
                                                        }}
                                                    />
                                                </div>

                                                {isEnabled && (
                                                    <div className="mt-3">
                                                        {isEditing ? (
                                                            <div className="space-y-2">
                                                                <Textarea
                                                                    value={config?.customInstructions || skill.defaultInstructions}
                                                                    onChange={(e) => {
                                                                        setSkillsConfig(prev => ({
                                                                            ...prev,
                                                                            [skill.id]: {
                                                                                ...prev[skill.id],
                                                                                customInstructions: e.target.value
                                                                            }
                                                                        }))
                                                                    }}
                                                                    rows={6}
                                                                    className="font-mono text-xs resize-none bg-slate-50 dark:bg-slate-900/50"
                                                                />
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => {
                                                                            setSkillsConfig(prev => ({
                                                                                ...prev,
                                                                                [skill.id]: { ...prev[skill.id], customInstructions: null }
                                                                            }))
                                                                            setEditingSkill(null)
                                                                        }}
                                                                    >
                                                                        Restaurar default
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => setEditingSkill(null)}
                                                                    >
                                                                        Cerrar
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => setEditingSkill(skill.id)}
                                                                className="w-full text-left p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 hover:border-primary/50 transition-colors cursor-pointer"
                                                            >
                                                                <p className="text-xs text-muted-foreground line-clamp-3 font-mono whitespace-pre-wrap">
                                                                    {config?.customInstructions || skill.defaultInstructions}
                                                                </p>
                                                                <p className="text-xs text-primary mt-1 font-medium">Click para editar</p>
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}

                                    <div className="flex justify-end pt-2">
                                        <Button onClick={handleSaveSkills} disabled={loading}>
                                            {loading ? "Guardando..." : "Guardar Skills"}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                        </>
                    )}

                    {activeTab === "knowledge" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Fuentes de Conocimiento</CardTitle>
                                <CardDescription>Gestiona la información a la que tiene acceso el agente</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center justify-between p-4 border border-border-light dark:border-border-dark rounded-xl bg-card-light dark:bg-card-dark">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                                            <span className="material-symbols-outlined">inventory_2</span>
                                        </div>
                                        <div>
                                            <p className="font-semibold">Catálogo de Productos</p>
                                            <p className="text-sm text-muted-foreground">Acceso automático a tus productos y precios</p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={productKnowledge}
                                        onCheckedChange={setProductKnowledge}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label>Documentos de Conocimiento</Label>
                                            <p className="text-xs text-muted-foreground mt-0.5">PDF, TXT, MD o CSV — El agente usará el contenido para responder</p>
                                        </div>
                                        <div>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".pdf,.txt,.md,.csv"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) handleUploadDocument(file)
                                                }}
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={uploading}
                                            >
                                                <span className="material-symbols-outlined mr-2 text-sm">
                                                    {uploading ? "sync" : "upload_file"}
                                                </span>
                                                {uploading ? "Subiendo..." : "Subir documento"}
                                            </Button>
                                        </div>
                                    </div>

                                    {docsLoading ? (
                                        <div className="p-6 text-center text-muted-foreground text-sm">
                                            Cargando documentos...
                                        </div>
                                    ) : documents.length === 0 ? (
                                        <div
                                            className="p-8 border-2 border-dashed border-border-light dark:border-border-dark rounded-xl flex flex-col items-center justify-center text-center text-muted-foreground bg-slate-50 dark:bg-slate-900/20 cursor-pointer hover:border-primary/50 transition-colors"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">description</span>
                                            <p className="font-medium">No hay documentos subidos</p>
                                            <p className="text-xs">Sube manuales, políticas, guías de talla o cualquier documento que el agente deba conocer</p>
                                            <p className="text-xs text-primary mt-2 font-medium">Haz clic para subir</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {documents.map((doc) => (
                                                <div
                                                    key={doc.id}
                                                    className="flex items-center justify-between p-3 border rounded-lg bg-card-light dark:bg-card-dark"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className={`p-1.5 rounded-lg ${
                                                            doc.status === "ready"
                                                                ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                                                                : doc.status === "error"
                                                                ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                                                : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
                                                        }`}>
                                                            <span className="material-symbols-outlined text-base">
                                                                {doc.status === "ready" ? "check_circle" : doc.status === "error" ? "error" : "hourglass_top"}
                                                            </span>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium truncate">{doc.name}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {(doc.file_size / 1024).toFixed(0)} KB
                                                                {doc.status === "ready" && " · Listo"}
                                                                {doc.status === "processing" && " · Procesando..."}
                                                                {doc.status === "error" && ` · Error: ${doc.error_message || "No se pudo procesar"}`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteDocument(doc.id, doc.name)}
                                                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
                                                    >
                                                        <span className="material-symbols-outlined text-base">delete</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end pt-4">
                                    <Button onClick={handleSaveKnowledge} disabled={loading}>
                                        {loading ? "Guardando..." : "Guardar Cambios"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === "media" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Archivos para Compartir</CardTitle>
                                <CardDescription>
                                    Archivos que el agente puede <strong>enviar a los clientes</strong> durante las conversaciones.
                                    A diferencia de &quot;Conocimiento&quot; (documentos que el agente lee internamente),
                                    estos archivos se comparten directamente con el cliente.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Info box */}
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                                    <span className="material-symbols-outlined text-blue-500 mt-0.5">info</span>
                                    <div className="text-xs text-blue-700 dark:text-blue-300">
                                        <p className="font-semibold mb-1">Ejemplos de uso:</p>
                                        <ul className="list-disc list-inside space-y-0.5">
                                            <li>PDF de requisitos de arriendo para inmobiliarias</li>
                                            <li>Catálogo de productos para tiendas</li>
                                            <li>Audios informativos o de bienvenida</li>
                                            <li>Imágenes de referencia o tablas de tallas</li>
                                        </ul>
                                        <p className="mt-1.5">El agente decidirá cuándo enviar cada archivo basándose en la <em>instrucción</em> que configures.</p>
                                    </div>
                                </div>

                                {/* Upload form toggle */}
                                {!showMediaForm ? (
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowMediaForm(true)}
                                        className="w-full border-dashed"
                                    >
                                        <span className="material-symbols-outlined mr-2 text-lg">add</span>
                                        Agregar archivo
                                    </Button>
                                ) : (
                                    <div className="space-y-4 p-4 border border-primary/20 rounded-xl bg-primary/5">
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold text-sm">Nuevo archivo</p>
                                            <button
                                                onClick={() => {
                                                    setShowMediaForm(false)
                                                    setMediaForm({ name: "", description: "", category: "document", tags: "" })
                                                }}
                                                className="text-muted-foreground hover:text-foreground"
                                            >
                                                <span className="material-symbols-outlined text-lg">close</span>
                                            </button>
                                        </div>

                                        {/* Nombre */}
                                        <div className="space-y-1.5">
                                            <Label>Nombre visible *</Label>
                                            <Input
                                                value={mediaForm.name}
                                                onChange={(e) => setMediaForm(prev => ({ ...prev, name: e.target.value }))}
                                                placeholder='Ej: "Requisitos de Arriendo", "Catálogo 2026"'
                                            />
                                        </div>

                                        {/* Instrucción para el AI */}
                                        <div className="space-y-1.5">
                                            <Label>Instrucción para el agente</Label>
                                            <p className="text-xs text-muted-foreground">¿Cuándo debe enviar este archivo?</p>
                                            <Textarea
                                                value={mediaForm.description}
                                                onChange={(e) => setMediaForm(prev => ({ ...prev, description: e.target.value }))}
                                                placeholder='Ej: "Enviar cuando el cliente pregunte por requisitos de arriendo o al mencionar documentos necesarios"'
                                                rows={2}
                                                className="resize-none text-sm"
                                            />
                                        </div>

                                        {/* Categoría */}
                                        <div className="space-y-1.5">
                                            <Label>Categoría</Label>
                                            <div className="grid grid-cols-5 gap-1.5">
                                                {MEDIA_CATEGORIES.map((cat) => (
                                                    <button
                                                        key={cat.value}
                                                        type="button"
                                                        onClick={() => setMediaForm(prev => ({ ...prev, category: cat.value }))}
                                                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-colors ${
                                                            mediaForm.category === cat.value
                                                                ? "border-primary bg-primary/10 text-primary"
                                                                : "border-border-light dark:border-border-dark text-muted-foreground hover:border-slate-300"
                                                        }`}
                                                    >
                                                        <span className="material-symbols-outlined text-lg">{cat.icon}</span>
                                                        {cat.label.split(" / ")[0]}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Tags */}
                                        <div className="space-y-1.5">
                                            <Label>Tags <span className="text-muted-foreground font-normal">(separados por coma)</span></Label>
                                            <Input
                                                value={mediaForm.tags}
                                                onChange={(e) => setMediaForm(prev => ({ ...prev, tags: e.target.value }))}
                                                placeholder="arriendo, requisitos, documentos"
                                            />
                                        </div>

                                        {/* File input + submit */}
                                        <div className="flex items-center gap-3">
                                            <input
                                                ref={mediaFileInputRef}
                                                type="file"
                                                className="hidden"
                                                accept=".pdf,.mp3,.wav,.ogg,.webm,.mp4,.jpg,.jpeg,.png,.webp,.gif"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) {
                                                        if (!mediaForm.name) {
                                                            setMediaForm(prev => ({
                                                                ...prev,
                                                                name: file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ")
                                                            }))
                                                        }
                                                        handleUploadMedia(file)
                                                    }
                                                }}
                                            />
                                            <Button
                                                onClick={() => {
                                                    if (!mediaForm.name.trim()) {
                                                        alert("Escribe un nombre antes de seleccionar el archivo")
                                                        return
                                                    }
                                                    mediaFileInputRef.current?.click()
                                                }}
                                                disabled={mediaUploading || !mediaForm.name.trim()}
                                            >
                                                <span className="material-symbols-outlined mr-2 text-sm">
                                                    {mediaUploading ? "sync" : "upload_file"}
                                                </span>
                                                {mediaUploading ? "Subiendo..." : "Seleccionar y subir archivo"}
                                            </Button>
                                            <p className="text-xs text-muted-foreground">PDF, audio, imagen o video (máx 10MB)</p>
                                        </div>
                                    </div>
                                )}

                                {/* Files list */}
                                {mediaLoading ? (
                                    <div className="p-6 text-center text-muted-foreground text-sm">
                                        Cargando archivos...
                                    </div>
                                ) : mediaFiles.length === 0 && !showMediaForm ? (
                                    <div
                                        className="p-8 border-2 border-dashed border-border-light dark:border-border-dark rounded-xl flex flex-col items-center justify-center text-center text-muted-foreground bg-slate-50 dark:bg-slate-900/20 cursor-pointer hover:border-primary/50 transition-colors"
                                        onClick={() => setShowMediaForm(true)}
                                    >
                                        <span className="material-symbols-outlined text-4xl mb-2 opacity-50">attach_file</span>
                                        <p className="font-medium">No hay archivos configurados</p>
                                        <p className="text-xs">Sube PDFs, catálogos, audios u otros archivos que el agente pueda compartir</p>
                                        <p className="text-xs text-primary mt-2 font-medium">Haz clic para agregar</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {mediaFiles.map((file) => {
                                            const catInfo = MEDIA_CATEGORIES.find(c => c.value === file.media_category)
                                            return (
                                                <div
                                                    key={file.id}
                                                    className="flex items-center justify-between p-3 border rounded-lg bg-card-light dark:bg-card-dark"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                                                            <span className="material-symbols-outlined text-base">
                                                                {catInfo?.icon || "description"}
                                                            </span>
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-medium truncate">{file.name}</p>
                                                            {file.description && (
                                                                <p className="text-xs text-muted-foreground truncate">{file.description}</p>
                                                            )}
                                                            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                                                <span>{(file.file_size / 1024).toFixed(0)} KB</span>
                                                                <span>·</span>
                                                                <span className="capitalize">{file.media_category}</span>
                                                                {file.usage_count > 0 && (
                                                                    <>
                                                                        <span>·</span>
                                                                        <span>Enviado {file.usage_count}x</span>
                                                                    </>
                                                                )}
                                                                {file.tags?.length > 0 && (
                                                                    <>
                                                                        <span>·</span>
                                                                        <span>{file.tags.join(", ")}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        <a
                                                            href={file.file_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground hover:text-primary transition-colors"
                                                            title="Ver archivo"
                                                        >
                                                            <span className="material-symbols-outlined text-base">visibility</span>
                                                        </a>
                                                        <button
                                                            onClick={() => handleDeleteMedia(file.id, file.name)}
                                                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-colors"
                                                            title="Eliminar"
                                                        >
                                                            <span className="material-symbols-outlined text-base">delete</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === "schedule" && (
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>Horario de Atención por Canal</CardTitle>
                                            <CardDescription>
                                                Define cuándo la IA NO responderá automáticamente en cada canal.
                                                Fuera de este horario, la IA atenderá las conversaciones.
                                            </CardDescription>
                                        </div>
                                        <Switch
                                            checked={scheduleEnabled}
                                            onCheckedChange={setScheduleEnabled}
                                        />
                                    </div>
                                </CardHeader>
                                {scheduleEnabled && (
                                    <CardContent className="space-y-6">
                                        <div className="space-y-2">
                                            <Label>Zona horaria</Label>
                                            <Select value={scheduleTimezone} onValueChange={setScheduleTimezone}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {TIMEZONES.map((tz) => (
                                                        <SelectItem key={tz.value} value={tz.value}>
                                                            {tz.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="rounded-lg border border-border p-4 space-y-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="material-symbols-outlined text-green-500 text-lg">chat</span>
                                                <h4 className="font-semibold text-sm">WhatsApp</h4>
                                                <Badge variant="secondary" className="text-[10px]">
                                                    IA pausada en horario activo
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground -mt-2 mb-3">
                                                Durante estas horas, tú atiendes WhatsApp manualmente. Fuera de ellas, la IA responde automáticamente.
                                            </p>

                                            <div className="space-y-2">
                                                {DAY_KEYS.map((day) => {
                                                    const whatsappSchedule = scheduleChannels.whatsapp || {}
                                                    const dayData = whatsappSchedule[day]
                                                    const isActive = dayData !== null && dayData !== undefined

                                                    return (
                                                        <div key={day} className="flex items-center gap-3 py-1.5">
                                                            <Switch
                                                                checked={isActive}
                                                                onCheckedChange={(checked) => {
                                                                    setScheduleChannels(prev => ({
                                                                        ...prev,
                                                                        whatsapp: {
                                                                            ...prev.whatsapp,
                                                                            [day]: checked ? { from: "08:00", to: "18:00" } : null
                                                                        }
                                                                    }))
                                                                }}
                                                            />
                                                            <span className={`text-sm w-24 ${isActive ? "font-medium" : "text-muted-foreground"}`}>
                                                                {DAY_LABELS[day]}
                                                            </span>
                                                            {isActive && dayData ? (
                                                                <div className="flex items-center gap-2">
                                                                    <Input
                                                                        type="time"
                                                                        value={dayData.from}
                                                                        onChange={(e) => {
                                                                            setScheduleChannels(prev => ({
                                                                                ...prev,
                                                                                whatsapp: {
                                                                                    ...prev.whatsapp,
                                                                                    [day]: { ...dayData, from: e.target.value }
                                                                                }
                                                                            }))
                                                                        }}
                                                                        className="w-32 h-8 text-sm"
                                                                    />
                                                                    <span className="text-xs text-muted-foreground">a</span>
                                                                    <Input
                                                                        type="time"
                                                                        value={dayData.to}
                                                                        onChange={(e) => {
                                                                            setScheduleChannels(prev => ({
                                                                                ...prev,
                                                                                whatsapp: {
                                                                                    ...prev.whatsapp,
                                                                                    [day]: { ...dayData, to: e.target.value }
                                                                                }
                                                                            }))
                                                                        }}
                                                                        className="w-32 h-8 text-sm"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground italic">IA responde todo el día</span>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4">
                                            <div className="flex gap-3">
                                                <span className="material-symbols-outlined text-blue-500 text-lg mt-0.5">info</span>
                                                <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                                                    <p className="font-medium">¿Cómo funciona?</p>
                                                    <p>Los días <strong>activos</strong> definen cuándo <strong>tú</strong> atiendes WhatsApp manualmente. Durante esas horas la IA no responderá.</p>
                                                    <p>Fuera de ese horario y los días <strong>inactivos</strong>, la IA responderá automáticamente 24/7.</p>
                                                    <p>El chat web siempre usa IA, independiente del horario.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                )}
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Control por Conversación</CardTitle>
                                    <CardDescription>
                                        Además del horario, puedes pausar/reactivar la IA en cualquier conversación individual desde la vista de Chats.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                                        <span className="material-symbols-outlined text-violet-500">smart_toy</span>
                                        <div className="text-sm">
                                            <p className="font-medium">Botón &quot;IA activa / IA pausada&quot;</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Disponible en el header de cada conversación en Live Chat → permite tomar el control de una conversación específica sin afectar las demás.
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex justify-end">
                                <Button
                                    onClick={async () => {
                                        setScheduleSaving(true)
                                        try {
                                            await updateAgentSchedule(agent.id, {
                                                enabled: scheduleEnabled,
                                                timezone: scheduleTimezone,
                                                channels: scheduleChannels,
                                            })
                                        } catch (err) {
                                            console.error("Error saving schedule:", err)
                                        }
                                        setScheduleSaving(false)
                                    }}
                                    disabled={scheduleSaving}
                                >
                                    {scheduleSaving ? (
                                        <><span className="material-symbols-outlined text-sm animate-spin mr-2">progress_activity</span> Guardando...</>
                                    ) : (
                                        <><span className="material-symbols-outlined text-sm mr-2">save</span> Guardar Horarios</>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Apariencia</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col items-center gap-4">
                                <ImageUploader
                                    organizationId={agent.organization_id}
                                    bucketName="organization-logos" // Using existing bucket
                                    folderPath={`${agent.organization_id}/agents/${agent.id}`}
                                    label=""
                                    currentImageUrl={avatarUrl}
                                    onUploadComplete={(url) => {
                                        setAvatarUrl(url)
                                    }}
                                />
                                <p className="text-xs text-center text-muted-foreground">
                                    Sube una imagen para el avatar de tu agente.
                                    <br />
                                    Recuerda guardar los cambios en la pestaña "General".
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Estado</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Disponibilidad</Label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="available">
                                            <div className="flex items-center gap-2">
                                                <span className="size-2 rounded-full bg-green-500"></span>
                                                <span>Disponible</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="offline">
                                            <div className="flex items-center gap-2">
                                                <span className="size-2 rounded-full bg-slate-400"></span>
                                                <span>Offline</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="busy">
                                            <div className="flex items-center gap-2">
                                                <span className="size-2 rounded-full bg-red-500"></span>
                                                <span>Ocupado</span>
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/50"
                            >
                                <span className="material-symbols-outlined mr-2 text-lg">delete</span>
                                Eliminar Agente
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
