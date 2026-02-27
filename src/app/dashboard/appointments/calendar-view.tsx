"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { getCalendarEvents, confirmAppointment, cancelAppointment, completeAppointment } from "./actions"
import type { CalendarEvent } from "./actions"
import { toast } from "sonner"

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8) // 8am - 6pm
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 border-yellow-300 text-yellow-900 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-200",
    confirmed: "bg-green-100 border-green-300 text-green-900 dark:bg-green-900/30 dark:border-green-700 dark:text-green-200",
    cancelled: "bg-red-100 border-red-300 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300",
    completed: "bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-200",
    rescheduled: "bg-purple-100 border-purple-300 text-purple-900 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-200",
}

const statusLabels: Record<string, string> = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    cancelled: "Cancelada",
    completed: "Completada",
    rescheduled: "Reagendada",
}

const typeIcons: Record<string, string> = {
    visit: "location_on",
    consultation: "chat",
    call: "call",
    meeting: "groups",
}

function getMonday(d: Date): Date {
    const date = new Date(d)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    date.setDate(diff)
    date.setHours(0, 0, 0, 0)
    return date
}

function formatWeekRange(monday: Date): string {
    const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000)
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }
    return `${monday.toLocaleDateString("es-CO", opts)} — ${sunday.toLocaleDateString("es-CO", { ...opts, year: "numeric" })}`
}

