"use client"

import { useState, useEffect } from "react"
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
import { updateAgentGeneral, updateAgentPersonality, updateAgentKnowledge } from "./actions"
import { ImageUploader } from "@/components/shared/image-uploader"

interface AgentConfigProps {
    agent: any
}

export function AgentConfig({ agent }: AgentConfigProps) {
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

    const tabs = [
        { id: "general", label: "General", icon: "settings" },
        { id: "personality", label: "Personalidad", icon: "psychology" },
        { id: "knowledge", label: "Conocimiento", icon: "menu_book" },
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
                                        <Label>Documentos Adicionales</Label>
                                        <Button variant="outline" size="sm">
                                            <span className="material-symbols-outlined mr-2 text-sm">upload_file</span>
                                            Subir PDF
                                        </Button>
                                    </div>
                                    <div className="p-8 border-2 border-dashed border-border-light dark:border-border-dark rounded-xl flex flex-col items-center justify-center text-center text-muted-foreground bg-slate-50 dark:bg-slate-900/20">
                                        <span className="material-symbols-outlined text-4xl mb-2 opacity-50">description</span>
                                        <p className="font-medium">No hay documentos subidos</p>
                                        <p className="text-xs">Sube manuales, políticas de garantía o guías de talla</p>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4">
                                    <Button onClick={handleSaveKnowledge} disabled={loading}>
                                        {loading ? "Guardando..." : "Guardar Cambios"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === "schedule" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Horario de Atención</CardTitle>
                                <CardDescription>Define cuándo el agente responderá automáticamente</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                        <span className="material-symbols-outlined text-3xl text-muted-foreground">calendar_clock</span>
                                    </div>
                                    <h3 className="text-lg font-semibold mb-2">Próximamente</h3>
                                    <p className="text-muted-foreground max-w-sm">
                                        Estamos trabajando en un sistema avanzado de horarios y turnos para tus agentes.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
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
