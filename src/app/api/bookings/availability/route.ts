import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { getFreeBusySlots, isCalendarConnected } from "@/lib/calendar/google-calendar"
import { getAdvisors, type WorkingHours } from "@/lib/advisors/assignment"

const DAY_KEYS: Record<number, keyof WorkingHours> = {
    0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
    4: "thursday", 5: "friday", 6: "saturday",
}

/**
 * POST /api/bookings/availability
 * Endpoint público (sin auth) para consultar disponibilidad desde el storefront.
 * Body: { organizationId, date, daysAhead?, propertyType? }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { organizationId, date, daysAhead = 7, propertyType } = body

        if (!organizationId || !date) {
            return NextResponse.json({ error: "organizationId y date son requeridos" }, { status: 400 })
        }

        const daysToCheck = Math.min(Math.max(daysAhead, 1), 14)
        const startDate = new Date(date)
        if (isNaN(startDate.getTime())) {
            return NextResponse.json({ error: "Fecha inválida" }, { status: 400 })
        }

        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(startDate.getTime() + daysToCheck * 24 * 60 * 60 * 1000)

        const SLOT_DURATION = 90 // minutos por slot
        const DEFAULT_START = 9
        const DEFAULT_END = 18

        const supabase = createServiceClient()

        // Cargar asesores (si existen)
        let advisors: Awaited<ReturnType<typeof getAdvisors>> = []
        try {
            advisors = await getAdvisors(organizationId)
        } catch {
            // tabla advisors puede no existir aún
        }

        // Filtrar por especialidad si hay asesores y propertyType
        const relevantAdvisors = advisors.length > 0 ? advisors.filter(a => {
            if (a.specialty === "both") return true
            if (!propertyType) return true
            const pt = propertyType.toLowerCase()
            if (pt.includes("arriendo") && a.specialty === "rentals") return true
            if (pt.includes("venta") && a.specialty === "sales") return true
            return false
        }) : []

        const useAdvisors = relevantAdvisors.length > 0

        // 1. Citas locales existentes
        const { data: localAppointments } = await supabase
            .from("appointments")
            .select("proposed_date, proposed_end_date, status")
            .eq("organization_id", organizationId)
            .in("status", ["pending", "confirmed"])
            .gte("proposed_date", startDate.toISOString())
            .lte("proposed_date", endDate.toISOString())

        // 2. Google Calendar busy slots
        let gcalBusy: Array<{ start: string; end: string }> = []
        try {
            const connected = await isCalendarConnected(organizationId)
            if (connected) {
                const busy = await getFreeBusySlots(organizationId, startDate, endDate)
                if (busy) gcalBusy = busy
            }
        } catch {
            // GCal no disponible
        }

        // 3. Combinar busy slots
        const busySlots: Array<{ start: Date; end: Date }> = []
        for (const apt of (localAppointments || [])) {
            busySlots.push({
                start: new Date(apt.proposed_date),
                end: new Date(apt.proposed_end_date || new Date(new Date(apt.proposed_date).getTime() + 60 * 60 * 1000)),
            })
        }
        for (const slot of gcalBusy) {
            busySlots.push({ start: new Date(slot.start), end: new Date(slot.end) })
        }

        // 4. Calcular slots disponibles por día
        const availability: Array<{
            date: string
            dayName: string
            slots: Array<{ time: string; isoDate: string }>
        }> = []

        for (let d = 0; d < daysToCheck; d++) {
            const dayDate = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000)

            if (dayDate.getDay() === 0) continue
            if (dayDate < new Date(new Date().setHours(0, 0, 0, 0))) continue

            const dayStr = dayDate.toISOString().split("T")[0]
            const dayName = dayDate.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })
            const dayKey = DAY_KEYS[dayDate.getDay()]
            const dayBusy = busySlots.filter(b => b.start.toISOString().split("T")[0] === dayStr)

            // Determinar horas de trabajo para este día
            let workBlocks: Array<{ start: number; end: number }> = []

            if (useAdvisors) {
                // Unir todos los bloques de trabajo de asesores relevantes para este día
                for (const advisor of relevantAdvisors) {
                    const blocks = advisor.working_hours?.[dayKey]
                    if (!blocks) continue
                    for (const block of blocks) {
                        const [sh, sm] = block.start.split(":").map(Number)
                        const [eh, em] = block.end.split(":").map(Number)
                        workBlocks.push({ start: sh * 60 + (sm || 0), end: eh * 60 + (em || 0) })
                    }
                }
            } else {
                workBlocks = [{ start: DEFAULT_START * 60, end: DEFAULT_END * 60 }]
            }

            if (workBlocks.length === 0) continue

            // Generar slots cada 30 min dentro de los bloques de trabajo
            const slotMinutes = new Set<number>()
            for (const block of workBlocks) {
                for (let m = block.start; m < block.end; m += 30) {
                    slotMinutes.add(m)
                }
            }

            const slots: Array<{ time: string; isoDate: string }> = []
            const sortedMinutes = Array.from(slotMinutes).sort((a, b) => a - b)

            for (const mins of sortedMinutes) {
                const slotStart = new Date(dayDate)
                slotStart.setHours(Math.floor(mins / 60), mins % 60, 0, 0)
                const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION * 60 * 1000)

                if (slotStart < new Date()) continue

                const isOccupied = dayBusy.some(b => slotStart < b.end && slotEnd > b.start)
                if (!isOccupied) {
                    slots.push({
                        time: slotStart.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true }),
                        isoDate: slotStart.toISOString(),
                    })
                }
            }

            if (slots.length > 0) {
                availability.push({ date: dayStr, dayName, slots })
            }
        }

        return NextResponse.json({ availability })
    } catch (error) {
        console.error("[bookings/availability] Error:", error)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}
