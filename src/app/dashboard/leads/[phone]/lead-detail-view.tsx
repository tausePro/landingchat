"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateLead, assignAdvisorToLead } from "./actions"
import type { LeadDetail, AdvisorOption } from "./actions"
import { toast } from "sonner"
import Link from "next/link"
import Image from "next/image"
import {
    formatBogotaDateLong,
    formatBogotaDayKey,
    formatBogotaMonthShort,
    formatBogotaTime,
} from "@/lib/utils/date"
import { formatCurrency as formatTenantCurrency } from "@/lib/utils"
import { type TenantLocaleContext, DEFAULT_TENANT_LOCALE } from "@/lib/i18n/tenant-locale"

const STATUS_OPTIONS: Array<{ value: string; label: string; color: string }> = [
    { value: "new", label: "Nuevo", color: "#f59e0b" },
    { value: "contacted", label: "Contactado", color: "#3b82f6" },
    { value: "visit_scheduled", label: "Visita agendada", color: "#8b5cf6" },
    { value: "visited", label: "Visitó", color: "#06b6d4" },
    { value: "negotiating", label: "Negociando", color: "#f97316" },
    { value: "closed", label: "Cerrado", color: "#10b981" },
    { value: "lost", label: "Perdido", color: "#ef4444" },
]

