import { logger } from "@/lib/logger"
import { createManagedAppointment, getAppointmentAvailability } from "@/lib/appointments/service"
import { createAppointmentDate, formatAppointmentDateTime } from "@/lib/appointments/appointmentDateTime"
import {
    ConfirmShippingDetailsSchema,
    EscalateToHumanSchema,
    GetOrderStatusSchema,
    GetStoreInfoSchema,
    IdentifyCustomerSchema,
    ScheduleAppointmentSchema,
    SendMediaSchema,
} from "@/lib/ai/tools"
import type { ToolHandler, ToolSupabaseClient } from "./types"
import { getProviderDisplay } from "@/lib/payments/provider-display"

const log = logger("ai/tool-executor")

type StoreInfoData = Record<string, unknown>

interface OrderHistoryItem {
    name?: string | null
}

interface OrderHistoryCustomerInfo {
    name?: string | null
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    document_type?: string | null
    document_number?: string | null
    person_type?: string | null
    business_name?: string | null
}

interface OrderHistoryRow {
    id: string
    items?: OrderHistoryItem[] | null
    total?: number | null
    status?: string | null
    created_at: string
    customer_info?: OrderHistoryCustomerInfo | null
}

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

/**
 * Métodos de pago REALES del tenant: pasarelas activas + métodos manuales
 * (transferencia, pago instantáneo tipo Zelle solo si está completo, COD).
 * Caso real que motivó esto (2026-06-11): el agente de Tantor inventó una
 * plantilla de datos Zelle con placeholders porque este tool devolvía
 * defaults hardcodeados que no eran del tenant.
 */
async function loadRealPaymentMethods(
    supabase: ToolSupabaseClient,
    organizationId: string
): Promise<Record<string, unknown>> {
    const [gatewaysRes, manualRes] = await Promise.all([
        supabase
            .from("payment_gateway_configs")
            .select("provider")
            .eq("organization_id", organizationId)
            .eq("is_active", true),
        supabase
            .from("manual_payment_methods")
            .select("bank_transfer_enabled, bank_name, account_type, account_number, account_holder, instant_payment_label, instant_payment_value, nequi_number, instructions, cod_enabled, cod_additional_cost")
            .eq("organization_id", organizationId)
            .maybeSingle(),
    ])

    const methods: Array<Record<string, unknown>> = []

    for (const row of (gatewaysRes.data ?? []) as Array<{ provider: string }>) {
        const display = getProviderDisplay(row.provider)
        methods.push({ type: "online", name: display.label, accepts: display.description })
    }

    const manual = manualRes.data
    if (manual?.bank_transfer_enabled) {
        const transfer: Record<string, unknown> = {
            type: "bank_transfer",
            bank: manual.bank_name,
            account_type: manual.account_type,
            account_number: manual.account_number,
            account_holder: manual.account_holder,
        }
        // Pago instantáneo (Zelle, Nequi, CashApp...): SOLO si está completo
        if (manual.instant_payment_label && manual.instant_payment_value) {
            transfer.instant_payment = {
                service: manual.instant_payment_label,
                account: manual.instant_payment_value,
            }
        } else if (manual.nequi_number) {
            transfer.instant_payment = { service: "Nequi", account: manual.nequi_number }
        }
        if (manual.instructions) transfer.merchant_instructions = manual.instructions
        methods.push(transfer)
    }

    if (manual?.cod_enabled) {
        methods.push({
            type: "cash_on_delivery",
            additional_cost: manual.cod_additional_cost ?? 0,
        })
    }

    return {
        methods,
        configured: methods.length > 0,
        instructions: methods.length > 0
            ? "Usa SOLO estos datos de pago. Si el cliente pide un dato que no aparece aquí (ej. cuenta de Zelle no listada), di honestamente que no lo tienes configurado y ofrece confirmarlo con el equipo. NUNCA inventes números de cuenta, correos ni nombres de titular."
            : "No hay métodos de pago configurados en el sistema. Dile al cliente que el equipo le confirmará los medios de pago disponibles. NUNCA inventes datos de pago.",
    }
}

/** Envíos y devoluciones REALES desde shipping_settings (misma fuente que el storefront). */
async function loadRealShippingSettings(supabase: ToolSupabaseClient, organizationId: string) {
    const { data } = await supabase
        .from("shipping_settings")
        .select("free_shipping_enabled, free_shipping_min_amount, default_shipping_rate, estimated_delivery_days, express_delivery_days, returns_accepted, return_window_days, return_fees")
        .eq("organization_id", organizationId)
        .maybeSingle()
    return data
}

