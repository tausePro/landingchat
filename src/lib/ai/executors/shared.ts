import { logger } from "@/lib/logger"
import {
    ConfirmShippingDetailsSchema,
    EscalateToHumanSchema,
    GetOrderStatusSchema,
    GetStoreInfoSchema,
    IdentifyCustomerSchema,
    ScheduleAppointmentSchema,
    SendMediaSchema,
} from "@/lib/ai/tools"
import type { ToolHandler } from "./types"

const log = logger("ai/tool-executor")

const identifyCustomer: ToolHandler = async (supabase, input, context) => {
    const { name, email, phone } = IdentifyCustomerSchema.parse(input)

    if (!email && !phone) {
        return {
            success: false,
            error: "Se necesita al menos email o teléfono para identificar al cliente"
        }
    }

    const { data: currentChat } = await supabase
        .from("chats")
        .select("channel, customer_id, whatsapp_chat_id, metadata")
        .eq("id", context.chatId)
        .single()

    const isSocialChannel = currentChat?.channel === "instagram" || currentChat?.channel === "messenger"
    const socialPlatformUserId = currentChat?.whatsapp_chat_id || currentChat?.metadata?.platform_user_id
    const shellCustomerId = currentChat?.customer_id

    let query = supabase
        .from("customers")
        .select("*, orders(id, total, status, created_at)")
        .eq("organization_id", context.organizationId)

    if (email) {
        query = query.eq("email", email)
    } else if (phone) {
        query = query.eq("phone", phone)
    }

    const { data: existingCustomer } = await query.single()

    if (existingCustomer) {
        const updateFields: Record<string, unknown> = {
            last_interaction_at: new Date().toISOString(),
        }

        if (isSocialChannel && socialPlatformUserId) {
            const idColumn = currentChat.channel === "instagram" ? "instagram_id" : "messenger_id"

            if (!existingCustomer[idColumn]) {
                updateFields[idColumn] = socialPlatformUserId
                log.info("Cross-channel merge", { idColumn, socialPlatformUserId, customerId: existingCustomer.id })
            }

            if (currentChat.channel === "instagram" && currentChat.metadata?.instagram_username) {
                const meta = existingCustomer.metadata || {}
                updateFields.metadata = { ...meta, instagram_username: currentChat.metadata.instagram_username }
            }
        }

        if (name && (!existingCustomer.full_name || existingCustomer.full_name.startsWith("IG User") || existingCustomer.full_name.startsWith("FB User"))) {
            updateFields.full_name = name
        }

        await supabase
            .from("customers")
            .update(updateFields)
            .eq("id", existingCustomer.id)

        await supabase
            .from("chats")
            .update({ customer_id: existingCustomer.id })
            .eq("id", context.chatId)

        if (shellCustomerId && shellCustomerId !== existingCustomer.id) {
            await supabase
                .from("chats")
                .update({ customer_id: existingCustomer.id })
                .eq("customer_id", shellCustomerId)
                .eq("organization_id", context.organizationId)

            const { data: shellOrders } = await supabase
                .from("orders")
                .select("id")
                .eq("customer_id", shellCustomerId)
                .limit(1)

            if (!shellOrders || shellOrders.length === 0) {
                await supabase
                    .from("customers")
                    .delete()
                    .eq("id", shellCustomerId)
                log.info("Deleted shell customer, merged", { shellCustomerId, mergedInto: existingCustomer.id })
            }
        }

        const lastOrder = existingCustomer.orders?.[0]

        return {
            success: true,
            data: {
                isReturning: true,
                crossChannelMerge: isSocialChannel && socialPlatformUserId ? true : false,
                customer: {
                    id: existingCustomer.id,
                    name: existingCustomer.full_name || name,
                    email: existingCustomer.email,
                    phone: existingCustomer.phone
                },
                stats: {
                    totalOrders: existingCustomer.total_orders || 0,
                    totalSpent: existingCustomer.total_spent || 0
                },
                lastOrder: lastOrder ? {
                    date: lastOrder.created_at,
                    total: lastOrder.total,
                    status: lastOrder.status
                } : null,
                preferences: existingCustomer.metadata || {}
            }
        }
    }

    if (shellCustomerId) {
        const updateFields: Record<string, unknown> = {
            full_name: name,
            email: email || null,
            phone: phone || null,
            last_interaction_at: new Date().toISOString(),
        }

        if (isSocialChannel && currentChat?.metadata?.instagram_username) {
            const { data: shellCustomer } = await supabase
                .from("customers")
                .select("metadata")
                .eq("id", shellCustomerId)
                .single()
            const meta = shellCustomer?.metadata || {}
            updateFields.metadata = { ...meta, instagram_username: currentChat.metadata.instagram_username }
        }

        const { data: updatedCustomer, error } = await supabase
            .from("customers")
            .update(updateFields)
            .eq("id", shellCustomerId)
            .select()
            .single()

        if (error) {
            return { success: false, error: `Error actualizando cliente: ${error.message}` }
        }

        return {
            success: true,
            data: {
                isReturning: false,
                customer: {
                    id: updatedCustomer.id,
                    name: updatedCustomer.full_name,
                    email: updatedCustomer.email,
                    phone: updatedCustomer.phone
                }
            }
        }
    }

    const { data: newCustomer, error } = await supabase
        .from("customers")
        .insert({
            organization_id: context.organizationId,
            full_name: name,
            email: email || null,
            phone: phone || null,
            last_interaction_at: new Date().toISOString()
        })
        .select()
        .single()

    if (error) {
        return { success: false, error: `Error creando cliente: ${error.message}` }
    }

    await supabase
        .from("chats")
        .update({ customer_id: newCustomer.id })
        .eq("id", context.chatId)

    return {
        success: true,
        data: {
            isReturning: false,
            customer: {
                id: newCustomer.id,
                name: newCustomer.full_name,
                email: newCustomer.email,
                phone: newCustomer.phone
            }
        }
    }
}

