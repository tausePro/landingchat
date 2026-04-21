"use server"

import { createClient } from "@/lib/supabase/server"
import { formatBogotaDayKey } from "@/lib/utils/date"

export interface Lead {
    id: string
    name: string
    phone: string | null
    email: string | null
    source: "appointment" | "chat" | "storefront"
    status: "new" | "contacted" | "visit_scheduled" | "visited" | "negotiating" | "closed" | "lost"
    lastActivity: string
    lastActivityLabel: string
    appointmentCount: number
    chatCount: number
    properties: Array<{ code: string; title: string }>
    advisorName: string | null
    advisorColor: string | null
    customerId: string | null
}

export interface LeadStats {
    total: number
    new: number
    visitScheduled: number
    visited: number
    negotiating: number
    closed: number
}

/**
 * Obtiene los leads de la organización.
 * Un lead se construye unificando datos de:
 * - Citas (appointments) → por customer_phone
 * - Chats (chats) → por customer vinculado
 */
export async function getLeads(params?: {
    search?: string
    status?: string
    page?: number
}): Promise<{ leads: Lead[]; stats: LeadStats }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { leads: [], stats: emptyStats() }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) return { leads: [], stats: emptyStats() }

    const orgId = profile.organization_id

    // 1. Obtener todas las citas con propiedad y asesor
    const { data: appointments } = await supabase
        .from("appointments")
        .select("id, customer_name, customer_phone, customer_email, customer_id, status, proposed_date, created_at, property_id, assigned_to, properties(external_code, title), advisors(name, color)")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })

    // 2. Obtener chats con customer vinculado (solo real estate)
    const { data: chats } = await supabase
        .from("chats")
        .select("id, customer_id, channel, created_at, updated_at, metadata, customers(id, full_name, phone, email)")
        .eq("organization_id", orgId)
        .not("customer_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(200)

    // 3. Unificar por teléfono (misma lógica de identificación que e-commerce)
    const leadMap = new Map<string, Lead>()

    // Procesar citas
    for (const apt of (appointments || [])) {
        const phone = normalizePhone(apt.customer_phone)
        const key = phone || `apt-${apt.id}`
        const prop = apt.properties as any
        const advisor = apt.advisors as any

        if (leadMap.has(key)) {
            const existing = leadMap.get(key)!
            existing.appointmentCount++
            if (prop?.external_code) {
                const alreadyHas = existing.properties.some(p => p.code === prop.external_code)
                if (!alreadyHas) {
                    existing.properties.push({ code: prop.external_code, title: prop.title || "" })
                }
            }
            if (!existing.advisorName && advisor?.name) {
                existing.advisorName = advisor.name
                existing.advisorColor = advisor.color
            }
            if (!existing.email && apt.customer_email) {
                existing.email = apt.customer_email
            }
            if (new Date(apt.created_at) > new Date(existing.lastActivity)) {
                existing.lastActivity = apt.created_at
                existing.lastActivityLabel = getActivityLabel(apt.created_at)
            }
            // Actualizar status basado en la cita más relevante
            existing.status = deriveStatus(apt.status, existing.status)
            if (apt.customer_id && !existing.customerId) {
                existing.customerId = apt.customer_id
            }
        } else {
            leadMap.set(key, {
                id: key,
                name: apt.customer_name || "Sin nombre",
                phone: apt.customer_phone,
                email: apt.customer_email,
                source: "appointment",
                status: deriveStatus(apt.status, "new"),
                lastActivity: apt.created_at,
                lastActivityLabel: getActivityLabel(apt.created_at),
                appointmentCount: 1,
                chatCount: 0,
                properties: prop?.external_code ? [{ code: prop.external_code, title: prop.title || "" }] : [],
                advisorName: advisor?.name || null,
                advisorColor: advisor?.color || null,
                customerId: apt.customer_id || null,
            })
        }
    }

    // Procesar chats (agregar o enriquecer leads existentes)
    for (const chat of (chats || [])) {
        const customer = chat.customers as any
        if (!customer) continue

        const phone = normalizePhone(customer.phone)
        const key = phone || `chat-${chat.id}`

        if (leadMap.has(key)) {
            const existing = leadMap.get(key)!
            existing.chatCount++
            if (!existing.customerId && customer.id) {
                existing.customerId = customer.id
            }
            if (!existing.email && customer.email) {
                existing.email = customer.email
            }
        } else {
            leadMap.set(key, {
                id: key,
                name: customer.full_name || "Sin nombre",
                phone: customer.phone,
                email: customer.email,
                source: "chat",
                status: "new",
                lastActivity: chat.updated_at || chat.created_at,
                lastActivityLabel: getActivityLabel(chat.updated_at || chat.created_at),
                appointmentCount: 0,
                chatCount: 1,
                properties: [],
                advisorName: null,
                advisorColor: null,
                customerId: customer.id,
            })
        }
    }

    // 4. Convertir a array, filtrar y ordenar
    let leads = Array.from(leadMap.values())

    // Filtros
    if (params?.search) {
        const s = params.search.toLowerCase()
        leads = leads.filter(l =>
            l.name.toLowerCase().includes(s) ||
            (l.phone && l.phone.includes(s)) ||
            (l.email && l.email.toLowerCase().includes(s))
        )
    }

    if (params?.status && params.status !== "all") {
        leads = leads.filter(l => l.status === params.status)
    }

    // Ordenar por última actividad (más reciente primero)
    leads.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())

    // 5. Calcular stats
    const stats: LeadStats = {
        total: leads.length,
        new: leads.filter(l => l.status === "new").length,
        visitScheduled: leads.filter(l => l.status === "visit_scheduled").length,
        visited: leads.filter(l => l.status === "visited").length,
        negotiating: leads.filter(l => l.status === "negotiating").length,
        closed: leads.filter(l => l.status === "closed").length,
    }

    return { leads, stats }
}

