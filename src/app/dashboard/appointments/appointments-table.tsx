"use client"

import { useState } from "react"

interface Appointment {
  id: string
  title: string
  appointment_type: string
  status: string
  proposed_date: string
  proposed_end_date: string
  duration_minutes: number
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  location: string | null
  location_type: string
  notes: string | null
  created_at: string
}

interface AppointmentsTableProps {
  appointments: Appointment[]
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  rescheduled: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
}

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
  rescheduled: "Reagendada",
}

const typeLabels: Record<string, string> = {
  visit: "Visita",
  consultation: "Consulta",
  call: "Llamada",
  meeting: "Reunión",
}

const typeIcons: Record<string, string> = {
  visit: "location_on",
  consultation: "chat",
  call: "call",
  meeting: "groups",
}

export function AppointmentsTable({ appointments }: AppointmentsTableProps) {
  const [filter, setFilter] = useState<string>("all")

  const filtered = filter === "all"
    ? appointments
    : appointments.filter(a => a.status === filter)

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString("es-CO", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const isPast = (dateStr: string) => new Date(dateStr) < new Date()

  return (
    <div>
      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: "all", label: "Todas" },
          { key: "pending", label: "Pendientes" },
          { key: "confirmed", label: "Confirmadas" },
          { key: "completed", label: "Completadas" },
          { key: "cancelled", label: "Canceladas" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-primary text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="border rounded-lg overflow-hidden dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">Cita</th>
              <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">Cliente</th>
              <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">Fecha y Hora</th>
              <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">Ubicación</th>
              <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-800">
            {filtered.map((apt) => (
              <tr
                key={apt.id}
                className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 ${isPast(apt.proposed_date) && apt.status === "pending" ? "opacity-60" : ""}`}
              >
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg text-gray-400">
                      {typeIcons[apt.appointment_type] || "event"}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{apt.title}</p>
                      <p className="text-xs text-gray-500">
                        {typeLabels[apt.appointment_type] || apt.appointment_type} · {apt.duration_minutes} min
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <p className="font-medium text-gray-900 dark:text-white">{apt.customer_name}</p>
                  {apt.customer_phone && (
                    <p className="text-xs text-gray-500">{apt.customer_phone}</p>
                  )}
                </td>
                <td className="p-3">
                  <p className="font-medium text-gray-900 dark:text-white">{formatDate(apt.proposed_date)}</p>
                  <p className="text-xs text-gray-500">
                    {formatTime(apt.proposed_date)}
                    {apt.proposed_end_date && ` - ${formatTime(apt.proposed_end_date)}`}
                  </p>
                </td>
                <td className="p-3">
                  <p className="text-gray-700 dark:text-gray-300 text-xs">
                    {apt.location || (apt.location_type === "video_call" ? "Videollamada" : apt.location_type === "phone_call" ? "Llamada" : "Por confirmar")}
                  </p>
                </td>
                <td className="p-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[apt.status] || "bg-gray-100 text-gray-800"}`}>
                    {statusLabels[apt.status] || apt.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No hay citas con este filtro.
          </div>
        )}
      </div>
    </div>
  )
}
