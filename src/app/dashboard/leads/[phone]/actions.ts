"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface AdvisorOption {
    id: string
    name: string
    specialty: string
    color: string
}

/**
 * Obtiene los asesores disponibles para el selector.
 */
export async function getOrgAdvisorsForSelect(): Promise<AdvisorOption[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) return []

    const { data } = await supabase
        .from("advisors")
        .select("id, name, specialty, color")
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true)
        .order("name")

    return (data || []) as AdvisorOption[]
}

/**
 * Asigna un asesor a todas las citas de un lead (por teléfono).
 */
export async function assignAdvisorToLead(phone: string, advisorId: string | null) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "No autorizado" }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) return { success: false, error: "Sin organización" }

    // Actualizar todas las citas pendientes/confirmadas de este lead
    const { error } = await supabase
        .from("appointments")
        .update({ assigned_to: advisorId })
        .eq("organization_id", profile.organization_id)
        .or(`customer_phone.eq.${phone},customer_phone.eq.+${phone},customer_phone.ilike.%${phone.replace(/^\+/, "").slice(-10)}%`)
        .in("status", ["pending", "confirmed"])

    if (error) return { success: false, error: error.message }

    revalidatePath(`/dashboard/leads/${encodeURIComponent(phone)}`)
    revalidatePath("/dashboard/leads")
    revalidatePath("/dashboard/appointments")
    return { success: true }
}

export interface LeadDetail {
    phone: string
    name: string
    email: string | null
    status: string
    customerId: string | null
    notes: string | null
    advisorName: string | null
    advisorColor: string | null
    createdAt: string | null
    appointments: Array<{
        id: string
        title: string
        status: string
        proposedDate: string
        propertyCode: string | null
        propertyTitle: string | null
        advisorName: string | null
        advisorColor: string | null
        location: string | null
        customerPhone: string | null
    }>
    chats: Array<{
        id: string
        channel: string
        createdAt: string
        updatedAt: string
        messageCount: number
    }>
    properties: Array<{
        code: string
        title: string
        propertyType: string | null
        city: string | null
        priceRent: number | null
        priceSale: number | null
        imageUrl: string | null
    }>
}

/**
 * Obtiene el detalle completo de un lead por teléfono.
 */