/**
 * Actualiza el estado de un lead (en realidad actualiza la cita más reciente).
 */
export async function updateLeadStatus(leadPhone: string, newStatus: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "No autorizado" }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) return { success: false, error: "Sin organización" }

    // Actualizar metadata del customer si existe
    if (leadPhone) {
        const { data: customer } = await supabase
            .from("customers")
            .select("id, metadata")
            .eq("organization_id", profile.organization_id)
            .eq("phone", leadPhone)
            .single()

        if (customer) {
            await supabase
                .from("customers")
                .update({
                    metadata: {
                        ...(customer.metadata as object || {}),
                        lead_status: newStatus,
                        lead_status_updated_at: new Date().toISOString(),
                    }
                })
                .eq("id", customer.id)
        }
    }

    return { success: true }
}

// ─── Helpers ─────────────────────────────────────────────────────

function normalizePhone(phone?: string | null): string {
    if (!phone) return ""
    return phone.replace(/[\s\-\(\)]/g, "")
}

function deriveStatus(appointmentStatus: string, currentLeadStatus: string): Lead["status"] {
    const priority: Record<string, number> = {
        new: 0,
        contacted: 1,
        visit_scheduled: 2,
        visited: 3,
        negotiating: 4,
        closed: 5,
        lost: -1,
    }

    let derived: Lead["status"] = "new"
    if (appointmentStatus === "pending") derived = "visit_scheduled"
    else if (appointmentStatus === "confirmed") derived = "visit_scheduled"
    else if (appointmentStatus === "completed") derived = "visited"
    else if (appointmentStatus === "cancelled") derived = "new"

    return (priority[derived] || 0) > (priority[currentLeadStatus] || 0) ? derived : currentLeadStatus as Lead["status"]
}

function getActivityLabel(dateStr: string): string {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMin < 5) return "Hace un momento"
    if (diffMin < 60) return `Hace ${diffMin} min`
    if (diffHours < 24) return `Hace ${diffHours}h`
    if (diffDays === 1) return "Ayer"
    if (diffDays < 7) return `Hace ${diffDays} días`
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`
    return formatBogotaDayKey(date)
}

function emptyStats(): LeadStats {
    return { total: 0, new: 0, visitScheduled: 0, visited: 0, negotiating: 0, closed: 0 }
}
