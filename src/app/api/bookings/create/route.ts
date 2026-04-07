import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { createManagedAppointment } from "@/lib/appointments/service"
import { formatAppointmentDateTime } from "@/lib/appointments/appointmentDateTime"
import { bookingsRateLimit, getClientIdentifier, getRateLimitHeaders } from "@/lib/rate-limit"
import { resolvePublicOrganization } from "@/lib/storefront/resolvePublicOrganization"

/**
 * POST /api/bookings/create
 * Endpoint público (sin auth) para crear una cita desde el storefront.
 * Body: { organizationId, propertyCode, proposedDate, customerName, customerPhone, customerEmail? }
 */
export async function POST(request: NextRequest) {
    // Rate limiting: 3 citas por minuto por IP
    const clientId = getClientIdentifier(request)
    const rateLimitResult = await bookingsRateLimit.limit(clientId)
    const headers = getRateLimitHeaders(rateLimitResult)

    if (!rateLimitResult.success) {
        return NextResponse.json(
            { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
            { status: 429, headers }
        )
    }

    try {
        const body = await request.json()
        const { organizationId, slug, propertyCode, proposedDate, customerName, customerPhone, customerEmail } = body

        if ((!organizationId && !slug) || !proposedDate || !customerName || !customerPhone) {
            return NextResponse.json(
                { error: "Faltan campos requeridos: slug u organizationId, proposedDate, customerName, customerPhone" },
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
        const organization = await resolvePublicOrganization(supabase, { slug, organizationId })

        if (!organization) {
            return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 })
        }

        const result = await createManagedAppointment(supabase, {
            organizationId: organization.id,
            proposedDate: startDate,
            durationMinutes: 60,
            appointmentType: "visit",
            locationType: "in_person",
            customerName,
            customerPhone,
            customerEmail: customerEmail || null,
            propertyCode: propertyCode || null,
            metadata: {
                source: "storefront",
            },
        })

        if (!result.success) {
            if (result.code === "conflict") {
                return NextResponse.json(
                    { error: "Este horario ya no está disponible. Por favor selecciona otro." },
                    { status: 409 }
                )
            }

            if (result.code === "invalid_date" || result.code === "past_date") {
                return NextResponse.json({ error: result.error }, { status: 400 })
            }

            return NextResponse.json({ error: result.error }, { status: 500 })
        }

        const dateFormatted = formatAppointmentDateTime(startDate, {
            weekday: "long", day: "numeric", month: "long"
        })
        const timeFormatted = formatAppointmentDateTime(startDate, {
            hour: "2-digit", minute: "2-digit"
        })

        return NextResponse.json({
            success: true,
            appointment: {
                id: result.appointment.id,
                title: result.appointment.title,
                date: dateFormatted,
                time: timeFormatted,
                advisor: result.assignedAdvisor ? result.assignedAdvisor.name : null,
            },
            message: `Tu visita ha sido agendada para el ${dateFormatted} a las ${timeFormatted}.${result.assignedAdvisor ? ` Tu asesor será ${result.assignedAdvisor.name}.` : " Un asesor confirmará en breve."}`,
        })
    } catch (error) {
        console.error("[bookings/create] Error:", error)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}
