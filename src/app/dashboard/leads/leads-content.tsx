"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { Lead, LeadStats } from "./actions"
import Link from "next/link"

interface LeadsContentProps {
    leads: Lead[]
    stats: LeadStats
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgClass: string }> = {
    new: { label: "Nuevo", color: "#f59e0b", bgClass: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    contacted: { label: "Contactado", color: "#3b82f6", bgClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    visit_scheduled: { label: "Visita agendada", color: "#8b5cf6", bgClass: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
    visited: { label: "Visitó", color: "#06b6d4", bgClass: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400" },
    negotiating: { label: "Negociando", color: "#f97316", bgClass: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
    closed: { label: "Cerrado", color: "#10b981", bgClass: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    lost: { label: "Perdido", color: "#ef4444", bgClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
}

const SOURCE_LABELS: Record<string, string> = {
    appointment: "Cita",
    chat: "Chat",
    storefront: "Web",
}

export function LeadsContent({ leads, stats }: LeadsContentProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [search, setSearch] = useState(searchParams.get("search") || "")
    const currentStatus = searchParams.get("status") || "all"

    const handleSearch = (value: string) => {
        setSearch(value)
        const params = new URLSearchParams(searchParams.toString())
        if (value) {
            params.set("search", value)
        } else {
            params.delete("search")
        }
        router.push(`/dashboard/leads?${params.toString()}`)
    }

    const handleStatusFilter = (status: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (status === "all") {
            params.delete("status")
        } else {
            params.set("status", status)
        }
        router.push(`/dashboard/leads?${params.toString()}`)
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Leads</h1>
                    <p className="text-muted-foreground">
                        Oportunidades de negocio desde citas y conversaciones ({stats.total})
                    </p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                {[
                    { key: "all", label: "Total", value: stats.total, color: "#64748b" },
                    { key: "new", label: "Nuevos", value: stats.new, color: STATUS_CONFIG.new.color },
                    { key: "visit_scheduled", label: "Con cita", value: stats.visitScheduled, color: STATUS_CONFIG.visit_scheduled.color },
                    { key: "visited", label: "Visitaron", value: stats.visited, color: STATUS_CONFIG.visited.color },
                    { key: "negotiating", label: "Negociando", value: stats.negotiating, color: STATUS_CONFIG.negotiating.color },
                    { key: "closed", label: "Cerrados", value: stats.closed, color: STATUS_CONFIG.closed.color },
                ].map((kpi) => (
                    <button
                        key={kpi.key}
                        onClick={() => handleStatusFilter(kpi.key)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                            currentStatus === kpi.key
                                ? "ring-2 ring-primary border-primary bg-primary/5"
                                : "bg-white dark:bg-gray-900 dark:border-gray-800 hover:border-gray-300"
                        }`}
                    >
                        <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                        <p className="text-xs text-gray-500 font-medium">{kpi.label}</p>
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="mb-4">
                <div className="relative max-w-md">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nombre, teléfono o email..."
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm dark:bg-gray-900 dark:border-gray-800"
                    />
                </div>
            </div>

            {/* Tabla de leads */}
            {leads.length > 0 ? (
                <div className="border rounded-xl overflow-hidden dark:border-gray-800 bg-white dark:bg-gray-900">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800/50">
                            <tr>
                                <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">Lead</th>
                                <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">Contacto</th>
                                <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">Propiedades</th>
                                <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">Estado</th>
                                <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">Asesor</th>
                                <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">Actividad</th>
                                <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-gray-800">
                            {leads.map((lead) => (
                                <tr
                                    key={lead.id}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer"
                                    onClick={() => lead.phone && router.push(`/dashboard/leads/${encodeURIComponent(lead.phone)}`)}
                                >
                                    <td className="p-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                                                {lead.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-900 dark:text-white truncate">{lead.name}</p>
                                                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                    <span className="material-symbols-outlined text-[11px]">
                                                        {lead.source === "appointment" ? "calendar_month" : "chat"}
                                                    </span>
                                                    {SOURCE_LABELS[lead.source] || lead.source}
                                                    {lead.appointmentCount > 0 && (
                                                        <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                                            {lead.appointmentCount} cita{lead.appointmentCount > 1 ? "s" : ""}
                                                        </span>
                                                    )}
                                                    {lead.chatCount > 0 && (
                                                        <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                                            {lead.chatCount} chat{lead.chatCount > 1 ? "s" : ""}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        {lead.phone && (
                                            <p className="text-sm text-gray-700 dark:text-gray-300">{lead.phone}</p>
                                        )}
                                        {lead.email && (
                                            <p className="text-xs text-gray-400 truncate max-w-[160px]">{lead.email}</p>
                                        )}
                                        {!lead.phone && !lead.email && (
                                            <p className="text-xs text-gray-400">Sin datos</p>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        {lead.properties.length > 0 ? (
                                            <div className="space-y-1">
                                                {lead.properties.slice(0, 2).map((prop) => (
                                                    <p key={prop.code} className="text-xs">
                                                        <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[10px]">{prop.code}</span>
                                                        <span className="text-gray-500 ml-1 truncate">{prop.title.substring(0, 30)}</span>
                                                    </p>
                                                ))}
                                                {lead.properties.length > 2 && (
                                                    <p className="text-[10px] text-gray-400">+{lead.properties.length - 2} más</p>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400">—</span>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_CONFIG[lead.status]?.bgClass || "bg-gray-100 text-gray-800"}`}>
                                            {STATUS_CONFIG[lead.status]?.label || lead.status}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        {lead.advisorName ? (
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className="size-2.5 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: lead.advisorColor || "#94a3b8" }}
                                                />
                                                <span className="text-sm text-gray-700 dark:text-gray-300">{lead.advisorName}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400">Sin asignar</span>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        <p className="text-xs text-gray-500" suppressHydrationWarning>{lead.lastActivityLabel}</p>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-1">
                                            {lead.customerId && (
                                                <Link
                                                    href={`/dashboard/chats/console?customer=${lead.customerId}`}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-sm">chat</span>
                                                    Chats
                                                </Link>
                                            )}
                                            <Link
                                                href="/dashboard/appointments"
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-sm">calendar_month</span>
                                                Citas
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-16 bg-white dark:bg-gray-900 border rounded-xl dark:border-gray-800">
                    <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 mx-auto">
                        <span className="material-symbols-outlined text-3xl text-muted-foreground">person_search</span>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Sin leads aún</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto">
                        Los leads aparecen cuando un cliente agenda una cita o chatea sobre una propiedad a través del agente AI o el sitio web.
                    </p>
                </div>
            )}
        </div>
    )
}
