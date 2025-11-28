"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { AgentData, AgentTemplateData, createAgentFromTemplate, deleteAgent } from "../actions"

interface AgentListProps {
    agents: AgentData[]
    templates: AgentTemplateData[]
}

export function AgentList({ agents, templates }: AgentListProps) {
    const router = useRouter()
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplateData | null>(null)
    const [agentName, setAgentName] = useState("")
    const [loading, setLoading] = useState(false)

    const handleCreate = async () => {
        if (!selectedTemplate) return
        setLoading(true)
        try {
            const result = await createAgentFromTemplate(selectedTemplate.id, agentName)
            console.log("Agent created:", result)
            setIsDialogOpen(false)
            setAgentName("")
            setSelectedTemplate(null)
            router.refresh()
        } catch (error: any) {
            console.error("Error creating agent:", error)
            alert(`Error al crear el agente: ${error.message || error}`)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (confirm("¿Estás seguro de eliminar este agente?")) {
            try {
                await deleteAgent(id)
                router.refresh()
            } catch (error) {
                alert("Error al eliminar el agente")
            }
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Mis Agentes</h2>
                    <p className="text-muted-foreground">
                        Gestiona tus asistentes de IA.
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <span className="material-symbols-outlined mr-2">add_circle</span>
                            Nuevo Agente
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Selecciona un Agente</DialogTitle>
                            <DialogDescription>
                                Elige una plantilla del marketplace para comenzar.
                            </DialogDescription>
                        </DialogHeader>

                        {!selectedTemplate ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                {templates.map((template) => (
                                    <Card
                                        key={template.id}
                                        className="cursor-pointer hover:border-indigo-500 transition-all hover:shadow-md"
                                        onClick={() => setSelectedTemplate(template)}
                                    >
                                        <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                                            <div className="text-3xl">{template.icon}</div>
                                            <div className="flex-1">
                                                <CardTitle className="text-base">{template.name}</CardTitle>
                                                <CardDescription className="line-clamp-2 mt-1">
                                                    {template.description}
                                                </CardDescription>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex justify-between items-center text-sm">
                                                <Badge variant="secondary">{template.agent_template.role}</Badge>
                                                <span className="font-bold text-green-600">
                                                    ${template.base_price}
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-6 mt-4">
                                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                                    <div className="text-4xl">{selectedTemplate.icon}</div>
                                    <div>
                                        <h3 className="font-bold">{selectedTemplate.name}</h3>
                                        <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
                                    </div>
                                    <Button variant="ghost" className="ml-auto" onClick={() => setSelectedTemplate(null)}>
                                        Cambiar
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    <Label>Nombre de tu Agente</Label>
                                    <Input
                                        placeholder={`Ej: ${selectedTemplate.name} - Ventas`}
                                        value={agentName}
                                        onChange={(e) => setAgentName(e.target.value)}
                                    />
                                </div>

                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                                        Atrás
                                    </Button>
                                    <Button onClick={handleCreate} disabled={loading || !agentName.trim()}>
                                        {loading ? "Creando..." : "Crear Agente"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map((agent) => (
                    <Card key={agent.id} className="flex flex-col">
                        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xl overflow-hidden">
                                    {agent.avatar_url && agent.avatar_url.startsWith('http') ? (
                                        <img src={agent.avatar_url} alt={agent.name} className="w-full h-full object-cover" />
                                    ) : (
                                        agent.avatar_url || '🤖'
                                    )}
                                </div>
                                <div>
                                    <CardTitle className="text-base">{agent.name}</CardTitle>
                                    <p className="text-xs text-muted-foreground capitalize">{agent.role}</p>
                                </div>
                            </div>
                            <Badge variant={agent.status === 'available' ? 'default' : 'secondary'}>
                                {agent.status === 'available' ? 'Disponible' : 'Offline'}
                            </Badge>
                        </CardHeader>
                        <CardContent className="flex-1 pt-4">
                            <div className="text-sm text-muted-foreground">
                                <p>Tipo: <span className="capitalize text-foreground">{agent.type}</span></p>
                                <p suppressHydrationWarning>Creado: {new Date(agent.created_at).toLocaleDateString('es-ES')}</p>
                            </div>
                        </CardContent>
                        <CardFooter className="border-t pt-4 flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(agent.id)}>
                                <span className="material-symbols-outlined text-red-500">delete</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/dashboard/agents/${agent.id}/config`)}
                            >
                                <span className="material-symbols-outlined mr-2 text-sm">settings</span>
                                Configurar
                            </Button>
                        </CardFooter>
                    </Card>
                ))}

                {agents.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg bg-slate-50 dark:bg-slate-900/50">
                        <div className="size-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-3xl text-indigo-600 dark:text-indigo-400">smart_toy</span>
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No tienes agentes activos</h3>
                        <p className="text-muted-foreground text-center max-w-sm mb-6">
                            Los agentes pueden atender chats automáticamente 24/7. Crea uno nuevo para empezar.
                        </p>
                        <Button onClick={() => setIsDialogOpen(true)}>
                            Crear mi primer Agente
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
