"use client"

import { useEffect, useState } from "react"
import { MessageSquare, Search, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { WhatsAppInstance } from "@/types"
import { getAllInstances, disconnectInstance } from "./actions"

export default function WhatsAppInstancesPage() {
    const [loading, setLoading] = useState(true)
    const [instances, setInstances] = useState<WhatsAppInstance[]>([])
    const [filteredInstances, setFilteredInstances] = useState<WhatsAppInstance[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")

    useEffect(() => {
        fetchInstances()
    }, [])

    useEffect(() => {
        filterInstances()
    }, [instances, searchQuery, statusFilter])

    const fetchInstances = async () => {
        console.log("[WhatsAppInstancesPage] Fetching instances...")
        const result = await getAllInstances()
        console.log("[WhatsAppInstancesPage] Result:", result)
        
        if (result.success) {
            console.log("[WhatsAppInstancesPage] Setting instances:", result.data.length, "items")
            console.log("[WhatsAppInstancesPage] Instance data:", JSON.stringify(result.data, null, 2))
            setInstances(result.data)
        } else {
            console.error("[WhatsAppInstancesPage] Error:", result.error)
            toast.error("Error al cargar instancias", { description: result.error })
        }
        setLoading(false)
    }

    const filterInstances = () => {
        let filtered = instances
        console.log("[WhatsAppInstancesPage] Filtering", instances.length, "instances")

        if (statusFilter !== "all") {
            filtered = filtered.filter((i) => i.status === statusFilter)
        }

        if (searchQuery) {
            filtered = filtered.filter(
                (i) =>
                    i.instance_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    i.phone_number_display?.includes(searchQuery)
            )
        }

        console.log("[WhatsAppInstancesPage] Filtered to", filtered.length, "instances")
        setFilteredInstances(filtered)
    }

    const handleDisconnect = async (instanceId: string) => {
        if (!confirm("¿Estás seguro de desconectar esta instancia?")) return

        const result = await disconnectInstance(instanceId)
        if (result.success) {
            toast.success("Instancia desconectada")
            fetchInstances()
        } else {
            toast.error("Error", { description: result.error })
        }
    }

    const getStatusBadge = (status: string) => {
        const variants: Record<string, "default" | "secondary" | "destructive"> = {
            connected: "default",
            connecting: "secondary",
            disconnected: "secondary",
            banned: "destructive",
        }

        const labels: Record<string, string> = {
            connected: "Conectado",
            connecting: "Conectando",
            disconnected: "Desconectado",
            banned: "Bloqueado",
        }

        return (
            <Badge variant={variants[status] || "secondary"}>
                {labels[status] || status}
            </Badge>
        )
    }

    if (loading) {
        return (
            <div className="space-y-4 p-6">
                <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
            </div>
        )
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 p-2.5">
                        <MessageSquare className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Instancias WhatsApp</h1>
                        <p className="text-slate-500">
                            Gestión de todas las conexiones WhatsApp
                        </p>
                    </div>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                        placeholder="Buscar por nombre o teléfono..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48">
                        <Filter className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="connected">Conectados</SelectItem>
                        <SelectItem value="disconnected">Desconectados</SelectItem>
                        <SelectItem value="banned">Bloqueados</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Lista de instancias */}
            <div className="rounded-xl border bg-white shadow-sm dark:bg-slate-900">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b bg-slate-50 dark:bg-slate-800">
                            <tr>
                                <th className="px-6 py-3 text-left text-sm font-medium text-slate-500">
                                    Organización
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-medium text-slate-500">
                                    Instancia
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-medium text-slate-500">
                                    Tipo
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-medium text-slate-500">
                                    Teléfono
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-medium text-slate-500">
                                    Estado
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-medium text-slate-500">
                                    Conversaciones
                                </th>
                                <th className="px-6 py-3 text-right text-sm font-medium text-slate-500">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredInstances.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <p className="text-slate-500">
                                            No hay instancias que mostrar
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredInstances.map((instance) => (
                                    <tr key={instance.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 text-sm">
                                            {/* @ts-ignore - organizations viene del join */}
                                            {instance.organizations?.name || "N/A"}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-mono">
                                            {instance.instance_name}
                                        </td>
                                        <td className="px-6 py-4 text-sm capitalize">
                                            {instance.instance_type === "corporate"
                                                ? "Corporativo"
                                                : "Personal"}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            {instance.phone_number_display || "-"}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(instance.status)}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            {instance.conversations_this_month}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {instance.status === "connected" && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        handleDisconnect(instance.id)
                                                    }
                                                >
                                                    Desconectar
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Estadísticas */}
            <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border bg-white p-4 dark:bg-slate-900">
                    <p className="text-sm text-slate-500">Total Instancias</p>
                    <p className="text-2xl font-bold">{instances.length}</p>
                </div>
                <div className="rounded-lg border bg-white p-4 dark:bg-slate-900">
                    <p className="text-sm text-slate-500">Conectadas</p>
                    <p className="text-2xl font-bold text-green-600">
                        {instances.filter((i) => i.status === "connected").length}
                    </p>
                </div>
                <div className="rounded-lg border bg-white p-4 dark:bg-slate-900">
                    <p className="text-sm text-slate-500">Desconectadas</p>
                    <p className="text-2xl font-bold text-slate-400">
                        {instances.filter((i) => i.status === "disconnected").length}
                    </p>
                </div>
                <div className="rounded-lg border bg-white p-4 dark:bg-slate-900">
                    <p className="text-sm text-slate-500">Bloqueadas</p>
                    <p className="text-2xl font-bold text-red-600">
                        {instances.filter((i) => i.status === "banned").length}
                    </p>
                </div>
            </div>
        </div>
    )
}
