"use client"

import { useState } from "react"
import { AppointmentsTable } from "./appointments-table"
import { CalendarView } from "./calendar-view"

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

interface AppointmentsContentProps {
  appointments: Appointment[]
}

export function AppointmentsContent({ appointments }: AppointmentsContentProps) {
  const [view, setView] = useState<"calendar" | "table">("calendar")

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Citas</h1>
          <p className="text-muted-foreground">
            Citas agendadas por el asistente AI ({appointments.length})
          </p>
        </div>

        {/* Toggle de vista */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setView("calendar")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === "calendar"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <span className="material-symbols-outlined text-base">calendar_view_week</span>
            Calendario
          </button>
          <button
            onClick={() => setView("table")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === "table"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <span className="material-symbols-outlined text-base">table_rows</span>
            Tabla
          </button>
        </div>
      </div>

      {view === "calendar" ? (
        <CalendarView />
      ) : (
        <>
          <AppointmentsTable appointments={appointments} />

          {appointments.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 mx-auto">
                <span className="material-symbols-outlined text-3xl text-muted-foreground">calendar_month</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Sin citas agendadas</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Cuando un cliente agende una cita a través del chat, aparecerá aquí.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
