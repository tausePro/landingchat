import { createServiceClient } from "@/lib/supabase/server"
import { getFreeBusySlots } from "@/lib/calendar/google-calendar"
import { formatBogotaTime } from "@/lib/utils/date"

export interface Advisor {
    id: string
    name: string
    specialty: "sales" | "rentals" | "both"
    color: string
    google_calendar_id: string | null
    working_hours: WorkingHours
    is_active: boolean
}

export interface WorkingHours {
    monday?: TimeBlock[]
    tuesday?: TimeBlock[]
    wednesday?: TimeBlock[]
    thursday?: TimeBlock[]
    friday?: TimeBlock[]
    saturday?: TimeBlock[]
    sunday?: TimeBlock[]
}

interface TimeBlock {
    start: string // "09:00"
    end: string   // "13:00"
}

const DAY_NAMES: Record<number, keyof WorkingHours> = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
}

const SPECIALTY_MAP: Record<string, "sales" | "rentals" | "both"> = {
    venta: "sales",
    ventas: "sales",
    arriendo: "rentals",
    arriendos: "rentals",
}

/**
 * Obtiene los asesores activos de una organización.
 */
export async function getAdvisors(organizationId: string): Promise<Advisor[]> {
    const supabase = createServiceClient()
    const { data } = await supabase
        .from("advisors")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("name")

    return (data || []) as Advisor[]
}

/**
 * Determina si la organización tiene asesores configurados.
 */
export async function hasAdvisors(organizationId: string): Promise<boolean> {
    const advisors = await getAdvisors(organizationId)
    return advisors.length > 0
}

/**
 * Asigna automáticamente un asesor para una cita.
 * 
 * Lógica:
 * 1. Filtra por especialidad (ventas/arriendos)
 * 2. Filtra quién trabaja en ese día/hora
 * 3. De los disponibles, elige el que tenga menos citas ese día (round-robin)
 * 
 * Si no hay asesores configurados, retorna null (modo simple).
 */
export async function assignAdvisor(
    organizationId: string,
    proposedDate: Date,
    propertyType?: string // 'arriendo', 'venta', 'venta y arriendo'
): Promise<Advisor | null> {
    const advisors = await getAdvisors(organizationId)
    if (advisors.length === 0) return null

    // 1. Filtrar por especialidad
    const neededSpecialty = resolveSpecialty(propertyType)
    const bySpecialty = advisors.filter(a =>
        a.specialty === "both" || a.specialty === neededSpecialty || neededSpecialty === "both"
    )

    if (bySpecialty.length === 0) return advisors[0] // fallback al primero

    // 2. Filtrar quién trabaja en ese día y hora
    const dayName = DAY_NAMES[proposedDate.getDay()]
    const timeStr = `${proposedDate.getHours().toString().padStart(2, "0")}:${proposedDate.getMinutes().toString().padStart(2, "0")}`

    const working = bySpecialty.filter(a => {
        const dayBlocks = a.working_hours?.[dayName]
        if (!dayBlocks || dayBlocks.length === 0) return false
        return dayBlocks.some(block => timeStr >= block.start && timeStr < block.end)
    })

    if (working.length === 0) {
        // Nadie trabaja a esa hora, retornar el primero por especialidad como fallback
        return bySpecialty[0]
    }

    if (working.length === 1) return working[0]

    // 3. Round-robin: elegir el que tenga menos citas ese día
    const supabase = createServiceClient()
    const dayStart = new Date(proposedDate)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

    const { data: dayCounts } = await supabase
        .from("appointments")
        .select("assigned_to")
        .eq("organization_id", organizationId)
        .in("status", ["pending", "confirmed"])
        .gte("proposed_date", dayStart.toISOString())
        .lt("proposed_date", dayEnd.toISOString())
        .not("assigned_to", "is", null)

    const countMap = new Map<string, number>()
    for (const row of (dayCounts || [])) {
        const id = row.assigned_to as string
        countMap.set(id, (countMap.get(id) || 0) + 1)
    }

    // Ordenar por menos citas
    working.sort((a, b) => (countMap.get(a.id) || 0) - (countMap.get(b.id) || 0))
    return working[0]
}

/**
 * Obtiene los slots disponibles considerando horarios de asesores.
 * Si hay asesores, retorna solo los slots donde al menos 1 asesor trabaja Y está libre.
 * Si no hay asesores, usa el horario por defecto (9-18).
 */
export async function getAdvisorAvailableSlots(
    organizationId: string,
    date: Date,
    propertyType?: string
): Promise<Array<{ time: string; isoDate: string }>> {
    const advisors = await getAdvisors(organizationId)

    if (advisors.length === 0) {
        // Modo simple: sin asesores
        return []
    }

    const neededSpecialty = resolveSpecialty(propertyType)
    const relevantAdvisors = advisors.filter(a =>
        a.specialty === "both" || a.specialty === neededSpecialty || neededSpecialty === "both"
    )

    if (relevantAdvisors.length === 0) return []

    const dayName = DAY_NAMES[date.getDay()]

    // Recopilar todas las horas de trabajo de todos los asesores relevantes
    const workingSlots = new Set<string>()
    for (const advisor of relevantAdvisors) {
        const dayBlocks = advisor.working_hours?.[dayName]
        if (!dayBlocks) continue

        for (const block of dayBlocks) {
            const [startH, startM] = block.start.split(":").map(Number)
            const [endH, endM] = block.end.split(":").map(Number)
            const startMin = startH * 60 + (startM || 0)
            const endMin = endH * 60 + (endM || 0)

            for (let m = startMin; m < endMin; m += 30) {
                const h = Math.floor(m / 60)
                const min = m % 60
                workingSlots.add(`${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`)
            }
        }
    }

    // Convertir a array de slots
    const slots: Array<{ time: string; isoDate: string }> = []
    const sortedTimes = Array.from(workingSlots).sort()

    for (const timeStr of sortedTimes) {
        const [h, m] = timeStr.split(":").map(Number)
        const slotDate = new Date(date)
        slotDate.setHours(h, m, 0, 0)

        if (slotDate < new Date()) continue // Skip past slots

        slots.push({
            time: formatBogotaTime(slotDate),
            isoDate: slotDate.toISOString(),
        })
    }

    return slots
}

function resolveSpecialty(propertyType?: string): "sales" | "rentals" | "both" {
    if (!propertyType) return "both"
    const lower = propertyType.toLowerCase()
    if (lower.includes("arriendo")) return "rentals"
    if (lower.includes("venta") && lower.includes("arriendo")) return "both"
    if (lower.includes("venta")) return "sales"
    return SPECIALTY_MAP[lower] || "both"
}
