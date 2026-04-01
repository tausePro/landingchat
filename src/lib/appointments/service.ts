import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import { getFreeBusySlots, isCalendarConnected, createCalendarEvent, updateCalendarEvent, cancelCalendarEvent, listUpcomingEvents } from "@/lib/calendar/google-calendar"
import { assignAdvisor, getAdvisors, type Advisor, type WorkingHours } from "@/lib/advisors/assignment"
import { createAppointment as createAppointmentRecord, getActiveAppointmentsInRange, getConflictingAppointments, updateAppointment as updateAppointmentRecord } from "@/lib/repositories/appointments"
import { sendAppointmentNotification } from "@/lib/notifications/whatsapp"

const log = logger("appointments/service")

const DAY_KEYS: Record<number, keyof WorkingHours> = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
}

const DEFAULT_STATUS_TRANSITIONS: Record<string, AppointmentStatus[]> = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["completed", "cancelled", "rescheduled"],
    rescheduled: ["confirmed", "cancelled"],
}

const DEFAULT_SLOT_STEP_MINUTES = 30
const DEFAULT_DAY_START_HOUR = 9
const DEFAULT_DAY_END_HOUR = 18

export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed" | "rescheduled"

export interface AppointmentAvailabilitySlot {
    time: string
    isoDate: string
    endIsoDate: string
}

export interface AppointmentAvailabilityDay {
    date: string
    dayName: string
    slots: AppointmentAvailabilitySlot[]
    busyCount: number
}

export interface AppointmentAvailabilityResult {
    availability: AppointmentAvailabilityDay[]
    advisors: string[]
    googleCalendarConnected: boolean
    hasAdvisors: boolean
}

export interface GetAppointmentAvailabilityInput {
    organizationId: string
    date: Date
    daysAhead?: number
    propertyType?: string
    slotDurationMinutes?: number
    slotStepMinutes?: number
    includeEmptyDays?: boolean
    skipSundays?: boolean
}

export interface CreateAppointmentInput {
    organizationId: string
    title?: string
    proposedDate: Date
    durationMinutes?: number
    appointmentType?: string
    location?: string | null
    locationType?: string
    customerName: string
    customerPhone?: string | null
    customerEmail?: string | null
    notes?: string | null
    propertyCode?: string | null
    customerId?: string | null
    chatId?: string | null
    metadata?: Record<string, unknown>
    notifyAdmin?: boolean
    syncCalendar?: boolean
}

export interface AppointmentConflict {
    id: string
    title: string
    proposed_date: string
    proposed_end_date: string | null
}

interface PropertyLookupResult {
    id: string
    title: string
    address: string | null
    neighborhood: string | null
    city: string | null
    property_type: string | null
}

export interface CreatedAppointmentSummary {
    id: string
    title: string
    appointmentType: string
    status: AppointmentStatus
    proposedDate: string
    proposedEndDate: string
    durationMinutes: number
    customerName: string
    customerPhone: string | null
    customerEmail: string | null
    location: string | null
    locationType: string
    propertyId: string | null
    propertyCode: string | null
    propertyTitle: string | null
    googleEventId: string | null
}

export interface AssignedAdvisorSummary {
    id: string
    name: string
    googleCalendarId: string | null
}

export type CreateAppointmentResult =
    | {
        success: true
        appointment: CreatedAppointmentSummary
        assignedAdvisor: AssignedAdvisorSummary | null
        conflicts: []
      }
    | {
        success: false
        code: "invalid_date" | "past_date" | "conflict" | "create_failed"
        error: string
        conflicts: AppointmentConflict[]
      }

export interface CalendarEventItem {
    id: string
    title: string
    start: string
    end: string
    source: "local" | "google"
    status?: string
    type?: string
    customerName?: string
    customerPhone?: string | null
    location?: string | null
    propertyCode?: string | null
    propertyTitle?: string | null
    advisorName?: string | null
    advisorColor?: string | null
}

