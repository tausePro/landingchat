"use client"

import { useState } from "react"
import Link from "next/link"

interface BookingPanelProps {
  slug: string
  propertyCode: string
  propertyTitle: string
  primaryColor: string
  orgName: string
}

const TIME_SLOTS = ["09:00 AM", "10:30 AM", "02:00 PM", "04:30 PM"]

export function BookingPanel({ slug, propertyCode, propertyTitle, primaryColor, orgName }: BookingPanelProps) {
  const [selectedTime, setSelectedTime] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")

  // Generar próximos 7 días
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() + i + 1)
    return d
  })
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const dayLabels = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Construir mensaje de WhatsApp o redirigir al chat
    const dateStr = selectedDate ? selectedDate.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" }) : ""
    const context = `Quiero agendar una cita para ver la propiedad ${propertyTitle} (${propertyCode})${dateStr ? ` el ${dateStr}` : ""}${selectedTime ? ` a las ${selectedTime}` : ""}. Mi nombre es ${name || "no especificado"}.`

    const params = new URLSearchParams()
    params.set("property", propertyCode)
    params.set("context", context)

    window.location.href = `/chat/${slug}/asesor?${params.toString()}`
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
          <div className="grid grid-cols-7 gap-1 text-center text-xs border border-slate-100 p-2 rounded-lg bg-slate-50">
            {days.map((d, i) => {
              const isSelected = selectedDate?.toDateString() === d.toDateString()
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDate(d)}
                  className={`py-2 rounded text-xs font-medium transition-all ${
                    isSelected
                      ? "text-white font-bold shadow-md"
                      : "hover:bg-slate-200"
                  }`}
                  style={isSelected ? { backgroundColor: primaryColor } : {}}
                >
                  <div className="text-[10px] text-slate-400 mb-0.5">{dayLabels[d.getDay()]}</div>
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        </div>

        {/* Time Slots */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            2. Horario disponible
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TIME_SLOTS.map((time) => {
              const isSelected = selectedTime === time
              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => setSelectedTime(isSelected ? "" : time)}
                  className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                    isSelected
                      ? "border-2 font-bold"
                      : "border border-slate-200 hover:border-slate-400"
                  }`}
                  style={isSelected ? { borderColor: primaryColor, color: primaryColor, backgroundColor: `${primaryColor}08` } : {}}
                >
                  {time}
                </button>
              )
            })}
          </div>
        </div>

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
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-[#10b981] text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">event_available</span> Confirmar Cita
        </button>
        <p className="text-center text-[10px] text-slate-400 italic">
          Al confirmar, un asesor validará la disponibilidad en menos de 15 minutos.
        </p>
      </form>

      {/* Alternative: Chat link */}
      <div className="mt-6 pt-6 border-t border-slate-100 text-center">
        <Link
          href={`/chat/${slug}/asesor?property=${propertyCode}`}
          className="text-sm font-semibold hover:underline"
          style={{ color: primaryColor }}
        >
          O chatea directamente con un asesor
        </Link>
      </div>
    </div>
  )
}
