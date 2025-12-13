/**
 * Middleware de Next.js para LandingChat
 * 
 * Este middleware maneja:
 * 1. Reescritura de subdominios (tienda.landingchat.co → /store/tienda)
 * 2. Autenticación y protección de rutas
 * 3. Redirecciones de migración (/products → /productos)
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    const hostname = request.headers.get('host') || ''
    const pathname = request.nextUrl.pathname

    // ============================================
    // RUTAS QUE NUNCA SE REESCRIBEN
    // Estas rutas pasan directo al manejador de autenticación
    // ============================================
    if (
        pathname.startsWith('/_next') ||      // Archivos internos de Next.js
        pathname.startsWith('/api') ||        // Rutas de API
        pathname.startsWith('/dashboard') ||  // Panel de administración
        pathname.startsWith('/admin') ||      // Panel de superadmin
        pathname.startsWith('/auth') ||       // Callbacks de autenticación
        pathname.startsWith('/onboarding') || // Flujo de onboarding
        pathname.includes('.')                // Archivos estáticos (favicon, imágenes, etc.)
    ) {
        return handleAuth(request)
    }

    // Redirección de migración: /products → /productos
    // (excluyendo dashboard que ya fue filtrado arriba)
    if (pathname.endsWith('/products')) {
        const newPath = pathname.replace('/products', '/productos')
        return NextResponse.redirect(new URL(newPath, request.url))
    }

    // ============================================
    // DETECTAR SLUG DE LA TIENDA
    // El slug identifica qué tienda mostrar
    // ============================================
    let slug: string | null = null

    // === ENTORNO DE DESARROLLO ===
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
        // Opción 1: Query param → localhost:3000?store=demo-store
        slug = request.nextUrl.searchParams.get('store')

        // Opción 2: Subdominio local → demo-store.localhost:3000
        if (!slug) {
            const hostPart = hostname.split(':')[0] // Quitar puerto
            const parts = hostPart.split('.')
            if (parts.length > 1 && parts[0] !== 'localhost' && parts[0] !== '127') {
                slug = parts[0]
            }
        }

        // Opción 3: Path tradicional → localhost:3000/store/demo-store
        // En este caso, dejamos que Next.js maneje la ruta normalmente
        if (!slug && (pathname.startsWith('/store/') || pathname.startsWith('/chat/'))) {
            return handleAuth(request)
        }
    }
    // === ENTORNO DE PRODUCCIÓN ===
    else {
        // Primero verificar si es un dominio personalizado
        if (!hostname.includes('landingchat.co')) {
            // Es un dominio personalizado, buscar en la base de datos
            console.log(`[MIDDLEWARE] Custom domain detected: ${hostname}`)
            try {
                const supabase = createServerClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!,
                    {
                        cookies: {
                            getAll() { return [] },
                            setAll() { }
                        }
                    }
                )

                console.log(`[MIDDLEWARE] Querying database for custom_domain: ${hostname}`)
                const { data: org, error } = await supabase
                    .from("organizations")
                    .select("slug")
                    .eq("custom_domain", hostname)
                    .single()

                console.log(`[MIDDLEWARE] Database query result:`, { org, error })

                if (org) {
                    slug = org.slug
                    console.log(`[MIDDLEWARE] Found organization slug: ${slug}`)
                } else {
                    console.log(`[MIDDLEWARE] No organization found for domain: ${hostname}`)
                }
            } catch (error) {
                console.error("[MIDDLEWARE] Error checking custom domain:", error)
                // En caso de error, continuar con la lógica normal
            }
        } else {
            // Es un subdominio de landingchat.co
            const parts = hostname.split('.')

            // Detectar subdominio: tienda.landingchat.co → ['tienda', 'landingchat', 'co']
            if (parts.length >= 3) {
                const subdomain = parts[0]

                // Ignorar subdominios reservados del sistema
                const reserved = ['www', 'app', 'api', 'dashboard', 'admin', 'wa']
                if (!reserved.includes(subdomain)) {
                    slug = subdomain
                }
            }
        }
    }

    // Si no hay slug, continuar normal (landing page principal)
    if (!slug) {
        console.log(`[MIDDLEWARE] No slug found for hostname: ${hostname}, continuing to main site`)
        return handleAuth(request)
    }

    console.log(`[MIDDLEWARE] Using slug: ${slug} for hostname: ${hostname}`)

    // ============================================
    // REDIRECCIONES ESPECIALES PARA SUBDOMINIOS Y DOMINIOS PERSONALIZADOS
    // ============================================
    
    const isProductionDomain = !hostname.includes('localhost') && !hostname.includes('127.0.0.1') && slug
    const isCustomDomain = isProductionDomain && !hostname.includes('landingchat.co')

    // Si estamos en subdominio de landingchat.co y la ruta es /dashboard o /admin, redirigir al dominio principal
    // El dashboard y admin siempre deben estar en www.landingchat.co
    if (isProductionDomain && !isCustomDomain && (pathname.startsWith('/dashboard') || pathname.startsWith('/admin'))) {
        return NextResponse.redirect(new URL(pathname, `https://www.landingchat.co`))
    }

    // Para dominios personalizados, redirigir dashboard/admin a landingchat.co
    if (isCustomDomain && (pathname.startsWith('/dashboard') || pathname.startsWith('/admin'))) {
        return NextResponse.redirect(new URL(pathname, `https://www.landingchat.co`))
    }

    // Limpiar URLs redundantes en subdominios (no aplica para dominios personalizados)
    // Ejemplo: qp.landingchat.co/store/qp/producto/123 → qp.landingchat.co/producto/123
    if (isProductionDomain && !isCustomDomain && pathname.startsWith(`/store/${slug}/`)) {
        const cleanPath = pathname.replace(`/store/${slug}`, '')
        return NextResponse.redirect(new URL(cleanPath, request.url))
    }

    // ============================================
    // VERIFICAR MODO DE MANTENIMIENTO DE LA TIENDA
    // ============================================
    
    // Verificar si la tienda está en mantenimiento (solo para rutas públicas)
    if (slug && !pathname.startsWith('/dashboard') && !pathname.startsWith('/admin')) {
        try {
            // Cliente con service role para consultas de DB
            const supabaseService = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                {
                    cookies: {
                        getAll() { return [] },
                        setAll() { }
                    }
                }
            )

            const { data: org } = await supabaseService
                .from("organizations")
                .select("maintenance_mode, maintenance_message, id, maintenance_bypass_token")
                .eq("slug", slug)
                .single()

            if (org?.maintenance_mode) {
                let canAccess = false

                // Método 1: Token de bypass en URL (?preview=TOKEN)
                // Esto permite a los dueños acceder desde cualquier dominio/subdominio
                const previewToken = request.nextUrl.searchParams.get('preview')
                if (previewToken && org.maintenance_bypass_token && previewToken === org.maintenance_bypass_token) {
                    canAccess = true
                    console.log(`[MIDDLEWARE] Maintenance bypass via preview token for ${slug}`)
                }

                // Método 2: Cookie de bypass (se establece después de usar el token una vez)
                const bypassCookie = request.cookies.get(`maintenance_bypass_${slug}`)
                if (bypassCookie?.value === org.maintenance_bypass_token) {
                    canAccess = true
                    console.log(`[MIDDLEWARE] Maintenance bypass via cookie for ${slug}`)
                }

                // Método 3: Usuario autenticado (funciona solo si las cookies se comparten)
                if (!canAccess) {
                    const supabaseAuth = createServerClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                        {
                            cookies: {
                                getAll() {
                                    return request.cookies.getAll()
                                },
                                setAll() { }
                            }
                        }
                    )

                    const { data: { user } } = await supabaseAuth.auth.getUser()

                    if (user) {
                        const { data: profile } = await supabaseService
                            .from("profiles")
                            .select("organization_id, is_superadmin")
                            .eq("id", user.id)
                            .single()

                        // Permitir acceso si es superadmin o dueño de la tienda
                        canAccess = profile?.is_superadmin || profile?.organization_id === org.id
                    }
                }

                if (!canAccess) {
                    // Redirigir a página de mantenimiento con el mensaje personalizado
                    const maintenanceUrl = new URL(`/store/${slug}/maintenance`, request.url)
                    return NextResponse.rewrite(maintenanceUrl)
                }

                // Si tiene acceso via token, establecer cookie para futuras visitas
                if (canAccess && previewToken) {
                    const response = NextResponse.rewrite(new URL(`/store/${slug}${pathname === '/' ? '' : pathname}`, request.url))
                    response.cookies.set(`maintenance_bypass_${slug}`, previewToken, {
                        httpOnly: true,
                        secure: true,
                        sameSite: 'lax',
                        maxAge: 60 * 60 * 24 // 24 horas
                    })
                    return response
                }
            }
        } catch (error) {
            console.error("Error checking maintenance mode:", error)
            // En caso de error, continuar normalmente
        }
    }

    // ============================================
    // REESCRIBIR RUTAS PARA LA TIENDA
    // Mapea las rutas del subdominio a las rutas internas
    // ============================================

    // Página principal: tienda.landingchat.co/ → /store/tienda
    if (pathname === '/' || pathname === '') {
        const url = new URL(`/store/${slug}`, request.url)
        // Preservar query params (excepto 'store' que ya usamos)
        request.nextUrl.searchParams.forEach((value, key) => {
            if (key !== 'store') url.searchParams.set(key, value)
        })
        return NextResponse.rewrite(url)
    }

    // Chat de la tienda: tienda.landingchat.co/chat → /chat/tienda
    if (pathname === '/chat' || pathname === '/chat/') {
        const url = new URL(`/chat/${slug}`, request.url)
        request.nextUrl.searchParams.forEach((value, key) => {
            if (key !== 'store') url.searchParams.set(key, value)
        })
        return NextResponse.rewrite(url)
    }

    // Productos por ID corto: tienda.landingchat.co/p/123 → /store/tienda/p/123
    if (pathname.startsWith('/p/')) {
        return NextResponse.rewrite(new URL(`/store/${slug}${pathname}`, request.url))
    }

    // Cualquier otra ruta bajo el subdominio
    // Ejemplo: tienda.landingchat.co/productos → /store/tienda/productos
    return NextResponse.rewrite(new URL(`/store/${slug}${pathname}`, request.url))
}

// ============================================
// HELPER: Opciones de cookies para subdominios
// ============================================
function getCookieOptions(options?: Record<string, unknown>): Record<string, unknown> {
    const isProduction = process.env.NODE_ENV === 'production'
    
    if (isProduction) {
        return {
            ...options,
            domain: '.landingchat.co',
            secure: true,
            sameSite: 'lax' as const,
        }
    }
    
    return options || {}
}

// ============================================
// FUNCIÓN DE AUTENTICACIÓN
// Maneja la sesión del usuario y protege rutas
// ============================================
async function handleAuth(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    // Crear cliente de Supabase con manejo de cookies
    // En producción, las cookies se establecen con domain=.landingchat.co
    // para compartir sesión entre subdominios
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    // Actualizar cookies en la request
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({ request })
                    // Actualizar cookies en la response con dominio correcto
                    cookiesToSet.forEach(({ name, value, options }) => {
                        const enhancedOptions = getCookieOptions(options)
                        supabaseResponse.cookies.set(name, value, enhancedOptions)
                    })
                },
            },
        }
    )

    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser()

    // Definir rutas públicas (no requieren autenticación)
    const publicRoutes = ['/', '/store', '/chat', '/api', '/auth', '/login', '/registro', '/recuperar']
    const isPublicRoute = publicRoutes.some(route =>
        request.nextUrl.pathname === route ||
        request.nextUrl.pathname.startsWith(route + '/')
    )

    // Redirigir a login si no hay usuario y es ruta protegida
    // (excepto onboarding que tiene su propia lógica)
    if (!user && !isPublicRoute && !request.nextUrl.pathname.startsWith('/onboarding')) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // Si el usuario está autenticado y va al dashboard, verificar onboarding
    if (user && request.nextUrl.pathname.startsWith('/dashboard')) {
        try {
            // Obtener el perfil del usuario
            const { data: profile } = await supabase
                .from("profiles")
                .select("organization_id")
                .eq("id", user.id)
                .single()

            if (profile?.organization_id) {
                // Verificar si la organización completó el onboarding
                const { data: org } = await supabase
                    .from("organizations")
                    .select("onboarding_completed")
                    .eq("id", profile.organization_id)
                    .single()

                // Si no ha completado el onboarding, redirigir
                if (org && !org.onboarding_completed) {
                    const url = request.nextUrl.clone()
                    url.pathname = '/onboarding'
                    return NextResponse.redirect(url)
                }
            } else {
                // Si no tiene organización, redirigir al onboarding
                const url = request.nextUrl.clone()
                url.pathname = '/onboarding'
                return NextResponse.redirect(url)
            }
        } catch (error) {
            console.error("Error checking onboarding status:", error)
            // En caso de error, permitir continuar al dashboard
        }
    }

    return supabaseResponse
}

// ============================================
// CONFIGURACIÓN DEL MATCHER
// Define qué rutas pasan por el middleware
// ============================================
export const config = {
    matcher: [
        // Excluir archivos estáticos y assets
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'
    ],
}