export interface GetCalendarEventsResult {
    events: CalendarEventItem[]
    gcalConnected: boolean
}

export interface UpdateAppointmentStatusResult {
    success: boolean
    error?: string
}

type AppointmentRelation<T> = T | T[] | null

interface AppointmentCalendarRow {
    id: string
    title: string
    proposed_date: string
    proposed_end_date: string | null
    status: string
    appointment_type: string
    customer_name: string
    customer_phone: string | null
    location: string | null
    google_event_id: string | null
    property_id: string | null
    assigned_to: string | null
    properties?: AppointmentRelation<{ external_code: string | null; title: string | null }>
    advisors?: AppointmentRelation<{ name: string | null; color: string | null }>
}

export async function getAppointmentAvailability(
    supabase: SupabaseClient,
    input: GetAppointmentAvailabilityInput,
): Promise<AppointmentAvailabilityResult> {
    const daysToCheck = Math.min(Math.max(input.daysAhead ?? 7, 1), 14)
    const slotDurationMinutes = input.slotDurationMinutes ?? 60
    const slotStepMinutes = input.slotStepMinutes ?? DEFAULT_SLOT_STEP_MINUTES
    const includeEmptyDays = input.includeEmptyDays ?? false
    const skipSundays = input.skipSundays ?? true

    const startDate = new Date(input.date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(startDate.getTime() + daysToCheck * 24 * 60 * 60 * 1000)

    let advisors: Advisor[] = []
    try {
        advisors = await getAdvisors(input.organizationId)
    } catch (error) {
        log.warn("Could not load advisors", {
            organizationId: input.organizationId,
            error: error instanceof Error ? error.message : String(error),
        })
    }

    const relevantAdvisors = getRelevantAdvisors(advisors, input.propertyType)
    const advisorNames = relevantAdvisors.map((advisor) => `${advisor.name} (${formatAdvisorSpecialty(advisor.specialty)})`)

    const localAppointments = await getActiveAppointmentsInRange(
        supabase,
        input.organizationId,
        startDate.toISOString(),
        endDate.toISOString(),
    )

    let gcalBusy: Array<{ start: string; end: string }> = []
    let gcalConnected = false

    try {
        gcalConnected = await isCalendarConnected(input.organizationId)
        if (gcalConnected) {
            gcalBusy = (await getFreeBusySlots(input.organizationId, startDate, endDate)) || []
        }
    } catch (error) {
        log.warn("Could not load Google Calendar availability", {
            organizationId: input.organizationId,
            error: error instanceof Error ? error.message : String(error),
        })
    }

    const busySlots = [
        ...localAppointments.map((appointment) => ({
            start: new Date(appointment.proposed_date),
            end: new Date(appointment.proposed_end_date || new Date(new Date(appointment.proposed_date).getTime() + slotDurationMinutes * 60 * 1000).toISOString()),
        })),
        ...gcalBusy.map((slot) => ({
            start: new Date(slot.start),
            end: new Date(slot.end),
        })),
    ]

    const availability: AppointmentAvailabilityDay[] = []

    for (let offset = 0; offset < daysToCheck; offset++) {
        const dayDate = new Date(startDate.getTime() + offset * 24 * 60 * 60 * 1000)
        const dayStr = dayDate.toISOString().split("T")[0]
        const dayName = dayDate.toLocaleDateString("es-CO", {
            weekday: includeEmptyDays ? "long" : "short",
            day: "numeric",
            month: includeEmptyDays ? "long" : "short",
        })

        if (skipSundays && dayDate.getDay() === 0) {
            if (includeEmptyDays) {
                availability.push({ date: dayStr, dayName, slots: [], busyCount: 0 })
            }
            continue
        }

        if (dayDate < new Date(new Date().setHours(0, 0, 0, 0))) {
            continue
        }

        const dayBusy = busySlots.filter((busy) => busy.start.toISOString().split("T")[0] === dayStr)
        const workMinutes = buildWorkingMinutes(dayDate, relevantAdvisors, slotStepMinutes)
        const slots: AppointmentAvailabilitySlot[] = []

        for (const minutes of workMinutes) {
            const slotStart = new Date(dayDate)
            slotStart.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
            const slotEnd = new Date(slotStart.getTime() + slotDurationMinutes * 60 * 1000)

            if (slotStart < new Date()) {
                continue
            }

            const isOccupied = dayBusy.some((busy) => slotStart < busy.end && slotEnd > busy.start)
            if (!isOccupied) {
                slots.push({
                    time: slotStart.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true }),
                    isoDate: slotStart.toISOString(),
                    endIsoDate: slotEnd.toISOString(),
                })
            }
        }

        if (slots.length > 0 || includeEmptyDays) {
            availability.push({
                date: dayStr,
                dayName,
                slots,
                busyCount: dayBusy.length,
            })
        }
    }

    return {
        availability,
        advisors: advisorNames,
        googleCalendarConnected: gcalConnected,
        hasAdvisors: relevantAdvisors.length > 0,
    }
}