const getStoreInfo: ToolHandler = async (supabase, input, context) => {
    const { topic } = GetStoreInfoSchema.parse(input)

    const { data: org } = await supabase
        .from("organizations")
        .select("name, settings, contact_email")
        .eq("id", context.organizationId)
        .single()

    const settings = org?.settings || {}

    const info: any = {
        storeName: org?.name,
        contactEmail: org?.contact_email
    }

    switch (topic) {
        case "shipping":
            info.shipping = settings.shipping || {
                description: "Envíos a toda Colombia. Tiempo estimado: 3-5 días hábiles.",
                freeShippingThreshold: 100000
            }
            break
        case "returns":
            info.returns = settings.returns || {
                description: "30 días para devoluciones. Producto sin usar y con etiquetas originales."
            }
            break
        case "payment_methods":
            info.paymentMethods = settings.paymentMethods || [
                "Tarjeta de crédito/débito",
                "PSE",
                "Efectivo contra entrega (algunas ciudades)"
            ]
            break
        case "hours":
            info.hours = settings.hours || {
                description: "Atención por chat: Lunes a Viernes 8am-6pm, Sábados 9am-1pm"
            }
            break
        default:
            info.general = {
                shipping: "Envíos a toda Colombia",
                returns: "30 días para devoluciones",
                paymentMethods: ["Tarjeta", "PSE", "Efectivo"]
            }
    }

    return { success: true, data: info }
}

const getOrderStatus: ToolHandler = async (supabase, input, context) => {
    const { order_id, email } = GetOrderStatusSchema.parse(input)

    let query = supabase
        .from("orders")
        .select("id, status, total, items, created_at, shipping_cost, payment_method")
        .eq("organization_id", context.organizationId)

    if (order_id) {
        query = query.eq("id", order_id)
    } else if (email) {
        query = query.eq("customer_info->>email", email)
    } else if (context.customerId) {
        query = query.eq("customer_id", context.customerId).order("created_at", { ascending: false }).limit(1)
    } else {
        return { success: false, error: "Necesito el número de orden o el email usado en la compra" }
    }

    const { data: order, error } = await query.single()

    if (error || !order) {
        return { success: false, error: "No encontré esa orden. ¿Puedes verificar el número?" }
    }

    const statusMessages: Record<string, string> = {
        pending: "Pendiente de pago",
        paid: "Pago confirmado, preparando envío",
        shipped: "En camino",
        delivered: "Entregado",
        cancelled: "Cancelada"
    }

    return {
        success: true,
        data: {
            orderId: order.id,
            status: order.status,
            statusMessage: statusMessages[order.status] || order.status,
            total: order.total,
            itemCount: order.items?.length || 0,
            createdAt: order.created_at
        }
    }
}

