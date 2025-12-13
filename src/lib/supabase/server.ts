/**
 * Clientes de Supabase para el servidor
 * 
 * Este módulo proporciona dos tipos de clientes:
 * - createClient(): Cliente autenticado que respeta RLS (Row Level Security)
 * - createServiceClient(): Cliente con permisos de servicio que bypasea RLS
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

/**
 * Obtiene las opciones de cookie
 * Por ahora usamos las opciones por defecto para evitar conflictos de autenticación
 */
function getCookieOptions(options?: CookieOptions): CookieOptions {
    return options || {}
}

/**
 * Crea un cliente de Supabase autenticado con cookies
 * 
 * Este cliente:
 * - Usa las cookies del usuario para autenticación
 * - Respeta las políticas de Row Level Security (RLS)
 * - Es seguro para usar en Server Components y Server Actions
 * - En producción, comparte sesión entre subdominios de landingchat.co
 * 
 * @returns Cliente de Supabase configurado con la sesión del usuario
 */
export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            const enhancedOptions = getCookieOptions(options)
                            cookieStore.set(name, value, enhancedOptions)
                        })
                    } catch {
                        // El método setAll fue llamado desde un Server Component.
                        // Esto se puede ignorar si tienes middleware refrescando
                        // las sesiones de usuario.
                    }
                },
            },
        }
    )
}

/**
 * Crea un cliente de Supabase con permisos de servicio
 * 
 * Este cliente:
 * - Usa la Service Role Key (clave de servicio)
 * - Bypasea todas las políticas de RLS
 * - Solo debe usarse para operaciones administrativas del servidor
 * 
 * ⚠️ PRECAUCIÓN: No exponer este cliente al frontend
 * 
 * @returns Cliente de Supabase con permisos de servicio
 * @throws Error si faltan las variables de entorno necesarias
 */
export function createServiceClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Faltan variables de entorno de Supabase para el cliente de servicio")
    }

    return createSupabaseClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
}