const APT_STATUS_LABELS: Record<string, { label: string; class: string }> = {
    pending: { label: "Pendiente", class: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    confirmed: { label: "Confirmada", class: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    completed: { label: "Completada", class: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    cancelled: { label: "Cancelada", class: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
    rescheduled: { label: "Reagendada", class: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
}

const CHANNEL_LABELS: Record<string, string> = {
    web: "Chat Web",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    messenger: "Messenger",
}

interface Props {
    lead: LeadDetail
    advisors: AdvisorOption[]
    tenantLocale?: TenantLocaleContext
}

export function LeadDetailView({ lead, advisors, tenantLocale = DEFAULT_TENANT_LOCALE }: Props) {
    const formatPrice = (price: number) =>
        formatTenantCurrency(price, { currency: tenantLocale.currency, locale: tenantLocale.locale })
    const [status, setStatus] = useState(lead.status)
    const [notes, setNotes] = useState(lead.notes || "")
    const [savingStatus, setSavingStatus] = useState(false)
    const [savingNotes, setSavingNotes] = useState(false)
    const [savingAdvisor, setSavingAdvisor] = useState(false)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const currentStatusConfig = STATUS_OPTIONS.find(s => s.value === status)

    const handleStatusChange = async (newStatus: string) => {
        setSavingStatus(true)
        setStatus(newStatus)
        try {
            const result = await updateLead(lead.phone, { status: newStatus })
            if (result.success) {
                toast.success(`Estado actualizado a "${STATUS_OPTIONS.find(s => s.value === newStatus)?.label}"`)
                startTransition(() => router.refresh())
            } else {
                toast.error(result.error || "Error al actualizar")
            }
        } catch {
            toast.error("Error inesperado")
        } finally {
            setSavingStatus(false)
        }
    }

    const handleSaveNotes = async () => {
        setSavingNotes(true)
        try {
            const result = await updateLead(lead.phone, { notes })
            if (result.success) {
                toast.success("Notas guardadas")
            } else {
                toast.error(result.error || "Error al guardar")
            }
        } catch {
            toast.error("Error inesperado")
        } finally {
            setSavingNotes(false)
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ═══ Columna izquierda: Timeline ═══ */}
            <div className="lg:col-span-2 space-y-6">
                {/* Header del lead */}
                <div className="flex items-center gap-4">
                    <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold flex-shrink-0">
                        {lead.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{lead.name}</h1>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                            {lead.phone && (
                                <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">call</span>
                                    {lead.phone}
                                </span>
                            )}
                            {lead.email && (
                                <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">mail</span>
                                    {lead.email}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Acciones rápidas */}
                <div className="flex gap-2 flex-wrap">
                    {lead.phone && (
                        <>
                            <a
                                href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 transition-colors"
                            >
                                <span className="material-symbols-outlined text-base">chat</span>
                                WhatsApp
                            </a>
                            <a
                                href={`tel:${lead.phone}`}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 transition-colors"
                            >
                                <span className="material-symbols-outlined text-base">call</span>
                                Llamar
                            </a>
                        </>
                    )}
                    <Link
                        href="/dashboard/appointments"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 transition-colors"
                    >
                        <span className="material-symbols-outlined text-base">calendar_month</span>
                        Ver Citas
                    </Link>
                    {lead.customerId && (
                        <Link
                            href={`/dashboard/chats/console?customer=${lead.customerId}`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 transition-colors"
                        >
                            <span className="material-symbols-outlined text-base">forum</span>
                            Ver Chats
                        </Link>
                    )}
                </div>

                {/* Timeline de citas */}
                <div>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-xl text-gray-400">calendar_month</span>
                        Citas ({lead.appointments.length})
                    </h2>

                    {lead.appointments.length > 0 ? (
                        <div className="space-y-3">
                            {lead.appointments.map((apt) => {
                                const aptDate = new Date(apt.proposedDate)
                                const statusCfg = APT_STATUS_LABELS[apt.status] || { label: apt.status, class: "bg-gray-100 text-gray-800" }
                                return (
                                    <div key={apt.id} className="flex gap-4 p-4 bg-white dark:bg-gray-900 border rounded-xl dark:border-gray-800">
                                        <div className="flex-shrink-0 text-center w-14">
                                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{aptDate.getDate()}</p>
                                            <p className="text-xs text-gray-500 uppercase">{formatBogotaMonthShort(aptDate)}</p>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white">{apt.title}</p>
                                                    <p className="text-sm text-gray-500">
                                                        {formatBogotaTime(aptDate)}
                                                        {apt.location && ` · ${apt.location}`}
                                                    </p>
                                                </div>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium flex-shrink-0 ${statusCfg.class}`}>
                                                    {statusCfg.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                                {apt.propertyCode && (
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-xs">home</span>
                                                        {apt.propertyCode} — {apt.propertyTitle}
                                                    </span>
                                                )}
                                                {apt.advisorName && (
                                                    <span className="flex items-center gap-1">
                                                        <span className="size-2 rounded-full" style={{ backgroundColor: apt.advisorColor || "#94a3b8" }} />
                                                        {apt.advisorName}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 py-4">Sin citas registradas.</p>
                    )}
                </div>

                {/* Timeline de chats */}
                {lead.chats.length > 0 && (
                    <div>
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-xl text-gray-400">forum</span>
                            Conversaciones ({lead.chats.length})
                        </h2>
                        <div className="space-y-2">
                            {lead.chats.map((chat) => (
                                <Link
                                    key={chat.id}
                                    href={`/dashboard/chats/console?chat=${chat.id}`}
                                    className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 border rounded-lg dark:border-gray-800 hover:border-primary/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-base text-gray-400">
                                            {chat.channel === "whatsapp" ? "smartphone" : chat.channel === "instagram" ? "photo_camera" : "chat"}
                                        </span>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            {CHANNEL_LABELS[chat.channel] || chat.channel}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {chat.messageCount} mensajes
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-400" suppressHydrationWarning>
                                        {formatBogotaDayKey(chat.updatedAt)}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ Columna derecha: Panel de gestión ═══ */}
            <div className="lg:col-span-1 space-y-5">
                {/* Estado */}
                <div className="bg-white dark:bg-gray-900 border rounded-xl dark:border-gray-800 p-5">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">Estado del Lead</h3>
                    <div className="space-y-1.5">
                        {STATUS_OPTIONS.map((opt) => {
                            const isActive = status === opt.value
                            return (
                                <button
                                    key={opt.value}
                                    onClick={() => handleStatusChange(opt.value)}
                                    disabled={savingStatus || isPending}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-all ${
                                        isActive
                                            ? "font-semibold ring-1"
                                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                    }`}
                                    style={isActive ? {
                                        backgroundColor: `${opt.color}15`,
                                        color: opt.color,
                                        outlineColor: `${opt.color}40`,
                                        outlineWidth: "1px",
                                        outlineStyle: "solid",
                                    } : {}}
                                >
                                    <span
                                        className="size-3 rounded-full flex-shrink-0 border-2"
                                        style={{
                                            backgroundColor: isActive ? opt.color : "transparent",
                                            borderColor: opt.color,
                                        }}
                                    />
                                    {opt.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Asesor */}
                <div className="bg-white dark:bg-gray-900 border rounded-xl dark:border-gray-800 p-5">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">Asesor Asignado</h3>
                    {advisors.length > 0 ? (
                        <div className="space-y-2">
                            {advisors.map((adv) => {
                                const isSelected = lead.advisorName === adv.name
                                return (
                                    <button
                                        key={adv.id}
                                        onClick={async () => {
                                            setSavingAdvisor(true)
                                            try {
                                                const result = await assignAdvisorToLead(lead.phone, isSelected ? null : adv.id)
                                                if (result.success) {
                                                    toast.success(isSelected ? "Asesor desasignado" : `Asignado a ${adv.name}`)
                                                    startTransition(() => router.refresh())
                                                } else {
                                                    toast.error(result.error || "Error")
                                                }
                                            } catch {
                                                toast.error("Error inesperado")
                                            } finally {
                                                setSavingAdvisor(false)
                                            }
                                        }}
                                        disabled={savingAdvisor || isPending}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-all disabled:opacity-50 ${
                                            isSelected
                                                ? "ring-1 font-semibold"
                                                : "hover:bg-gray-50 dark:hover:bg-gray-800"
                                        }`}
                                        style={isSelected ? {
                                            backgroundColor: `${adv.color}15`,
                                            outlineColor: `${adv.color}40`,
                                            outlineWidth: "1px",
                                            outlineStyle: "solid",
                                        } : {}}
                                    >
                                        <div
                                            className="size-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                            style={{ backgroundColor: adv.color }}
                                        >
                                            {adv.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-gray-900 dark:text-white">{adv.name}</p>
                                            <p className="text-[10px] text-gray-400">
                                                {adv.specialty === "sales" ? "Ventas" : adv.specialty === "rentals" ? "Arriendos" : "Ambos"}
                                            </p>
                                        </div>
                                        {isSelected && (
                                            <span className="material-symbols-outlined text-base ml-auto" style={{ color: adv.color }}>check_circle</span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    ) : lead.advisorName ? (
                        <div className="flex items-center gap-3">
                            <div
                                className="size-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                                style={{ backgroundColor: lead.advisorColor || "#94a3b8" }}
                            >
                                {lead.advisorName.charAt(0)}
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">{lead.advisorName}</span>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400">
                            Sin asesores configurados.
                            <Link href="/dashboard/settings/advisors" className="text-primary hover:underline ml-1">Configurar</Link>
                        </p>
                    )}
                </div>

                {/* Propiedades de interés */}
                {lead.properties.length > 0 && (
                    <div className="bg-white dark:bg-gray-900 border rounded-xl dark:border-gray-800 p-5">
                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                            Propiedades de Interés ({lead.properties.length})
                        </h3>
                        <div className="space-y-3">
                            {lead.properties.map((prop) => (
                                <div key={prop.code} className="flex gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                    <div className="size-14 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0 relative">
                                        {prop.imageUrl ? (
                                            <Image src={prop.imageUrl} alt={prop.title} fill className="object-cover" unoptimized />
                                        ) : (
                                            <div className="flex items-center justify-center h-full">
                                                <span className="material-symbols-outlined text-gray-300">home</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{prop.title}</p>
                                        <p className="text-xs text-gray-500">
                                            <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">{prop.code}</span>
                                            {prop.city && ` · ${prop.city}`}
                                        </p>
                                        {(prop.priceRent || prop.priceSale) && (
                                            <p className="text-xs font-semibold text-primary mt-0.5">
                                                {prop.priceRent ? `${formatPrice(prop.priceRent)}/mes` : formatPrice(prop.priceSale!)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Notas */}
                <div className="bg-white dark:bg-gray-900 border rounded-xl dark:border-gray-800 p-5">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">Notas</h3>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Agrega notas sobre este lead..."
                        rows={4}
                        className="w-full border rounded-lg px-3 py-2 text-sm resize-none dark:bg-gray-800 dark:border-gray-700"
                    />
                    <button
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                        className="mt-2 w-full px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:brightness-90 disabled:opacity-50 transition-all"
                    >
                        {savingNotes ? "Guardando..." : "Guardar notas"}
                    </button>
                </div>

                {/* Info adicional */}
                <div className="bg-white dark:bg-gray-900 border rounded-xl dark:border-gray-800 p-5 text-xs text-gray-400 space-y-1">
                    {lead.createdAt && (
                        <p suppressHydrationWarning>Primer contacto: {formatBogotaDateLong(lead.createdAt)}</p>
                    )}
                    <p>{lead.appointments.length} cita{lead.appointments.length !== 1 ? "s" : ""} · {lead.chats.length} conversaci{lead.chats.length !== 1 ? "ones" : "ón"}</p>
                </div>
            </div>
        </div>
    )
}
