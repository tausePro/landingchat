/**
 * Helpers para resolver y enriquecer la organización del storefront público
 * con datos de contacto (WhatsApp phone + agent identity).
 *
 * Movido fuera de `src/app/store/[slug]/actions.ts` porque ese archivo
 * tiene `"use server"` y Next.js exige que TODOS sus exports sean async
 * functions (server actions). Estos helpers son utilidades sincrónicas
 * y async genéricas; vivir aquí (sin "use server") permite:
 *   - Reusarlos desde server components/pages (e.g. [pageSlug]/page.tsx).
 *   - Reusarlos desde otras server actions (actions.ts los importa).
 *   - Mantener una sola fuente de verdad para la cadena de fallback.
 */

import type { createClient } from "@/lib/supabase/server"

export type StorefrontSupabaseClient = Awaited<ReturnType<typeof createClient>>

export interface StoreOrganizationSettings {
    whatsapp?: {
        phone?: string | null
    }
    contact?: {
        phone?: string | null
    }
    agent?: {
        name?: unknown
        avatar?: unknown
        [key: string]: unknown
    }
    [key: string]: unknown
}

export interface StorefrontAgentIdentity {
    name: string | null
    avatar: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getOptionalString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value : null
}

/**
 * Resuelve el número WhatsApp del tenant para uso en el storefront público.
 *
 * Cadena de fallback (orden de prioridad):
 *   1. `settings.whatsapp.phone` — override manual del tenant desde el dashboard.
 *      Es la fuente de mayor prioridad: si el merchant lo configura, mandamos.
 *   2. `settings.contact.phone` — teléfono general de contacto.
 *   3. `whatsapp_instances.phone_number` con `status = 'connected'`, priorizando
 *      `instance_type = 'corporate'` y haciendo fallback a `personal` si no hay
 *      una corporate conectada. Esto cubre el caso (real, observado en Tez)
 *      donde la instancia corporate está disconnected pero existe una personal
 *      conectada con un número válido.
 *
 * Si nada de lo anterior está disponible, retorna null (y el caller
 * típicamente mostrará un botón de chat IA como fallback).
 */
export async function resolveOrganizationWhatsAppPhone(
    supabase: StorefrontSupabaseClient,
    organizationId: string,
    settings?: StoreOrganizationSettings | null,
): Promise<string | null> {
    const configuredPhone = settings?.whatsapp?.phone || settings?.contact?.phone
    if (configuredPhone) {
        return configuredPhone
    }

    // v1.14.2: ampliar el lookup para considerar también instancias `personal`
    // cuando la `corporate` no está conectada. Antes el query era estricto
    // (instance_type = 'corporate' AND status = 'connected') y dejaba al
    // botón flotante en fallback chat IA aunque el tenant tuviera una
    // personal conectada con un número válido.
    //
    // Estrategia:
    //   1. Traer todas las instancias conectadas con phone_number.
    //   2. Priorizar corporate sobre personal en TS (no en SQL para no
    //      complicar el query con CASE/ORDER BY que no son triviales en
    //      PostgREST).
    const { data: connectedInstances } = await supabase
        .from("whatsapp_instances")
        .select("instance_type, phone_number")
        .eq("organization_id", organizationId)
        .eq("status", "connected")
        .not("phone_number", "is", null)

    if (!connectedInstances || connectedInstances.length === 0) {
        return null
    }

    const corporate = connectedInstances.find(i => i.instance_type === "corporate")
    if (corporate?.phone_number) {
        return corporate.phone_number
    }

    const personal = connectedInstances.find(i => i.instance_type === "personal")
    if (personal?.phone_number) {
        return personal.phone_number
    }

    // Ningún tipo conocido — retornar el primero que tenga número.
    return connectedInstances[0]?.phone_number || null
}

/**
 * Resuelve la identidad del agente (name + avatar) para mostrar en el
 * storefront. Prioridad:
 *   1. settings.agent.name + settings.agent.avatar (overrides del tenant).
 *   2. Primer registro de la tabla `agents` con type='bot' y status='available'.
 */