export function CalendarView() {
    const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()))
    const [events, setEvents] = useState<CalendarEvent[]>([])
    const [gcalConnected, setGcalConnected] = useState(false)
    const [loading, setLoading] = useState(true)
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
    const [isPending, startTransition] = useTransition()
    const [actioningId, setActioningId] = useState<string | null>(null)
    const router = useRouter()

    const fetchEvents = async (monday: Date) => {
        setLoading(true)
        try {
            const result = await getCalendarEvents(monday.toISOString())
            setEvents(result.events)
            setGcalConnected(result.gcalConnected)
        } catch (error) {
            console.error("Error fetching calendar events:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchEvents(currentMonday)
    }, [currentMonday])

    const goToPrev = () => {
        setCurrentMonday(prev => new Date(prev.getTime() - 7 * 24 * 60 * 60 * 1000))
    }
    const goToNext = () => {
        setCurrentMonday(prev => new Date(prev.getTime() + 7 * 24 * 60 * 60 * 1000))
    }
    const goToToday = () => {
        setCurrentMonday(getMonday(new Date()))
    }

    const handleAction = async (id: string, action: "confirm" | "cancel" | "complete") => {
        setActioningId(id)
        const actions = { confirm: confirmAppointment, cancel: cancelAppointment, complete: completeAppointment }
        const labels = { confirm: "confirmada", cancel: "cancelada", complete: "completada" }
        try {
            const result = await actions[action](id)
            if (result.success) {
                toast.success(`Cita ${labels[action]}`)
                setSelectedEvent(null)
                startTransition(() => {
                    fetchEvents(currentMonday)
                    router.refresh()
                })
            } else {
                toast.error(result.error || "Error al actualizar")
            }
        } catch {
            toast.error("Error inesperado")
        } finally {
            setActioningId(null)
        }
    }

    // Generar días de la semana (Lun-Sáb)
    const weekDays = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(currentMonday.getTime() + i * 24 * 60 * 60 * 1000)
        return {
            date: d,
            dayName: DAY_NAMES[i],
            dayNum: d.getDate(),
            isToday: d.toDateString() === new Date().toDateString(),
            dateStr: d.toISOString().split("T")[0],
        }
    })

    // Posicionar eventos en el grid
    const getEventPosition = (event: CalendarEvent) => {
        const start = new Date(event.start)
        const end = new Date(event.end)
        const startHour = start.getHours() + start.getMinutes() / 60
        const endHour = end.getHours() + end.getMinutes() / 60
        const top = Math.max(0, (startHour - 8) * 64) // 64px por hora
        const height = Math.max(32, (endHour - startHour) * 64)
        return { top, height }
    }

    const getEventsForDay = (dateStr: string) => {
        return events.filter(e => {
            const eDate = new Date(e.start).toISOString().split("T")[0]
            return eDate === dateStr
        })
    }

    return (
        <div className="space-y-4">
            {/* Header con navegación */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={goToPrev}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">chevron_left</span>
                    </button>
                    <h3 className="text-lg font-semibold min-w-[240px] text-center">
                        {formatWeekRange(currentMonday)}
                    </h3>
                    <button
                        onClick={goToNext}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">chevron_right</span>
                    </button>
                    <button
                        onClick={goToToday}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        Hoy
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    {gcalConnected && (
                        <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                            <span className="size-2 rounded-full bg-green-500" />
                            Google Calendar sincronizado
                        </div>
                    )}
                    {loading && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                            Cargando...
                        </div>
                    )}
                </div>
            </div>

            {/* Leyenda */}
            <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                    <span className="size-3 rounded bg-yellow-200 border border-yellow-400" />
                    Pendiente
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="size-3 rounded bg-green-200 border border-green-400" />
                    Confirmada
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="size-3 rounded bg-blue-200 border border-blue-400" />
                    Completada
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="size-3 rounded bg-gray-200 border border-gray-400 dark:bg-gray-700 dark:border-gray-500" />
                    Google Calendar
                </div>
            </div>

            {/* Grid del calendario */}
            <div className="border rounded-xl overflow-hidden dark:border-gray-800 bg-white dark:bg-gray-900">
                {/* Header con días */}
                <div className="grid grid-cols-[60px_repeat(6,1fr)] border-b dark:border-gray-800">
                    <div className="p-2 text-xs text-gray-400 border-r dark:border-gray-800" />
                    {weekDays.map((day) => (
                        <div
                            key={day.dateStr}
                            className={`p-2 text-center border-r last:border-r-0 dark:border-gray-800 ${
                                day.isToday ? "bg-primary/5" : ""
                            }`}
                        >
                            <p className="text-xs text-gray-500 dark:text-gray-400">{day.dayName}</p>
                            <p className={`text-lg font-bold ${
                                day.isToday
                                    ? "text-white bg-primary rounded-full size-8 flex items-center justify-center mx-auto"
                                    : "text-gray-900 dark:text-white"
                            }`}>
                                {day.dayNum}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Grid de horas */}
                <div className="grid grid-cols-[60px_repeat(6,1fr)] relative overflow-y-auto max-h-[640px]">
                    {/* Columna de horas */}
                    <div>
                        {HOURS.map((hour) => (
                            <div key={hour} className="h-16 border-b border-r dark:border-gray-800 flex items-start justify-end pr-2 pt-0.5">
                                <span className="text-xs text-gray-400">
                                    {hour.toString().padStart(2, "0")}:00
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Columnas de días */}
                    {weekDays.map((day) => {
                        const dayEvents = getEventsForDay(day.dateStr)
                        return (
                            <div key={day.dateStr} className={`relative border-r last:border-r-0 dark:border-gray-800 ${day.isToday ? "bg-primary/[0.02]" : ""}`}>
                                {/* Grid lines */}
                                {HOURS.map((hour) => (
                                    <div key={hour} className="h-16 border-b dark:border-gray-800" />
                                ))}

                                {/* Eventos */}
                                {dayEvents.map((event) => {
                                    const { top, height } = getEventPosition(event)
                                    const isGoogle = event.source === "google"
                                    const hasAdvisorColor = !isGoogle && event.advisorColor
                                    const colorClass = isGoogle
                                        ? "bg-gray-100 border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
                                        : hasAdvisorColor ? "" : statusColors[event.status || "pending"]
                                    const startTime = new Date(event.start).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })

                                    return (
                                        <button
                                            key={event.id}
                                            onClick={() => setSelectedEvent(event)}
                                            className={`absolute left-0.5 right-0.5 rounded-md border px-1.5 py-0.5 text-left overflow-hidden cursor-pointer hover:opacity-90 transition-opacity z-10 ${colorClass}`}
                                            style={{
                                                top: `${top}px`,
                                                height: `${Math.max(height, 28)}px`,
                                                ...(hasAdvisorColor ? {
                                                    backgroundColor: `${event.advisorColor}20`,
                                                    borderColor: `${event.advisorColor}60`,
                                                    color: event.advisorColor || undefined,
                                                } : {}),
                                            }}
                                        >
                                            <p className="text-[10px] font-bold leading-tight truncate">
                                                {isGoogle && (
                                                    <span className="material-symbols-outlined text-[10px] mr-0.5 align-middle">event</span>
                                                )}
                                                {!isGoogle && event.type && (
                                                    <span className="material-symbols-outlined text-[10px] mr-0.5 align-middle">{typeIcons[event.type] || "event"}</span>
                                                )}
                                                {event.title}
                                            </p>
                                            {height > 36 && (
                                                <p className="text-[9px] opacity-70 truncate">
                                                    {startTime}{event.advisorName ? ` · ${event.advisorName}` : ""}{event.customerName ? ` · ${event.customerName}` : ""}
                                                </p>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Modal de detalle */}
            {selectedEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedEvent(null)}>
                    <div
                        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border dark:border-gray-800 w-full max-w-md mx-4 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    {selectedEvent.source === "google" ? (
                                        <span className="material-symbols-outlined text-gray-400">event</span>
                                    ) : selectedEvent.type ? (
                                        <span className="material-symbols-outlined text-gray-400">{typeIcons[selectedEvent.type] || "event"}</span>
                                    ) : (
                                        <span className="material-symbols-outlined text-gray-400">calendar_month</span>
                                    )}
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedEvent.title}</h3>
                                </div>
                                <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="space-y-2.5 text-sm">
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                    <span className="material-symbols-outlined text-base">schedule</span>
                                    <span>
                                        {new Date(selectedEvent.start).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
                                        {" · "}
                                        {new Date(selectedEvent.start).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                                        {" — "}
                                        {new Date(selectedEvent.end).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </div>

                                {selectedEvent.customerName && (
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                        <span className="material-symbols-outlined text-base">person</span>
                                        <span>{selectedEvent.customerName}</span>
                                        {selectedEvent.customerPhone && (
                                            <span className="text-gray-400">· {selectedEvent.customerPhone}</span>
                                        )}
                                    </div>
                                )}

                                {selectedEvent.location && (
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                        <span className="material-symbols-outlined text-base">location_on</span>
                                        <span>{selectedEvent.location}</span>
                                    </div>
                                )}

                                {selectedEvent.status && (
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-base text-gray-400">info</span>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[selectedEvent.status]}`}>
                                            {statusLabels[selectedEvent.status] || selectedEvent.status}
                                        </span>
                                    </div>
                                )}

                                {selectedEvent.advisorName && (
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                        <span
                                            className="size-3 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: selectedEvent.advisorColor || "#94a3b8" }}
                                        />
                                        <span>Asesor: <strong>{selectedEvent.advisorName}</strong></span>
                                    </div>
                                )}

                                {selectedEvent.propertyCode && (
                                    <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <span className="material-symbols-outlined text-base text-slate-400">home</span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                                {selectedEvent.propertyTitle || "Propiedad"}
                                            </p>
                                            <p className="text-xs text-slate-500">Código: {selectedEvent.propertyCode}</p>
                                        </div>
                                    </div>
                                )}

                                {selectedEvent.source === "google" && (
                                    <div className="flex items-center gap-2 text-gray-400 text-xs">
                                        <span className="material-symbols-outlined text-sm">cloud</span>
                                        Evento de Google Calendar
                                    </div>
                                )}
                            </div>

                            {/* Acciones (solo para citas locales) */}
                            {selectedEvent.source === "local" && (
                                <div className="flex gap-2 pt-2 border-t dark:border-gray-800">
                                    {selectedEvent.status === "pending" && (
                                        <>
                                            <button
                                                onClick={() => handleAction(selectedEvent.id, "confirm")}
                                                disabled={actioningId === selectedEvent.id || isPending}
                                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 transition-colors disabled:opacity-50"
                                            >
                                                <span className="material-symbols-outlined text-base">check</span>
                                                Confirmar
                                            </button>
                                            <button
                                                onClick={() => handleAction(selectedEvent.id, "cancel")}
                                                disabled={actioningId === selectedEvent.id || isPending}
                                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition-colors disabled:opacity-50"
                                            >
                                                <span className="material-symbols-outlined text-base">close</span>
                                                Cancelar
                                            </button>
                                        </>
                                    )}
                                    {selectedEvent.status === "confirmed" && (
                                        <>
                                            <button
                                                onClick={() => handleAction(selectedEvent.id, "complete")}
                                                disabled={actioningId === selectedEvent.id || isPending}
                                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 transition-colors disabled:opacity-50"
                                            >
                                                <span className="material-symbols-outlined text-base">task_alt</span>
                                                Completar
                                            </button>
                                            <button
                                                onClick={() => handleAction(selectedEvent.id, "cancel")}
                                                disabled={actioningId === selectedEvent.id || isPending}
                                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition-colors disabled:opacity-50"
                                            >
                                                <span className="material-symbols-outlined text-base">close</span>
                                                Cancelar
                                            </button>
                                        </>
                                    )}
                                    {(selectedEvent.status === "completed" || selectedEvent.status === "cancelled") && (
                                        <p className="text-sm text-gray-400 w-full text-center py-1">Sin acciones disponibles</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
