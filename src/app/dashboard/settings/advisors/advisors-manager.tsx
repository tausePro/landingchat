"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createAdvisor, updateAdvisor, deleteAdvisor } from "./actions"
import { toast } from "sonner"
import type { WorkingHours } from "@/lib/advisors/assignment"

interface AdvisorData {
    id: string
    name: string
    specialty: "sales" | "rentals" | "both"
    color: string
    google_calendar_id: string | null
    working_hours: WorkingHours
    is_active: boolean
}

interface GoogleCalendar {
    id: string
    name: string
    color: string
    isPrimary: boolean
}

interface Props {
    initialAdvisors: AdvisorData[]
    googleCalendars: GoogleCalendar[]
}

const SPECIALTY_LABELS: Record<string, string> = {
    sales: "Ventas",
    rentals: "Arriendos",
    both: "Ambos",
}

const DAY_LABELS: Array<{ key: keyof WorkingHours; label: string; short: string }> = [
    { key: "monday", label: "Lunes", short: "Lun" },
    { key: "tuesday", label: "Martes", short: "Mar" },
    { key: "wednesday", label: "Miércoles", short: "Mié" },
    { key: "thursday", label: "Jueves", short: "Jue" },
    { key: "friday", label: "Viernes", short: "Vie" },
    { key: "saturday", label: "Sábado", short: "Sáb" },
]

const DEFAULT_HOURS: WorkingHours = {
    monday: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "18:00" }],
    tuesday: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "18:00" }],
    wednesday: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "18:00" }],
    thursday: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "18:00" }],
    friday: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "17:00" }],
    saturday: [{ start: "09:00", end: "12:00" }, { start: "13:00", end: "18:00" }],
}