const getCustomerHistory: ToolHandler = async (supabase, _input, context) => {
    if (!context.customerId) {
        return {
            success: true,
            data: {
                hasHistory: false,
                message: "Cliente no identificado aún"
            }
        }
    }

    const { data: customer } = await supabase
        .from("customers")
        .select("full_name, email, phone, metadata, total_orders, total_spent, document_type, document_number, person_type, business_name")
        .eq("id", context.customerId)
        .single()

    const { data: orders } = await supabase
        .from("orders")
        .select("id, items, total, status, created_at, customer_info")
        .eq("customer_id", context.customerId)
        .order("created_at", { ascending: false })
        .limit(5)

    const purchasedProducts = orders?.flatMap((o: any) => o.items?.map((i: any) => i.name)) || []
    const categories = [...new Set(purchasedProducts)]

    const lastOrder = orders?.[0]
    const lastShippingInfo = lastOrder?.customer_info ? {
        name: lastOrder.customer_info.name,
        email: lastOrder.customer_info.email,
        phone: lastOrder.customer_info.phone,
        address: lastOrder.customer_info.address,
        city: lastOrder.customer_info.city,
        state: lastOrder.customer_info.state,
        document_type: lastOrder.customer_info.document_type,
        document_number: lastOrder.customer_info.document_number,
        person_type: lastOrder.customer_info.person_type,
        business_name: lastOrder.customer_info.business_name
    } : null

    const customerAddress = customer?.metadata ? {
        address: customer.metadata.address,
        city: customer.metadata.city,
        state: customer.metadata.state
    } : null

    return {
        success: true,
        data: {
            hasHistory: true,
            customer: {
                name: customer?.full_name,
                email: customer?.email,
                phone: customer?.phone,
                totalOrders: customer?.total_orders || 0,
                totalSpent: customer?.total_spent || 0,
                documentType: customer?.document_type,
                documentNumber: customer?.document_number,
                personType: customer?.person_type,
                businessName: customer?.business_name
            },
            lastShippingInfo: lastShippingInfo,
            savedAddress: customerAddress,
            recentOrders: orders?.map((o: any) => ({
                id: o.id,
                date: o.created_at,
                total: o.total,
                status: o.status,
                itemCount: o.items?.length || 0
            })) || [],
            preferences: customer?.metadata || {},
            purchasedCategories: categories.slice(0, 5)
        }
    }
}

const confirmShippingDetails: ToolHandler = async (supabase, input, context) => {
    const validatedData = ConfirmShippingDetailsSchema.parse(input)

    const confirmation = {
        customer: {
            name: validatedData.customer_name,
            email: validatedData.email,
            phone: validatedData.phone,
            documentType: validatedData.document_type,
            documentNumber: validatedData.document_number,
            personType: validatedData.person_type,
            businessName: validatedData.business_name
        },
        shipping: {
            address: validatedData.address,
            city: validatedData.city,
            state: validatedData.state
        }
    }

    const { data: existingChat } = await supabase
        .from("chats")
        .select("metadata")
        .eq("id", context.chatId)
        .single()

    await supabase
        .from("chats")
        .update({
            metadata: {
                ...(existingChat?.metadata || {}),
                shippingDetails: confirmation,
                confirmed_shipping: {
                    customer_name: validatedData.customer_name,
                    email: validatedData.email,
                    phone: validatedData.phone,
                    address: validatedData.address,
                    city: validatedData.city,
                    state: validatedData.state,
                    document_type: validatedData.document_type || "CC",
                    document_number: validatedData.document_number,
                    person_type: validatedData.person_type || "Natural",
                    business_name: validatedData.business_name
                },
                confirmedAt: new Date().toISOString()
            }
        })
        .eq("id", context.chatId)

    return {
        success: true,
        data: {
            confirmed: true,
            details: confirmation,
            message: "Datos confirmados correctamente.",
            nextStep: "payment",
            instructions: "Ahora pregunta al cliente qué método de pago prefiere: Pago en línea (ePayco) o contra entrega. Luego usa 'create_payment_link' con el método elegido."
        }
    }
}

