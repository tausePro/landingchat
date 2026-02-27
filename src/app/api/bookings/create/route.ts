import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { createCalendarEvent } from "@/lib/calendar/google-calendar"
import { assignAdvisor } from "@/lib/advisors/assignment"

/**
 * POST /api/bookings/create
 * Endpoint público (sin auth) para crear una cita desde el storefront.
 * Body: { organizationId, propertyCode, proposedDate, customerName, customerPhone, customerEmail? }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { organizationId, propertyCode, proposedDate, customerName, customerPhone, customerEmail } = body

        if (!organizationId || !proposedDate || !customerName || !customerPhone) {
            return NextResponse.json(
                { error: "Faltan campos requeridos: organizationId, proposedDate, customerName, customerPhone" },
                { status: 400 }
            )
        }

        const startDate = new Date(proposedDate)
        if (isNaN(startDate.getTime())) {
            return NextResponse.json({ error: "Fecha inválida" }, { status: 400 })
        }

        // Validar que no sea en el pasado
        if (startDate < new Date()) {
            return NextResponse.json({ error: "No se puede agendar en el pasado" }, { status: 400 })
        }

        const supabase = createServiceClient()
        const DURATION_MINUTES = 60
        const endDate = new Date(startDate.getTime() + DURATION_MINUTES * 60 * 1000)

        // Buscar la propiedad si se envió propertyCode
        let propertyId: string | null = null
        let propertyTitle = ""
        let propertyAddress = ""

        if (propertyCode) {
            const { data: property } = await supabase
                .from("properties")
                .select("id, title, address, neighborhood, city")
                .eq("organization_id", organizationId)
                .eq("external_code", propertyCode)
                .single()

            if (property) {
                propertyId = property.id
                propertyTitle = property.title
                propertyAddress = [property.address, property.neighborhood, property.city].filter(Boolean).join(", ")
            }
        }

        // Asignar asesor automáticamente (si hay asesores configurados)
        let assignedAdvisor: Awaited<ReturnType<typeof assignAdvisor>> = null
        try {
            // Obtener tipo de propiedad para filtrar por especialidad
            let propType: string | undefined
            if (propertyId) {
                const { data: prop } = await supabase
                    .from("properties")
                    .select("property_type")
                    .eq("id", propertyId)
                    .single()
                propType = prop?.property_type
            }
            assignedAdvisor = await assignAdvisor(organizationId, startDate, propType)
        } catch {
            // tabla advisors puede no existir aún
        }

        // Verificar conflictos
        const { data: conflicts } = await supabase
            .from("appointments")
            .select("id")
            .eq("organization_id", organizationId)
            .in("status", ["pending", "confirmed"])
            .lt("proposed_date", endDate.toISOString())
            .gt("proposed_end_date", startDate.toISOString())

        if (conflicts && conflicts.length > 0) {
            return NextResponse.json(
                { error: "Este horario ya no está disponible. Por favor selecciona otro." },
                { status: 409 }
            )
        }

        // Crear la cita
        const title = propertyTitle
            ? `Visita ${propertyTitle}`
            : `Visita programada — ${customerName}`

        const insertData: Record<string, unknown> = {
            organization_id: organizationId,
            property_id: propertyId,
            title,
            appointment_type: "visit",
            status: "pending",
            proposed_date: startDate.toISOString(),
            proposed_end_date: endDate.toISOString(),
            duration_minutes: DURATION_MINUTES,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_email: customerEmail || null,
            location: propertyAddress || null,
            location_type: "in_person",
            metadata: {
                source: "storefront",
                property_code: propertyCode,
                ...(assignedAdvisor ? { advisor_name: assignedAdvisor.name } : {}),
            },
        }

        if (assignedAdvisor) {
            insertData.assigned_to = assignedAdvisor.id
        }

        const { data: appointment, error } = await supabase
            .from("appointments")
            .insert(insertData)
            .select("id")
            .single()

        if (error) {
            console.error("[bookings/create] DB error:", error)
            return NextResponse.json({ error: "Error creando la cita" }, { status: 500 })
        }

        // Google Calendar (non-blocking) — ruta al sub-calendario del asesor si existe
        try {
            const advisorCalId = assignedAdvisor?.google_calendar_id || undefined
            const googleEventId = await createCalendarEvent(organizationId, {
                title: assignedAdvisor ? `${title} — ${assignedAdvisor.name}` : title,
                description: `Cita desde web con ${customerName}\nTeléfono: ${customerPhone}${propertyCode ? `\nPropiedad: ${propertyCode}` : ""}${assignedAdvisor ? `\nAsesor: ${assignedAdvisor.name}` : ""}`,
                startDate,
                endDate,
                location: propertyAddress || undefined,
                attendeeEmail: customerEmail || undefined,
            }, advisorCalId)

            if (googleEventId) {
                await supabase
                    .from("appointments")
                    .update({ google_event_id: googleEventId })
                    .eq("id", appointment.id)
            }
        } catch (gcalError) {
            console.warn("[bookings/create] GCal sync failed:", gcalError)
        }

        // WhatsApp notification al admin (non-blocking)
        try {
            const { sendAppointmentNotification } = await import("@/lib/notifications/whatsapp")
            await sendAppointmentNotification(
                { organizationId },
                {
                    title,
                    customerName,
                    customerPhone,
                    proposedDate: startDate,
                    appointmentType: "visit",
                    location: propertyAddress || null,
                }
            )
        } catch (notifError) {
            console.warn("[bookings/create] WhatsApp notification failed:", notifError)
        }

        const dateFormatted = startDate.toLocaleDateString("es-CO", {
            weekday: "long", day: "numeric", month: "long"
        })
        const timeFormatted = startDate.toLocaleTimeString("es-CO", {
            hour: "2-digit", minute: "2-digit"
        })

        return NextResponse.json({
            success: true,
            appointment: {
                id: appointment.id,
                title,
                date: dateFormatted,
                time: timeFormatted,
                advisor: assignedAdvisor ? assignedAdvisor.name : null,
            },
            message: `Tu visita ha sido agendada para el ${dateFormatted} a las ${timeFormatted}.${assignedAdvisor ? ` Tu asesor será ${assignedAdvisor.name}.` : " Un asesor confirmará en breve."}`,
        })
    } catch (error) {
        console.error("[bookings/create] Error:", error)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}