export async function getLeadDetail(phone: string): Promise<LeadDetail | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) return null
    const orgId = profile.organization_id

    // Buscar customer por teléfono
    const { data: customer } = await supabase
        .from("customers")
        .select("id, full_name, email, phone, metadata, created_at")
        .eq("organization_id", orgId)
        .or(`phone.eq.${phone},phone.eq.+${phone}`)
        .single()

    // Buscar citas por teléfono (con o sin +)
    const { data: appointments } = await supabase
        .from("appointments")
        .select("id, title, status, proposed_date, customer_name, customer_phone, customer_email, location, property_id, assigned_to, properties(external_code, title, property_type, city, price_rent, price_sale, images), advisors(name, color)")
        .eq("organization_id", orgId)
        .or(`customer_phone.eq.${phone},customer_phone.eq.+${phone},customer_phone.ilike.%${phone.replace(/^\+/, "").slice(-10)}%`)
        .order("proposed_date", { ascending: false })

    // Buscar chats del customer
    let chats: any[] = []
    if (customer?.id) {
        const { data: chatData } = await supabase
            .from("chats")
            .select("id, channel, created_at, updated_at, messages(id)")
            .eq("organization_id", orgId)
            .eq("customer_id", customer.id)
            .order("updated_at", { ascending: false })
            .limit(20)

        chats = (chatData || []).map(c => ({
            id: c.id,
            channel: c.channel || "web",
            createdAt: c.created_at,
            updatedAt: c.updated_at,
            messageCount: (c.messages as any[])?.length || 0,
        }))
    }

    // Extraer propiedades únicas de las citas
    const propertyMap = new Map<string, LeadDetail["properties"][0]>()
    for (const apt of (appointments || [])) {
        const prop = apt.properties as any
        if (prop?.external_code && !propertyMap.has(prop.external_code)) {
            const img = prop.images?.[0]?.url || null
            propertyMap.set(prop.external_code, {
                code: prop.external_code,
                title: prop.title || "",
                propertyType: prop.property_type || null,
                city: prop.city || null,
                priceRent: prop.price_rent,
                priceSale: prop.price_sale,
                imageUrl: img,
            })
        }
    }

    // Determinar nombre y datos del lead
    const name = customer?.full_name || appointments?.[0]?.customer_name || "Sin nombre"
    const email = customer?.email || appointments?.[0]?.customer_email || null
    const firstAdvisor = appointments?.find(a => (a.advisors as any)?.name)?.advisors as any

    // Determinar status
    const meta = customer?.metadata as any
    let status = meta?.lead_status || "new"
    if (status === "new") {
        const hasCompleted = appointments?.some(a => a.status === "completed")
        const hasScheduled = appointments?.some(a => a.status === "pending" || a.status === "confirmed")
        if (hasCompleted) status = "visited"
        else if (hasScheduled) status = "visit_scheduled"
    }

    return {
        phone,
        name,
        email,
        status,
        customerId: customer?.id || null,
        notes: meta?.lead_notes || null,
        advisorName: firstAdvisor?.name || null,
        advisorColor: firstAdvisor?.color || null,
        createdAt: customer?.created_at || appointments?.[0]?.proposed_date || null,
        appointments: (appointments || []).map(apt => {
            const prop = apt.properties as any
            const advisor = apt.advisors as any
            return {
                id: apt.id,
                title: apt.title,
                status: apt.status,
                proposedDate: apt.proposed_date,
                propertyCode: prop?.external_code || null,
                propertyTitle: prop?.title || null,
                advisorName: advisor?.name || null,
                advisorColor: advisor?.color || null,
                location: apt.location,
                customerPhone: apt.customer_phone,
            }
        }),
        chats,
        properties: Array.from(propertyMap.values()),
    }
}

/**
 * Actualiza el estado y notas de un lead.
 */
export async function updateLead(phone: string, updates: {
    status?: string
    notes?: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "No autorizado" }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) return { success: false, error: "Sin organización" }

    // Buscar customer
    const { data: customer } = await supabase
        .from("customers")
        .select("id, metadata")
        .eq("organization_id", profile.organization_id)
        .or(`phone.eq.${phone},phone.eq.+${phone}`)
        .single()

    if (customer) {
        const currentMeta = (customer.metadata as object) || {}
        const newMeta: Record<string, unknown> = { ...currentMeta }

        if (updates.status) {
            newMeta.lead_status = updates.status
            newMeta.lead_status_updated_at = new Date().toISOString()
        }
        if (updates.notes !== undefined) {
            newMeta.lead_notes = updates.notes
        }

        await supabase
            .from("customers")
            .update({ metadata: newMeta })
            .eq("id", customer.id)
    } else if (updates.status || updates.notes !== undefined) {
        // Si no hay customer aún, crearlo con metadata de lead
        const aptData = await supabase
            .from("appointments")
            .select("customer_name, customer_email")
            .eq("organization_id", profile.organization_id)
            .or(`customer_phone.eq.${phone},customer_phone.eq.+${phone}`)
            .limit(1)
            .single()

        await supabase
            .from("customers")
            .insert({
                organization_id: profile.organization_id,
                full_name: aptData.data?.customer_name || "Lead",
                phone: phone,
                email: aptData.data?.customer_email || null,
                acquisition_channel: "chat",
                metadata: {
                    lead_status: updates.status || "new",
                    lead_notes: updates.notes || null,
                    lead_status_updated_at: new Date().toISOString(),
                },
            })
    }

    revalidatePath(`/dashboard/leads/${encodeURIComponent(phone)}`)
    revalidatePath("/dashboard/leads")
    return { success: true }
}