const escalateToHuman: ToolHandler = async (supabase, input, context) => {
    const { reason, priority } = EscalateToHumanSchema.parse(input)

    await supabase
        .from("chats")
        .update({
            status: "pending",
        })
        .eq("id", context.chatId)

    const { data: humanAgents } = await supabase
        .from("agents")
        .select("id, name")
        .eq("organization_id", context.organizationId)
        .eq("type", "human")
        .eq("status", "available")
        .limit(1)

    const assignedAgent = humanAgents?.[0]

    if (assignedAgent) {
        await supabase
            .from("chats")
            .update({ assigned_agent_id: assignedAgent.id })
            .eq("id", context.chatId)
    }

    return {
        success: true,
        data: {
            escalated: true,
            reason,
            priority,
            agentAssigned: assignedAgent?.name || null,
            message: assignedAgent
                ? `Te estoy transfiriendo con ${assignedAgent.name}. Un momento por favor.`
                : "He notificado a nuestro equipo. Te atenderán en breve."
        }
    }
}

const checkAvailability: ToolHandler = async (supabase, input, context) => {
    const { date, days_ahead = 1 } = input
    const daysToCheck = Math.min(Math.max(days_ahead, 1), 7)

    const startDate = new Date(date)
    if (isNaN(startDate.getTime())) {
        return { success: false, error: "Fecha inválida. Usa formato ISO 8601 (ej: 2026-02-27)" }
    }

    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(startDate.getTime() + daysToCheck * 24 * 60 * 60 * 1000)

    const DEFAULT_START = 9
    const DEFAULT_END = 18
    const SLOT_DURATION = 60

    const DAY_KEYS: Record<number, string> = {
        0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
        4: "thursday", 5: "friday", 6: "saturday",
    }

    let advisorNames: string[] = []
    let advisorWorkingHours: Record<string, Array<{ start: string; end: string }>> = {}
    let useAdvisors = false
    try {
        const { getAdvisors } = await import("@/lib/advisors/assignment")
        const advisors = await getAdvisors(context.organizationId)
        if (advisors.length > 0) {
            useAdvisors = true
            advisorNames = advisors.map(a => `${a.name} (${a.specialty === "sales" ? "ventas" : a.specialty === "rentals" ? "arriendos" : "ambos"})`)
            for (const advisor of advisors) {
                if (!advisor.working_hours) continue
                for (const [day, blocks] of Object.entries(advisor.working_hours)) {
                    if (!blocks || (blocks as any[]).length === 0) continue
                    if (!advisorWorkingHours[day]) advisorWorkingHours[day] = []
                    for (const block of (blocks as any[])) {
                        advisorWorkingHours[day].push(block)
                    }
                }
            }
        }
    } catch {
    }

    const { data: localAppointments } = await supabase
        .from("appointments")
        .select("id, title, proposed_date, proposed_end_date, status")
        .eq("organization_id", context.organizationId)
        .in("status", ["pending", "confirmed"])
        .gte("proposed_date", startDate.toISOString())
        .lte("proposed_date", endDate.toISOString())
        .order("proposed_date", { ascending: true })

    let gcalBusy: Array<{ start: string; end: string }> = []
    let gcalConnected = false
    try {
        const { getFreeBusySlots, isCalendarConnected } = await import("@/lib/calendar/google-calendar")
        gcalConnected = await isCalendarConnected(context.organizationId)
        if (gcalConnected) {
            const busy = await getFreeBusySlots(context.organizationId, startDate, endDate)
            if (busy) gcalBusy = busy
        }
    } catch (gcalError) {
        log.warn("GCal query failed", { error: gcalError instanceof Error ? gcalError.message : String(gcalError) })
    }

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

    const availabilityByDay: Array<{
        date: string
        dayName: string
        availableSlots: Array<{ start: string; end: string }>
        busyCount: number
    }> = []

    for (let d = 0; d < daysToCheck; d++) {
        const dayDate = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000)
        const dayStr = dayDate.toISOString().split("T")[0]
        const dayName = dayDate.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })

        if (dayDate.getDay() === 0) {
            availabilityByDay.push({ date: dayStr, dayName, availableSlots: [], busyCount: 0 })
            continue
        }

        const dayKey = DAY_KEYS[dayDate.getDay()]
        const dayBusy = busySlots.filter(b => b.start.toISOString().split("T")[0] === dayStr)

        let workMinutes = new Set<number>()

        if (useAdvisors && advisorWorkingHours[dayKey]) {
            for (const block of advisorWorkingHours[dayKey]) {
                const [sh, sm] = block.start.split(":").map(Number)
                const [eh, em] = block.end.split(":").map(Number)
                for (let m = sh * 60 + (sm || 0); m < eh * 60 + (em || 0); m += 60) {
                    workMinutes.add(m)
                }
            }
        } else {
            for (let h = DEFAULT_START; h < DEFAULT_END; h++) {
                workMinutes.add(h * 60)
            }
        }

        const sortedMinutes = Array.from(workMinutes).sort((a, b) => a - b)
        const available: Array<{ start: string; end: string }> = []

        for (const mins of sortedMinutes) {
            const slotStart = new Date(dayDate)
            slotStart.setHours(Math.floor(mins / 60), mins % 60, 0, 0)
            const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION * 60 * 1000)

            const isOccupied = dayBusy.some(b => slotStart < b.end && slotEnd > b.start)

            if (!isOccupied) {
                available.push({
                    start: slotStart.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
                    end: slotEnd.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
                })
            }
        }

        availabilityByDay.push({
            date: dayStr,
            dayName,
            availableSlots: available,
            busyCount: dayBusy.length,
        })
    }

    return {
        success: true,
        data: {
            googleCalendarConnected: gcalConnected,
            hasAdvisors: useAdvisors,
            advisors: advisorNames.length > 0 ? advisorNames : undefined,
            availability: availabilityByDay,
            totalAvailableSlots: availabilityByDay.reduce((sum, d) => sum + d.availableSlots.length, 0),
            tip: "Sugiere al cliente los horarios disponibles. Usa schedule_appointment con la fecha/hora que elija."
        }
    }
}