export async function resolveOrganizationAgentIdentity(
    supabase: StorefrontSupabaseClient,
    organizationId: string,
    settings?: StoreOrganizationSettings | null,
): Promise<StorefrontAgentIdentity | null> {
    const configuredAgent = isRecord(settings?.agent) ? settings.agent : null
    const configuredName = getOptionalString(configuredAgent?.name)
    const configuredAvatar = getOptionalString(configuredAgent?.avatar)

    if (configuredName || configuredAvatar) {
        return {
            name: configuredName,
            avatar: configuredAvatar,
        }
    }

    const { data: agent } = await supabase
        .from("agents")
        .select("name, avatar_url")
        .eq("organization_id", organizationId)
        .eq("type", "bot")
        .eq("status", "available")
        .limit(1)
        .maybeSingle()

    if (!agent) {
        return null
    }

    return {
        name: getOptionalString(agent.name),
        avatar: getOptionalString(agent.avatar_url),
    }
}

/**
 * Enriquece la organización con los datos resueltos para el storefront:
 *   - settings.whatsapp.phone <- resolveOrganizationWhatsAppPhone
 *   - settings.agent.name + .avatar <- resolveOrganizationAgentIdentity
 *
 * Inmutable: retorna una nueva instancia de organization sin mutar el input.
 *
 * Uso típico en server components / server actions:
 *
 *   const phone = await resolveOrganizationWhatsAppPhone(supabase, org.id, org.settings)
 *   const agent = await resolveOrganizationAgentIdentity(supabase, org.id, org.settings)
 *   const enrichedOrg = enrichOrganizationWithStorefrontContact(org, phone, agent)
 */
export function enrichOrganizationWithStorefrontContact<T extends { id: string; settings?: StoreOrganizationSettings | null }>(
    organization: T,
    whatsappPhone: string | null,
    agentIdentity: StorefrontAgentIdentity | null,
): T {
    const configuredAgent = isRecord(organization.settings?.agent) ? organization.settings.agent : {}

    return {
        ...organization,
        settings: {
            ...organization.settings,
            whatsapp: {
                ...organization.settings?.whatsapp,
                phone: whatsappPhone,
            },
            agent: {
                ...configuredAgent,
                ...(agentIdentity?.name ? { name: agentIdentity.name } : {}),
                ...(agentIdentity?.avatar ? { avatar: agentIdentity.avatar } : {}),
            },
        },
    }
}

export interface StorefrontReviewSummaryItem {
    id: string
    authorName: string
    authorImageUrl: string | null
    rating: number
    title: string | null
    content: string | null
    verifiedPurchase: boolean
}

export interface StorefrontReviewsSummary {
    average: number
    count: number
    items: StorefrontReviewSummaryItem[]
}

/**
 * Resumen de reseñas PUBLICADAS del tenant para prueba social en el storefront.
 * Solo `is_published = true`, scoped por organization_id. Retorna null si no hay
 * reseñas publicadas → la UI oculta la sección (nunca datos simulados).
 */
export async function resolveOrganizationReviewsSummary(
    supabase: StorefrontSupabaseClient,
    organizationId: string,
): Promise<StorefrontReviewsSummary | null> {
    const { data, error, count } = await supabase
        .from("product_reviews")
        .select("id, author_name, author_image_url, rating, title, content, verified_purchase", { count: "exact" })
        .eq("organization_id", organizationId)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(60)

    if (error || !data || data.length === 0) {
        return null
    }

    const ratings = data
        .map((row) => (typeof row.rating === "number" ? row.rating : null))
        .filter((value): value is number => value !== null)
    const average = ratings.length > 0 ? ratings.reduce((acc, value) => acc + value, 0) / ratings.length : 0

    const items: StorefrontReviewSummaryItem[] = data
        .filter((row) => getOptionalString(row.content) || getOptionalString(row.title))
        .slice(0, 6)
        .map((row) => ({
            id: String(row.id),
            authorName: getOptionalString(row.author_name) || "Cliente",
            authorImageUrl: getOptionalString(row.author_image_url),
            rating: typeof row.rating === "number" ? row.rating : 5,
            title: getOptionalString(row.title),
            content: getOptionalString(row.content),
            verifiedPurchase: Boolean(row.verified_purchase),
        }))

    return {
        average: Math.round(average * 10) / 10,
        count: count ?? data.length,
        items,
    }
}
