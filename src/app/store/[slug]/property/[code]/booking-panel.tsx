"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"

interface BookingPanelProps {
  slug: string
  propertyCode: string
  propertyTitle: string
  primaryColor: string
  orgName: string
  organizationId: string
  chatUrl?: string
}

interface AvailableDay {
  date: string
  dayName: string
  slots: Array<{ time: string; isoDate: string }>
}

export function BookingPanel({ slug, propertyCode, propertyTitle, primaryColor, orgName, organizationId, chatUrl }: BookingPanelProps) {
  const fallbackChatUrl = chatUrl || `/chat/${slug}/asesor?property=${propertyCode}`
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [availability, setAvailability] = useState<AvailableDay[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<{ time: string; isoDate: string } | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ date: string; time: string } | null>(null)
  const [error, setError] = useState("")

  const dayLabels = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"]

  const fetchAvailability = useCallback(async () => {
    setLoadingSlots(true)
    try {
      const today = new Date()
      const res = await fetch("/api/bookings/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          organizationId,
          date: today.toISOString(),
          daysAhead: 8,
        }),
      })
      const data = await res.json()
      if (data.availability) {
        setAvailability(data.availability)
        if (data.availability.length > 0) {
          setSelectedDate(data.availability[0].date)
        }
      }
    } catch {
      console.error("Error fetching availability")
    } finally {
      setLoadingSlots(false)
    }
  }, [organizationId, slug])

  useEffect(() => {
    fetchAvailability()
  }, [fetchAvailability])

  const selectedDaySlots = availability.find(d => d.date === selectedDate)?.slots || []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!selectedSlot) {
      setError("Selecciona un horario")
      return
    }
    if (!name.trim()) {
      setError("Ingresa tu nombre")
      return
    }
    if (!phone.trim() || phone.length < 7) {
      setError("Ingresa un número de WhatsApp válido")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          organizationId,
          propertyCode,
          proposedDate: selectedSlot.isoDate,
          customerName: name.trim(),
          customerPhone: `+57${phone.replace(/\s/g, "")}`,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setSuccess({ date: data.appointment.date, time: data.appointment.time })
      } else {
        setError(data.error || "Error al agendar. Intenta de nuevo.")
        if (res.status === 409) {
          fetchAvailability()
        }
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.")
    } finally {
      setSubmitting(false)
    }
  }

  // Vista de éxito
  if (success) {
    return (
      <div className="sticky top-24 bg-white border border-slate-200 rounded-2xl shadow-xl p-6 lg:p-8 text-center">
        <div className="size-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${primaryColor}15` }}>
          <span className="material-symbols-outlined text-3xl" style={{ color: primaryColor }}>check_circle</span>
        </div>
        <h3 className="text-xl font-extrabold text-slate-900 mb-2">¡Visita Agendada!</h3>
        <p className="text-sm text-slate-600 mb-4">
          Tu visita a <strong>{propertyTitle}</strong> ha sido agendada para:
        </p>
        <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-100">
          <p className="text-lg font-bold text-slate-900 capitalize">{success.date}</p>
          <p className="text-sm text-slate-600">{success.time}</p>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          Un asesor de {orgName} confirmará tu cita en breve por WhatsApp.
        </p>
        <Link
          href={fallbackChatUrl}
          className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
          style={{ color: primaryColor }}
        >
          <span className="material-symbols-outlined text-base">chat</span>
          ¿Tienes preguntas? Chatea con un asesor
        </Link>
      </div>
    )
  }

  return (
    <div className="sticky top-24 bg-white border border-slate-200 rounded-2xl shadow-xl p-6 lg:p-8">
      <h3 className="text-xl font-extrabold text-slate-900 mb-1">Agenda tu visita</h3>
      <p className="text-sm text-slate-500 mb-6 font-medium">Reserva un espacio con un asesor de {orgName}</p>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Date Picker */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            1. Selecciona la fecha
          </label>
          {loadingSlots ? (
            <div className="flex items-center justify-center py-4 text-sm text-slate-400">
              <span className="material-symbols-outlined text-base animate-spin mr-2">progress_activity</span>
              Consultando disponibilidad...
            </div>
          ) : availability.length === 0 ? (
            <p className="text-sm text-slate-500 py-2">No hay horarios disponibles esta semana.</p>
          ) : (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {availability.map((day) => {
                const d = new Date(day.date + "T12:00:00")
                const isSelected = selectedDate === day.date
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => { setSelectedDate(day.date); setSelectedSlot(null) }}
                    className={`flex-shrink-0 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? "text-white font-bold shadow-md"
                        : "border border-slate-200 hover:border-slate-400"
                    }`}
                    style={isSelected ? { backgroundColor: primaryColor } : {}}
                  >
                    <div className={`text-[10px] mb-0.5 ${isSelected ? "text-white/70" : "text-slate-400"}`}>
                      {dayLabels[d.getDay()]}
                    </div>
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Time Slots */}
        {selectedDate && (
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              2. Horario disponible
            </label>
            {selectedDaySlots.length === 0 ? (
              <p className="text-sm text-slate-500">No hay horarios disponibles este día.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {selectedDaySlots.map((slot) => {
                  const isSelected = selectedSlot?.isoDate === slot.isoDate
                  return (
                    <button
                      key={slot.isoDate}
                      type="button"
                      onClick={() => setSelectedSlot(isSelected ? null : slot)}
                      className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                        isSelected
                          ? "border-2 font-bold"
                          : "border border-slate-200 hover:border-slate-400"
                      }`}
                      style={isSelected ? { borderColor: primaryColor, color: primaryColor, backgroundColor: `${primaryColor}08` } : {}}
                    >
                      {slot.time}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Contact Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nombre Completo
            </label>
            <input
              className="w-full border-slate-200 rounded-lg focus:ring-1 focus:border-slate-400 px-3 py-2 text-sm border"
              placeholder="Ej: Juan Pérez"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              WhatsApp
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-3 text-sm text-slate-500 bg-slate-100 border border-r-0 border-slate-200 rounded-l-lg">
                +57
              </span>
              <input
                className="w-full border-slate-200 rounded-r-lg focus:ring-1 focus:border-slate-400 px-3 py-2 text-sm border"
                placeholder="300 000 0000"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || !selectedSlot}
          className="w-full text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: selectedSlot ? "#10b981" : "#94a3b8" }}
        >
          {submitting ? (
            <>
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              Agendando...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">event_available</span>
              Confirmar Cita
            </>
          )}
        </button>
        <p className="text-center text-[10px] text-slate-400 italic">
          Al confirmar, un asesor validará la disponibilidad en menos de 15 minutos.
        </p>
      </form>

      {/* Alternative: Chat link */}
      <div className="mt-6 pt-6 border-t border-slate-100 text-center">
        <Link
          href={fallbackChatUrl}
          className="text-sm font-semibold hover:underline"
          style={{ color: primaryColor }}
        >
          O chatea directamente con un asesor
        </Link>
      </div>
    </div>
  )
}