export async function createManagedAppointment(
    supabase: SupabaseClient,
    input: CreateAppointmentInput,
): Promise<CreateAppointmentResult> {
    const durationMinutes = input.durationMinutes ?? 60
    const appointmentType = input.appointmentType ?? "visit"
    const locationType = input.locationType ?? "in_person"
    const proposedDate = new Date(input.proposedDate)

    if (isNaN(proposedDate.getTime())) {
        return {
            success: false,
            code: "invalid_date",
            error: "Fecha inválida",
            conflicts: [],
        }
    }

    if (proposedDate < new Date()) {
        return {
            success: false,
            code: "past_date",
            error: "No se puede agendar en el pasado",
            conflicts: [],
        }
    }

    const proposedEndDate = new Date(proposedDate.getTime() + durationMinutes * 60 * 1000)
    const conflicts = await getConflictingAppointments(
        supabase,
        input.organizationId,
        proposedDate.toISOString(),
        proposedEndDate.toISOString(),
    )

    if (conflicts.length > 0) {
        return {
            success: false,
            code: "conflict",
            error: "Hay un conflicto de horario",
            conflicts,
        }
    }

    const property = await findPropertyByCode(supabase, input.organizationId, input.propertyCode)
    const propertyAddress = property ? [property.address, property.neighborhood, property.city].filter(Boolean).join(", ") : null
    const resolvedLocation = input.location ?? propertyAddress ?? null
    const resolvedTitle = input.title?.trim() || (property?.title ? `Visita ${property.title}` : `Visita programada — ${input.customerName}`)

    let assignedAdvisor: AssignedAdvisorSummary | null = null
    try {
        const advisor = await assignAdvisor(input.organizationId, proposedDate, property?.property_type || undefined)
        if (advisor) {
            assignedAdvisor = {
                id: advisor.id,
                name: advisor.name,
                googleCalendarId: advisor.google_calendar_id,
            }
        }
    } catch (error) {
        log.warn("Advisor assignment failed", {
            organizationId: input.organizationId,
            error: error instanceof Error ? error.message : String(error),
        })
    }

    const metadata = {
        ...(input.metadata || {}),
        ...(input.propertyCode ? { property_code: input.propertyCode } : {}),
        ...(assignedAdvisor ? { advisor_name: assignedAdvisor.name } : {}),
    }

    const insertData: Record<string, unknown> = {
        customer_id: input.customerId || null,
        chat_id: input.chatId || null,
        property_id: property?.id || null,
        title: resolvedTitle,
        appointment_type: appointmentType,
        status: "pending",
        proposed_date: proposedDate.toISOString(),
        proposed_end_date: proposedEndDate.toISOString(),
        duration_minutes: durationMinutes,
        customer_name: input.customerName,
        customer_phone: input.customerPhone || null,
        customer_email: input.customerEmail || null,
        location: resolvedLocation,
        location_type: locationType,
        notes: input.notes || null,
        metadata,
    }

    if (assignedAdvisor) {
        insertData.assigned_to = assignedAdvisor.id
    }

    const created = await createAppointmentRecord(supabase, input.organizationId, insertData)
    if (!created.data || created.error) {
        return {
            success: false,
            code: "create_failed",
            error: created.error || "Error creando la cita",
            conflicts: [],
        }
    }

    const appointment = created.data as {
        id: string
        title: string
        appointment_type: string
        status: AppointmentStatus
        proposed_date: string
        proposed_end_date: string
        duration_minutes: number
        customer_name: string
        customer_phone: string | null
        customer_email: string | null
        location: string | null
        location_type: string
        property_id: string | null
        google_event_id: string | null
    }

    let googleEventId = appointment.google_event_id || null

    if (input.syncCalendar !== false) {
        try {
            googleEventId = await createCalendarEvent(
                input.organizationId,
                {
                    title: assignedAdvisor ? `${resolvedTitle} — ${assignedAdvisor.name}` : resolvedTitle,
                    description: buildCalendarDescription({
                        customerName: input.customerName,
                        customerPhone: input.customerPhone || null,
                        propertyCode: input.propertyCode || null,
                        advisorName: assignedAdvisor?.name || null,
                        notes: input.notes || null,
                    }),
                    startDate: proposedDate,
                    endDate: proposedEndDate,
                    location: resolvedLocation || undefined,
                    attendeeEmail: input.customerEmail || undefined,
                },
                assignedAdvisor?.googleCalendarId || undefined,
            )

            if (googleEventId) {
                await updateAppointmentRecord(supabase, input.organizationId, appointment.id, {
                    google_event_id: googleEventId,
                })
            } else {
                log.warn("Calendar sync returned no event id", {
                    appointmentId: appointment.id,
                    organizationId: input.organizationId,
                    advisorCalendarId: assignedAdvisor?.googleCalendarId || null,
                })
            }
        } catch (error) {
            log.warn("Calendar sync failed", {
                appointmentId: appointment.id,
                organizationId: input.organizationId,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    if (input.notifyAdmin !== false) {
        try {
            await sendAppointmentNotification(
                { organizationId: input.organizationId },
                {
                    title: resolvedTitle,
                    customerName: input.customerName,
                    customerPhone: input.customerPhone || null,
                    proposedDate,
                    appointmentType,
                    location: resolvedLocation,
                },
            )
        } catch (error) {
            log.warn("Appointment notification failed", {
                appointmentId: appointment.id,
                organizationId: input.organizationId,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    return {
        success: true,
        appointment: {
            id: appointment.id,
            title: appointment.title,
            appointmentType: appointment.appointment_type,
            status: appointment.status,
            proposedDate: appointment.proposed_date,
            proposedEndDate: appointment.proposed_end_date,
            durationMinutes: appointment.duration_minutes,
            customerName: appointment.customer_name,
            customerPhone: appointment.customer_phone,
            customerEmail: appointment.customer_email,
            location: appointment.location,
            locationType: appointment.location_type,
            propertyId: appointment.property_id,
            propertyCode: input.propertyCode || null,
            propertyTitle: property?.title || null,
            googleEventId,
        },
        assignedAdvisor,
        conflicts: [],
    }
}

export async function getCalendarEventsForRange(
    supabase: SupabaseClient,
    organizationId: string,
    weekStart: Date,
): Promise<GetCalendarEventsResult> {
    const startDate = new Date(weekStart)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000)

    const { data } = await supabase
        .from("appointments")
        .select("id, title, proposed_date, proposed_end_date, status, appointment_type, customer_name, customer_phone, location, google_event_id, property_id, assigned_to, properties(external_code, title), advisors(name, color)")
        .eq("organization_id", organizationId)
        .gte("proposed_date", startDate.toISOString())
        .lte("proposed_date", endDate.toISOString())
        .order("proposed_date", { ascending: true })

    const appointments = (data || []) as unknown as AppointmentCalendarRow[]
    const events: CalendarEventItem[] = appointments.map((appointment) => {
        const property = getSingleRelation(appointment.properties)
        const advisor = getSingleRelation(appointment.advisors)

        return {
            id: appointment.id,
            title: appointment.title,
            start: appointment.proposed_date,
            end: appointment.proposed_end_date || new Date(new Date(appointment.proposed_date).getTime() + 60 * 60 * 1000).toISOString(),
            source: "local",
            status: appointment.status,
            type: appointment.appointment_type,
            customerName: appointment.customer_name,
            customerPhone: appointment.customer_phone,
            location: appointment.location,
            propertyCode: property?.external_code || null,
            propertyTitle: property?.title || null,
            advisorName: advisor?.name || null,
            advisorColor: advisor?.color || null,
        }
    })

    let gcalConnected = false
    try {
        gcalConnected = await isCalendarConnected(organizationId)
        if (gcalConnected) {
            const gcalEvents = await listUpcomingEvents(organizationId, startDate, endDate, 50)
            const localGoogleIds = new Set<string>()

            for (const appointment of appointments) {
                if (!appointment.google_event_id) {
                    continue
                }

                localGoogleIds.add(appointment.google_event_id)
                localGoogleIds.add(extractGoogleEventId(appointment.google_event_id))
            }

            for (const gcalEvent of gcalEvents || []) {
                const normalizedGoogleEventId = extractGoogleEventId(gcalEvent.id)

                if (!localGoogleIds.has(gcalEvent.id) && !localGoogleIds.has(normalizedGoogleEventId)) {
                    events.push({
                        id: `gcal-${gcalEvent.id}`,
                        title: gcalEvent.summary,
                        start: gcalEvent.start,
                        end: gcalEvent.end,
                        source: "google",
                    })
                }
            }
        }
    } catch (error) {
        log.warn("Could not load Google Calendar events", {
            organizationId,
            error: error instanceof Error ? error.message : String(error),
        })
    }

    events.sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime())

    return { events, gcalConnected }
}

export async function updateManagedAppointmentStatus(
    supabase: SupabaseClient,
    input: {
        organizationId: string
        appointmentId: string
        newStatus: AppointmentStatus
    },
): Promise<UpdateAppointmentStatusResult> {
    const { data, error } = await supabase
        .from("appointments")
        .select("id, status, google_event_id")
        .eq("id", input.appointmentId)
        .eq("organization_id", input.organizationId)
        .single()

    if (error || !data) {
        return { success: false, error: "Cita no encontrada" }
    }

    const appointment = data as { id: string; status: string; google_event_id: string | null }
    const allowedTransitions = DEFAULT_STATUS_TRANSITIONS[appointment.status]

    if (!allowedTransitions || !allowedTransitions.includes(input.newStatus)) {
        return {
            success: false,
            error: `No se puede cambiar de "${appointment.status}" a "${input.newStatus}"`,
        }
    }

    const updated = await updateAppointmentRecord(supabase, input.organizationId, input.appointmentId, {
        status: input.newStatus,
        updated_at: new Date().toISOString(),
    })

    if (!updated) {
        return { success: false, error: "No se pudo actualizar la cita" }
    }

    if (appointment.google_event_id) {
        try {
            if (input.newStatus === "cancelled") {
                await cancelCalendarEvent(input.organizationId, appointment.google_event_id)
            } else if (input.newStatus === "confirmed") {
                await updateCalendarEvent(input.organizationId, appointment.google_event_id, {
                    description: "Estado: Confirmada",
                })
            }
        } catch (error) {
            log.warn("Calendar status sync failed", {
                organizationId: input.organizationId,
                appointmentId: input.appointmentId,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    return { success: true }
}

function getRelevantAdvisors(advisors: Advisor[], propertyType?: string): Advisor[] {
    if (advisors.length === 0) {
        return []
    }

    const specialty = resolveSpecialty(propertyType)
    return advisors.filter((advisor) => {
        if (advisor.specialty === "both") {
            return true
        }

        if (specialty === "both") {
            return true
        }

        return advisor.specialty === specialty
    })
}

function buildWorkingMinutes(dayDate: Date, advisors: Advisor[], slotStepMinutes: number): number[] {
    if (advisors.length === 0) {
        const minutes: number[] = []
        for (let minute = DEFAULT_DAY_START_HOUR * 60; minute < DEFAULT_DAY_END_HOUR * 60; minute += slotStepMinutes) {
            minutes.push(minute)
        }
        return minutes
    }

    const dayKey = DAY_KEYS[dayDate.getDay()]
    const slotMinutes = new Set<number>()

    for (const advisor of advisors) {
        const blocks = advisor.working_hours?.[dayKey]
        if (!blocks) {
            continue
        }

        for (const block of blocks) {
            const [startHour, startMinute] = block.start.split(":").map(Number)
            const [endHour, endMinute] = block.end.split(":").map(Number)
            const start = startHour * 60 + (startMinute || 0)
            const end = endHour * 60 + (endMinute || 0)

            for (let minute = start; minute < end; minute += slotStepMinutes) {
                slotMinutes.add(minute)
            }
        }
    }

    return Array.from(slotMinutes).sort((a, b) => a - b)
}

async function findPropertyByCode(
    supabase: SupabaseClient,
    organizationId: string,
    propertyCode?: string | null,
): Promise<PropertyLookupResult | null> {
    if (!propertyCode) {
        return null
    }

    const { data } = await supabase
        .from("properties")
        .select("id, title, address, neighborhood, city, property_type")
        .eq("organization_id", organizationId)
        .eq("external_code", propertyCode)
        .single()

    return (data as PropertyLookupResult | null) || null
}

function formatAdvisorSpecialty(specialty: Advisor["specialty"]): string {
    if (specialty === "sales") {
        return "ventas"
    }

    if (specialty === "rentals") {
        return "arriendos"
    }

    return "ambos"
}

function resolveSpecialty(propertyType?: string): Advisor["specialty"] {
    if (!propertyType) {
        return "both"
    }

    const normalized = propertyType.toLowerCase()
    if (normalized.includes("venta") && normalized.includes("arriendo")) {
        return "both"
    }
    if (normalized.includes("arriendo")) {
        return "rentals"
    }
    if (normalized.includes("venta")) {
        return "sales"
    }
    return "both"
}

function buildCalendarDescription(input: {
    customerName: string
    customerPhone: string | null
    propertyCode: string | null
    advisorName: string | null
    notes: string | null
}): string {
    const lines = [`Cita con ${input.customerName}`]

    if (input.customerPhone) {
        lines.push(`Teléfono: ${input.customerPhone}`)
    }

    if (input.propertyCode) {
        lines.push(`Propiedad: ${input.propertyCode}`)
    }

    if (input.advisorName) {
        lines.push(`Asesor: ${input.advisorName}`)
    }

    if (input.notes) {
        lines.push(input.notes)
    }

    return lines.join("\n")
}

function extractGoogleEventId(googleEventReference: string): string {
    const separatorIndex = googleEventReference.indexOf(":")
    return separatorIndex > -1 ? googleEventReference.slice(separatorIndex + 1) : googleEventReference
}

function getSingleRelation<T>(relation?: AppointmentRelation<T>): T | null {
    if (!relation) {
        return null
    }

    return Array.isArray(relation) ? relation[0] || null : relation
}
