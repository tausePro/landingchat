import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { getAppointmentAvailability } from "@/lib/appointments/service"
import { resolvePublicOrganization } from "@/lib/storefront/resolvePublicOrganization"

/**
 * POST /api/bookings/availability
 * Endpoint público (sin auth) para consultar disponibilidad desde el storefront.
 * Body: { organizationId, date, daysAhead?, propertyType? }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { organizationId, slug, date, daysAhead = 7, propertyType } = body

        if ((!organizationId && !slug) || !date) {
            return NextResponse.json({ error: "slug u organizationId y date son requeridos" }, { status: 400 })
        }

        const daysToCheck = Math.min(Math.max(daysAhead, 1), 14)
        const startDate = new Date(date)
        if (isNaN(startDate.getTime())) {
            return NextResponse.json({ error: "Fecha inválida" }, { status: 400 })
        }

        startDate.setHours(0, 0, 0, 0)

        const supabase = createServiceClient()
        const organization = await resolvePublicOrganization(supabase, { slug, organizationId })

        if (!organization) {
            return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 })
        }

        const availabilityResult = await getAppointmentAvailability(supabase, {
            organizationId: organization.id,
            date: startDate,
            daysAhead: daysToCheck,
            propertyType,
            slotDurationMinutes: 90,
            slotStepMinutes: 30,
            includeEmptyDays: false,
            skipSundays: true,
        })

        return NextResponse.json({
            availability: availabilityResult.availability.map((day) => ({
                date: day.date,
                dayName: day.dayName,
                slots: day.slots.map((slot) => ({
                    time: slot.time,
                    isoDate: slot.isoDate,
                })),
            })),
            googleCalendarConnected: availabilityResult.googleCalendarConnected,
            hasAdvisors: availabilityResult.hasAdvisors,
        })
    } catch (error) {
        console.error("[bookings/availability] Error:", error)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}