export function AdvisorsManager({ initialAdvisors, googleCalendars }: Props) {
    const [advisors, setAdvisors] = useState(initialAdvisors)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    // Form state
    const [formName, setFormName] = useState("")
    const [formSpecialty, setFormSpecialty] = useState<"sales" | "rentals" | "both">("both")
    const [formColor, setFormColor] = useState("#3b82f6")
    const [formCalendarId, setFormCalendarId] = useState("")
    const [formHours, setFormHours] = useState<WorkingHours>(DEFAULT_HOURS)

    const resetForm = () => {
        setFormName("")
        setFormSpecialty("both")
        setFormColor("#3b82f6")
        setFormCalendarId("")
        setFormHours(DEFAULT_HOURS)
        setEditingId(null)
        setShowForm(false)
    }

    const startEdit = (advisor: AdvisorData) => {
        setFormName(advisor.name)
        setFormSpecialty(advisor.specialty)
        setFormColor(advisor.color)
        setFormCalendarId(advisor.google_calendar_id || "")
        setFormHours(advisor.working_hours || DEFAULT_HOURS)
        setEditingId(advisor.id)
        setShowForm(true)
    }

    const handleSelectCalendar = (calId: string) => {
        setFormCalendarId(calId)
        const cal = googleCalendars.find(c => c.id === calId)
        if (cal) {
            if (!formName) setFormName(cal.name)
            setFormColor(cal.color)
        }
    }

    const handleSave = async () => {
        if (!formName.trim()) {
            toast.error("El nombre es requerido")
            return
        }

        const input = {
            name: formName.trim(),
            specialty: formSpecialty,
            color: formColor,
            google_calendar_id: formCalendarId || undefined,
            working_hours: formHours,
        }

        let result
        if (editingId) {
            result = await updateAdvisor(editingId, input)
        } else {
            result = await createAdvisor(input)
        }

        if (result.success) {
            toast.success(editingId ? "Asesor actualizado" : "Asesor creado")
            resetForm()
            startTransition(() => router.refresh())
        } else {
            toast.error(result.error || "Error al guardar")
        }
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar al asesor "${name}"? Las citas asignadas quedarán sin asesor.`)) return

        const result = await deleteAdvisor(id)
        if (result.success) {
            toast.success("Asesor eliminado")
            setAdvisors(prev => prev.filter(a => a.id !== id))
            startTransition(() => router.refresh())
        } else {
            toast.error(result.error || "Error al eliminar")
        }
    }

    const handleToggleActive = async (advisor: AdvisorData) => {
        const result = await updateAdvisor(advisor.id, { is_active: !advisor.is_active })
        if (result.success) {
            toast.success(advisor.is_active ? "Asesor desactivado" : "Asesor activado")
            startTransition(() => router.refresh())
        }
    }

    const updateDayHours = (day: keyof WorkingHours, blocks: Array<{ start: string; end: string }>) => {
        setFormHours(prev => ({ ...prev, [day]: blocks }))
    }

    const toggleDay = (day: keyof WorkingHours) => {
        setFormHours(prev => {
            const current = prev[day]
            if (current && current.length > 0) {
                return { ...prev, [day]: [] }
            } else {
                return { ...prev, [day]: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "18:00" }] }
            }
        })
    }

    return (
        <div className="space-y-6">
            {/* Lista de asesores */}
            {advisors.length > 0 && (
                <div className="space-y-3">
                    {advisors.map((advisor) => (
                        <div
                            key={advisor.id}
                            className={`flex items-center justify-between p-4 bg-white dark:bg-gray-900 border rounded-xl dark:border-gray-800 ${!advisor.is_active ? "opacity-50" : ""}`}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="size-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm"
                                    style={{ backgroundColor: advisor.color }}
                                >
                                    {advisor.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900 dark:text-white">{advisor.name}</p>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                                            {SPECIALTY_LABELS[advisor.specialty]}
                                        </span>
                                        {advisor.google_calendar_id && (
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">event</span>
                                                Google Calendar
                                            </span>
                                        )}
                                        {!advisor.is_active && (
                                            <span className="text-red-500">Inactivo</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleToggleActive(advisor)}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
                                    title={advisor.is_active ? "Desactivar" : "Activar"}
                                >
                                    <span className="material-symbols-outlined text-lg">
                                        {advisor.is_active ? "toggle_on" : "toggle_off"}
                                    </span>
                                </button>
                                <button
                                    onClick={() => startEdit(advisor)}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">edit</span>
                                </button>
                                <button
                                    onClick={() => handleDelete(advisor.id, advisor.name)}
                                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty state */}
            {advisors.length === 0 && !showForm && (
                <div className="text-center py-12 bg-white dark:bg-gray-900 border rounded-xl dark:border-gray-800">
                    <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 mx-auto">
                        <span className="material-symbols-outlined text-3xl text-muted-foreground">group</span>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Sin asesores configurados</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto mb-4">
                        Las citas se agendarán sin asignación de asesor. Agrega asesores para asignarles citas automáticamente.
                    </p>
                </div>
            )}

            {/* Formulario */}
            {showForm && (
                <div className="bg-white dark:bg-gray-900 border rounded-xl dark:border-gray-800 p-6 space-y-5">
                    <h3 className="text-lg font-bold">{editingId ? "Editar Asesor" : "Nuevo Asesor"}</h3>

                    {/* Selector de Google Calendar */}
                    {googleCalendars.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium mb-1.5">Vincular con Google Calendar</label>
                            <select
                                value={formCalendarId}
                                onChange={(e) => handleSelectCalendar(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700"
                            >
                                <option value="">Sin vincular</option>
                                {googleCalendars.filter(c => !c.isPrimary).map((cal) => (
                                    <option key={cal.id} value={cal.id}>
                                        {cal.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-400 mt-1">Las citas del asesor se crearán en su sub-calendario de Google.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1.5">Nombre</label>
                            <input
                                type="text"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="Ej: Valery"
                                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1.5">Especialidad</label>
                            <select
                                value={formSpecialty}
                                onChange={(e) => setFormSpecialty(e.target.value as "sales" | "rentals" | "both")}
                                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700"
                            >
                                <option value="sales">Ventas</option>
                                <option value="rentals">Arriendos</option>
                                <option value="both">Ambos</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1.5">Color</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={formColor}
                                    onChange={(e) => setFormColor(e.target.value)}
                                    className="size-9 rounded border cursor-pointer"
                                />
                                <span className="text-sm text-gray-500">{formColor}</span>
                            </div>
                        </div>
                    </div>

                    {/* Horarios */}
                    <div>
                        <label className="block text-sm font-medium mb-3">Horario de trabajo</label>
                        <div className="space-y-2">
                            {DAY_LABELS.map(({ key, label }) => {
                                const blocks = formHours[key] || []
                                const isActive = blocks.length > 0
                                return (
                                    <div key={key} className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => toggleDay(key)}
                                            className={`w-20 text-xs font-medium py-1.5 rounded-md transition-colors ${
                                                isActive
                                                    ? "bg-primary text-white"
                                                    : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                                            }`}
                                        >
                                            {label}
                                        </button>
                                        {isActive ? (
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {blocks.map((block, idx) => (
                                                    <div key={idx} className="flex items-center gap-1 text-sm">
                                                        <input
                                                            type="time"
                                                            value={block.start}
                                                            onChange={(e) => {
                                                                const newBlocks = [...blocks]
                                                                newBlocks[idx] = { ...newBlocks[idx], start: e.target.value }
                                                                updateDayHours(key, newBlocks)
                                                            }}
                                                            className="border rounded px-2 py-1 text-xs dark:bg-gray-800 dark:border-gray-700"
                                                        />
                                                        <span className="text-gray-400">-</span>
                                                        <input
                                                            type="time"
                                                            value={block.end}
                                                            onChange={(e) => {
                                                                const newBlocks = [...blocks]
                                                                newBlocks[idx] = { ...newBlocks[idx], end: e.target.value }
                                                                updateDayHours(key, newBlocks)
                                                            }}
                                                            className="border rounded px-2 py-1 text-xs dark:bg-gray-800 dark:border-gray-700"
                                                        />
                                                        {blocks.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => updateDayHours(key, blocks.filter((_, i) => i !== idx))}
                                                                className="text-gray-300 hover:text-red-500 transition-colors"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">close</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={() => updateDayHours(key, [...blocks, { start: "14:00", end: "18:00" }])}
                                                    className="text-xs text-primary hover:underline"
                                                >
                                                    + bloque
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400">No trabaja</span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Botones */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={isPending}
                            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:brightness-90 disabled:opacity-50 transition-all"
                        >
                            {isPending ? "Guardando..." : editingId ? "Guardar cambios" : "Crear asesor"}
                        </button>
                        <button
                            onClick={resetForm}
                            className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Botón agregar */}
            {!showForm && (
                <button
                    onClick={() => setShowForm(true)}
                    className="w-full py-3 border-2 border-dashed rounded-xl text-sm font-medium text-gray-500 hover:text-primary hover:border-primary transition-colors flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-lg">person_add</span>
                    Agregar asesor
                </button>
            )}

            {/* Info */}
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>¿Cómo funciona?</strong> Cuando un cliente agenda una cita (desde el chat AI o el sitio web),
                    el sistema asigna automáticamente al asesor disponible según su especialidad (ventas/arriendos) y horario.
                    Si tienes Google Calendar conectado y vinculado, la cita aparecerá en el sub-calendario del asesor.
                </p>
            </div>
        </div>
    )
}