const getStoreInfo: ToolHandler = async (supabase, input, context) => {
    const { topic } = GetStoreInfoSchema.parse(input)

    const { data: org } = await supabase
        .from("organizations")
        .select("name, settings, contact_email")
        .eq("id", context.organizationId)
        .single()

    const settings = org?.settings || {}

    const info: StoreInfoData = {
        storeName: org?.name,
        contactEmail: org?.contact_email
    }

    switch (topic) {
        case "shipping": {
            const shipping = await loadRealShippingSettings(supabase, context.organizationId)
            info.shipping = shipping
                ? {
                    standard_rate: shipping.default_shipping_rate,
                    estimated_delivery_days: shipping.estimated_delivery_days,
                    express_delivery_days: shipping.express_delivery_days,
                    free_shipping: shipping.free_shipping_enabled
                        ? { enabled: true, min_amount: shipping.free_shipping_min_amount }
                        : { enabled: false },
                }
                : { configured: false, instructions: "Envíos no configurados — dile al cliente que el equipo le confirmará tiempos y costos. No inventes tarifas ni tiempos." }
            break
        }
        case "returns": {
            const shipping = await loadRealShippingSettings(supabase, context.organizationId)
            if (shipping?.returns_accepted === true && shipping.return_window_days) {
                info.returns = {
                    accepted: true,
                    window_days: shipping.return_window_days,
                    return_shipping_paid_by: shipping.return_fees === "free" ? "la tienda" : shipping.return_fees === "customer" ? "el cliente" : null,
                }
            } else if (shipping?.returns_accepted === false) {
                info.returns = { accepted: false }
            } else {
                info.returns = { configured: false, instructions: "Política de devoluciones no configurada — dile al cliente que el equipo le confirmará. No inventes plazos ni condiciones." }
            }
            break
        }
        case "payment_methods":
            info.paymentMethods = await loadRealPaymentMethods(supabase, context.organizationId)
            break
        case "hours":
            info.hours = settings.hours || {
                configured: false,
                instructions: "Horario de atención no configurado — no inventes horarios; el chat AI responde 24/7 y el equipo humano confirma su disponibilidad."
            }
            break
        default: {
            const [paymentMethods, shipping] = await Promise.all([
                loadRealPaymentMethods(supabase, context.organizationId),
                loadRealShippingSettings(supabase, context.organizationId),
            ])
            info.general = {
                paymentMethods,
                shipping: shipping ?? { configured: false },
                instructions: "Usa SOLO los datos configurados. Lo que no esté aquí, confírmalo con el equipo en vez de inventarlo.",
            }
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

    const orderRows = (orders || []) as OrderHistoryRow[]
    const purchasedProducts = orderRows.flatMap((order) =>
        (order.items || [])
            .map((item) => item.name)
            .filter((name): name is string => Boolean(name))
    )
    const categories = [...new Set(purchasedProducts)]

    const lastOrder = orderRows[0]
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
            recentOrders: orderRows.map((order) => ({
                id: order.id,
                date: order.created_at,
                total: order.total,
                status: order.status,
                itemCount: order.items?.length || 0
            })),
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

    const startDate = new Date(date)
    if (isNaN(startDate.getTime())) {
        return { success: false, error: "Fecha inválida. Usa formato ISO 8601 (ej: 2026-02-27)" }
    }

    startDate.setHours(0, 0, 0, 0)

    const availabilityResult = await getAppointmentAvailability(supabase, {
        organizationId: context.organizationId,
        date: startDate,
        daysAhead: Math.min(Math.max(days_ahead, 1), 7),
        slotDurationMinutes: 60,
        slotStepMinutes: 60,
        includeEmptyDays: true,
        skipSundays: false,
    })

    const availabilityByDay = availabilityResult.availability.map((day) => ({
        date: day.date,
        dayName: day.dayName,
        availableSlots: day.slots.map((slot) => ({
            start: formatAppointmentDateTime(slot.isoDate, { hour: "2-digit", minute: "2-digit" }),
            end: formatAppointmentDateTime(slot.endIsoDate, { hour: "2-digit", minute: "2-digit" }),
        })),
        busyCount: day.busyCount,
    }))

    return {
        success: true,
        data: {
            googleCalendarConnected: availabilityResult.googleCalendarConnected,
            hasAdvisors: availabilityResult.hasAdvisors,
            advisors: availabilityResult.advisors.length > 0 ? availabilityResult.advisors : undefined,
            availability: availabilityByDay,
            totalAvailableSlots: availabilityByDay.reduce((sum, d) => sum + d.availableSlots.length, 0),
            tip: "Sugiere al cliente los horarios disponibles. Usa schedule_appointment con la fecha/hora que elija."
        }
    }
}

const scheduleAppointment: ToolHandler = async (supabase, input, context) => {
    const apptLog = log.withContext({ chatId: context.chatId, orgId: context.organizationId })
    apptLog.info("scheduleAppointment starting")

    let validated: ReturnType<typeof ScheduleAppointmentSchema.parse>
    try {
        validated = ScheduleAppointmentSchema.parse(input)
    } catch (zodError: unknown) {
        const errorMessage = zodError instanceof Error ? zodError.message : "Datos inválidos"
        apptLog.warn("Zod validation error", { error: errorMessage })
        return { success: false, error: `Datos incompletos para agendar: ${errorMessage}. Necesito al menos: título, fecha/hora y nombre del cliente.` }
    }

    apptLog.debug("Validated input", { title: validated.title, date: validated.proposed_date })

    // Interpretar la fecha como hora Colombia (America/Bogota), no como UTC
    // El AI genera "2026-04-14T10:00:00" queriendo decir 10am Colombia,
    // pero new Date() lo interpreta como UTC (5am Colombia)
    let proposedDate: Date
    const rawDate = validated.proposed_date
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(rawDate)
    if (dateMatch) {
        const dateKey = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
        const hour = parseInt(dateMatch[4], 10)
        const minute = parseInt(dateMatch[5], 10)
        proposedDate = createAppointmentDate(dateKey, hour, minute)
        apptLog.debug("Date interpreted as Colombia time", { raw: rawDate, interpreted: proposedDate.toISOString() })
    } else {
        proposedDate = new Date(rawDate)
    }

    if (isNaN(proposedDate.getTime())) {
        apptLog.warn("Invalid date", { date: rawDate })
        return { success: false, error: "Fecha inválida. Usa formato ISO 8601 (ej: 2025-02-20T10:00:00)" }
    }

    const result = await createManagedAppointment(supabase, {
        organizationId: context.organizationId,
        title: validated.title,
        proposedDate,
        durationMinutes: validated.duration_minutes,
        appointmentType: validated.appointment_type,
        location: validated.location || null,
        locationType: validated.location_type,
        customerName: validated.customer_name,
        customerPhone: validated.customer_phone || null,
        customerEmail: validated.customer_email || null,
        notes: validated.notes || null,
        propertyCode: validated.property_code || null,
        customerId: context.customerId || null,
        chatId: context.chatId,
    })

    if (!result.success) {
        if (result.code === "conflict") {
            const conflictInfo = result.conflicts.map((conflict) => {
                const conflictDate = new Date(conflict.proposed_date)
                return `"${conflict.title}" el ${formatAppointmentDateTime(conflictDate, { day: "numeric", month: "numeric", year: "numeric" })} a las ${formatAppointmentDateTime(conflictDate, { hour: "2-digit", minute: "2-digit" })}`
            }).join(", ")

            return {
                success: false,
                error: `Hay un conflicto de horario con: ${conflictInfo}. Por favor sugiere otra hora.`
            }
        }

        if (result.code === "past_date") {
            apptLog.warn("Date in the past", { date: proposedDate.toISOString() })
            return { success: false, error: "No se puede agendar una cita en el pasado. Por favor sugiere una fecha futura." }
        }

        return { success: false, error: `Error agendando la cita: ${result.error}` }
    }

    const appointment = result.appointment
    const assignedAdvisor = result.assignedAdvisor

    const dateFormatted = formatAppointmentDateTime(proposedDate, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
    const timeFormatted = formatAppointmentDateTime(proposedDate, {
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
                title: appointment.title,
                type: typeLabels[validated.appointment_type] || validated.appointment_type,
                date: dateFormatted,
                time: timeFormatted,
                duration: `${appointment.durationMinutes} minutos`,
                location: appointment.location || validated.location || "Por confirmar",
                locationType: appointment.locationType,
                customerName: validated.customer_name,
                advisor: assignedAdvisor?.name || null,
                status: appointment.status
            },
            message: `Cita agendada: "${appointment.title}" para el ${dateFormatted} a las ${timeFormatted}.${assignedAdvisor ? ` Tu asesor será ${assignedAdvisor.name}.` : ""}`,
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
            (e: unknown) => log.warn("sendMedia: failed to update usage count", { error: e instanceof Error ? e.message : String(e) })
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