const scheduleAppointment: ToolHandler = async (supabase, input, context) => {
    const apptLog = log.withContext({ chatId: context.chatId, orgId: context.organizationId })
    apptLog.info("scheduleAppointment starting")

    let validated
    try {
        validated = ScheduleAppointmentSchema.parse(input)
    } catch (zodError: any) {
        apptLog.warn("Zod validation error", { error: zodError.message })
        return { success: false, error: `Datos incompletos para agendar: ${zodError.message}. Necesito al menos: título, fecha/hora y nombre del cliente.` }
    }

    apptLog.debug("Validated input", { title: validated.title, date: validated.proposed_date })

    const proposedDate = new Date(validated.proposed_date)
    if (isNaN(proposedDate.getTime())) {
        apptLog.warn("Invalid date", { date: validated.proposed_date })
        return { success: false, error: "Fecha inválida. Usa formato ISO 8601 (ej: 2025-02-20T10:00:00)" }
    }

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    if (proposedDate < yesterday) {
        apptLog.warn("Date in the past", { date: proposedDate.toISOString() })
        return { success: false, error: "No se puede agendar una cita en el pasado. Por favor sugiere una fecha futura." }
    }

    const endDate = new Date(proposedDate.getTime() + (validated.duration_minutes * 60 * 1000))

    const { data: conflicts } = await supabase
        .from("appointments")
        .select("id, title, proposed_date, proposed_end_date")
        .eq("organization_id", context.organizationId)
        .in("status", ["pending", "confirmed"])
        .lt("proposed_date", endDate.toISOString())
        .gt("proposed_end_date", proposedDate.toISOString())

    if (conflicts && conflicts.length > 0) {
        const conflictInfo = conflicts.map((c: any) => {
            const d = new Date(c.proposed_date)
            return `"${c.title}" el ${d.toLocaleDateString('es-CO')} a las ${d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
        }).join(", ")
        return {
            success: false,
            error: `Hay un conflicto de horario con: ${conflictInfo}. Por favor sugiere otra hora.`
        }
    }

    let propertyId: string | null = null
    let propertyAddress = validated.location || null
    let propertyType: string | undefined

    if (validated.property_code) {
        const { data: property } = await supabase
            .from("properties")
            .select("id, title, address, neighborhood, city, property_type")
            .eq("organization_id", context.organizationId)
            .eq("external_code", validated.property_code)
            .single()

        if (property) {
            propertyId = property.id
            propertyType = property.property_type
            if (!propertyAddress) {
                propertyAddress = [property.address, property.neighborhood, property.city].filter(Boolean).join(", ")
            }
            apptLog.debug("Linked to property", { propertyId: property.id, title: property.title })
        }
    }

    let assignedAdvisor: { id: string; name: string; google_calendar_id: string | null } | null = null
    try {
        const { assignAdvisor } = await import("@/lib/advisors/assignment")
        const advisor = await assignAdvisor(context.organizationId, proposedDate, propertyType)
        if (advisor) {
            assignedAdvisor = { id: advisor.id, name: advisor.name, google_calendar_id: advisor.google_calendar_id }
            apptLog.debug("Assigned to advisor", { advisorName: advisor.name })
        }
    } catch {
    }

    const insertData: Record<string, unknown> = {
        organization_id: context.organizationId,
        customer_id: context.customerId || null,
        chat_id: context.chatId,
        property_id: propertyId,
        title: validated.title,
        appointment_type: validated.appointment_type,
        status: "pending",
        proposed_date: proposedDate.toISOString(),
        proposed_end_date: endDate.toISOString(),
        duration_minutes: validated.duration_minutes,
        customer_name: validated.customer_name,
        customer_phone: validated.customer_phone || null,
        customer_email: validated.customer_email || null,
        location: propertyAddress,
        location_type: validated.location_type,
        notes: validated.notes || null,
        metadata: {
            ...(validated.property_code ? { property_code: validated.property_code } : {}),
            ...(assignedAdvisor ? { advisor_name: assignedAdvisor.name } : {}),
        }
    }

    if (assignedAdvisor) {
        insertData.assigned_to = assignedAdvisor.id
    }

    const { data: appointment, error } = await supabase
        .from("appointments")
        .insert(insertData)
        .select()
        .single()

    if (error) {
        apptLog.error("Error creating appointment", { error: error.message })
        return { success: false, error: `Error agendando la cita: ${error.message}` }
    }

    try {
        const { createCalendarEvent } = await import("@/lib/calendar/google-calendar")
        const advisorCalId = assignedAdvisor?.google_calendar_id || undefined
        const googleEventId = await createCalendarEvent(context.organizationId, {
            title: assignedAdvisor ? `${validated.title} — ${assignedAdvisor.name}` : validated.title,
            description: `Cita con ${validated.customer_name}${validated.property_code ? ` — Propiedad: ${validated.property_code}` : ""}${assignedAdvisor ? `\nAsesor: ${assignedAdvisor.name}` : ""}${validated.notes ? `\n${validated.notes}` : ""}`,
            startDate: proposedDate,
            endDate: endDate,
            location: propertyAddress || undefined,
            attendeeEmail: validated.customer_email,
        }, advisorCalId)

        if (googleEventId) {
            await supabase
                .from("appointments")
                .update({ google_event_id: googleEventId })
                .eq("id", appointment.id)
            apptLog.info("Google Calendar event created", { eventId: googleEventId, advisor: assignedAdvisor?.name })
        }
    } catch (gcalError) {
        apptLog.warn("Google Calendar sync failed (non-blocking)", { error: gcalError instanceof Error ? gcalError.message : String(gcalError) })
    }

    try {
        const { sendAppointmentNotification } = await import("@/lib/notifications/whatsapp")
        await sendAppointmentNotification(
            { organizationId: context.organizationId },
            {
                title: validated.title,
                customerName: validated.customer_name,
                customerPhone: validated.customer_phone,
                proposedDate: proposedDate,
                appointmentType: validated.appointment_type,
                location: validated.location,
            }
        )
    } catch (notifError) {
        apptLog.warn("WhatsApp notification failed (non-blocking)", { error: notifError instanceof Error ? notifError.message : String(notifError) })
    }

    const dateFormatted = proposedDate.toLocaleDateString('es-CO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
    const timeFormatted = proposedDate.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit'
    })

    const typeLabels: Record<string, string> = {
        visit: "Visita presencial",
        consultation: "Consulta",
        call: "Llamada",
        meeting: "Reunión"
    }

    return {
        success: true,
        data: {
            ui_component: "appointment_confirmation",
            appointment: {
                id: appointment.id,
                title: validated.title,
                type: typeLabels[validated.appointment_type] || validated.appointment_type,
                date: dateFormatted,
                time: timeFormatted,
                duration: `${validated.duration_minutes} minutos`,
                location: propertyAddress || validated.location || "Por confirmar",
                locationType: validated.location_type,
                customerName: validated.customer_name,
                advisor: assignedAdvisor?.name || null,
                status: "pending"
            },
            message: `Cita agendada: "${validated.title}" para el ${dateFormatted} a las ${timeFormatted}.${assignedAdvisor ? ` Tu asesor será ${assignedAdvisor.name}.` : ""}`,
            nextStep: assignedAdvisor
                ? `${assignedAdvisor.name} te atenderá. La cita queda pendiente de confirmación.`
                : "La cita queda pendiente de confirmación. El equipo se comunicará para confirmar."
        }
    }
}

const sendMedia: ToolHandler = async (supabase, input, context) => {
    const { media_id, context_message } = SendMediaSchema.parse(input)

    const { data: media, error } = await supabase
        .from("organization_media")
        .select("id, name, description, file_url, file_type, file_name, media_category, usage_count")
        .eq("id", media_id)
        .eq("organization_id", context.organizationId)
        .eq("is_active", true)
        .single()

    if (error || !media) {
        log.warn("sendMedia: media not found", { mediaId: media_id, error: error?.message })
        return { success: false, error: "Archivo no encontrado o no disponible." }
    }

    supabase
        .from("organization_media")
        .update({ usage_count: media.usage_count + 1 || 1 })
        .eq("id", media_id)
        .then(
            () => log.debug("sendMedia: usage count updated"),
            (e: any) => log.warn("sendMedia: failed to update usage count", { error: e?.message })
        )

    log.info("sendMedia: sending", { name: media.name, type: media.file_type })

    const categoryMap: Record<string, string> = {
        document: "document_attachment",
        audio: "audio_attachment",
        image: "image_attachment",
        video: "video_attachment",
        catalog: "document_attachment"
    }

    return {
        success: true,
        data: {
            ui_component: categoryMap[media.media_category] || "document_attachment",
            media: {
                id: media.id,
                name: media.name,
                description: media.description,
                file_url: media.file_url,
                file_type: media.file_type,
                file_name: media.file_name,
                category: media.media_category
            },
            context_message: context_message || `Aquí tienes: ${media.name}`,
            message: `Archivo enviado: ${media.name}`
        }
    }
}

export const sharedToolHandlers: Record<string, ToolHandler> = {
    identify_customer: identifyCustomer,
    get_store_info: getStoreInfo,
    get_order_status: getOrderStatus,
    get_customer_history: getCustomerHistory,
    confirm_shipping_details: confirmShippingDetails,
    escalate_to_human: escalateToHuman,
    check_availability: checkAvailability,
    schedule_appointment: scheduleAppointment,
    send_media: sendMedia,
}
