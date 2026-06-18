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

// ============================================
// CACHE EN MEMORIA + CIRCUIT BREAKER
// Protege a Supabase de queries repetitivas
// ============================================
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos
const CIRCUIT_BREAKER_TIMEOUT_MS = 3000 // 3 segundos máximo para queries del middleware

// Cache genérico con TTL y limpieza automática
const middlewareCache = new Map<string, { value: unknown; timestamp: number }>()

interface CustomDomainLookupResult {
    data: { slug: string } | null
    error: unknown
}

interface MaintenanceLookupResult {
    data: { maintenance_mode: boolean; maintenance_message: string | null; id: string; maintenance_bypass_token: string | null } | null
    error: unknown
}

interface AuthUserLookupResult {
    data: { user: { id: string } | null }
}

interface ProfileLookupResult {
    data: { organization_id: string | null; is_superadmin: boolean | null } | null
    error: unknown
}

function getCache<T>(key: string): T | undefined {
    const cached = middlewareCache.get(key)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.value as T
    }
    middlewareCache.delete(key)
    return undefined
}

function setCache(key: string, value: unknown) {
    middlewareCache.set(key, { value, timestamp: Date.now() })
    // Limpiar cache si crece demasiado
    if (middlewareCache.size > 200) {
        const oldest = [...middlewareCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)
        for (let i = 0; i < 100; i++) middlewareCache.delete(oldest[i][0])
    }
}

// Circuit breaker: ejecuta una promesa con timeout
// Si Supabase no responde en CIRCUIT_BREAKER_TIMEOUT_MS, retorna fallback
async function withTimeout<T, F>(promise: Promise<T>, fallback: F): Promise<T | F> {
    return Promise.race([
        promise,
        new Promise<F>((resolve) =>
            setTimeout(() => resolve(fallback), CIRCUIT_BREAKER_TIMEOUT_MS)
        )
    ])
}

const ORDER_STATUS_PATH_PATTERN = /^\/order\/[^/]+\/(success|pending|error)(\/)?$/
const RESERVED_SUBDOMAINS = ['www', 'app', 'api', 'dashboard', 'wa']

async function resolveStoreSlugFromHost(hostname: string, request: NextRequest): Promise<string | null> {
    if (!hostname) return null

    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
        const slug = request.nextUrl.searchParams.get('store')
        if (slug) return slug

        const hostPart = hostname.split(':')[0]
        const parts = hostPart.split('.')
        if (parts.length > 1 && parts[0] !== 'localhost' && parts[0] !== '127') {
            return parts[0]
        }

        return null
    }

    if (!hostname.includes('landingchat.co')) {
        const cacheKey = `domain:${hostname}`
        const cachedSlug = getCache<string | null>(cacheKey)
        if (cachedSlug !== undefined) {
            return cachedSlug
        }

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

            const result = await withTimeout(
                Promise.resolve(supabase.from("organizations").select("slug").eq("custom_domain", hostname).single()),
                { data: null, error: null } satisfies CustomDomainLookupResult
            )

            const slug = result.data?.slug ?? null
            setCache(cacheKey, slug)
            return slug
        } catch (error) {
            console.error("[MIDDLEWARE] Error checking custom domain:", error)
            setCache(cacheKey, null)
            return null
        }
    }

    const parts = hostname.split('.')
    if (parts.length < 3) return null

    const subdomain = parts[0]
    return RESERVED_SUBDOMAINS.includes(subdomain) ? null : subdomain
}

export async function proxy(request: NextRequest) {
    const hostname = request.headers.get('host') || ''
    const pathname = request.nextUrl.pathname
    const isDiscoveryRoute =
        pathname === '/robots.txt' ||
        pathname === '/sitemap.xml' ||
        pathname === '/llms.txt' ||
        pathname.startsWith('/.well-known/')

    // ============================================
    // HOTFIX v1.14.1 — Normalización www → apex (solo custom domains)
    // ============================================
    // Cuando un cliente accede a `www.<custom_domain>.com` (e.g. www.goldcaps.com.co
    // o www.tez.com.co), Vercel enruta al middleware con `hostname = www.X`.
    // El lookup posterior consulta `organizations.custom_domain = 'www.X'`
    // que NO existe en DB (los tenants guardan el apex). Como resultado,
    // el slug queda en null y el middleware cae al fallback de landing
    // principal, mostrando landingchat.co en vez de la tienda.
    //
    // Fix: si el host empieza con `www.` Y NO es un subdominio de
    // landingchat.co, redirigir 301 al apex preservando path + query.
    // Beneficios:
    //   - El lookup de DB encuentra el tenant correctamente.
    //   - Una sola URL canónica (apex) → mejor SEO + cookies consistentes.
    //   - Aplicable a TODOS los custom domains, no solo goldcaps.
    // No tocamos `www.landingchat.co` porque ese es el dominio principal
    // del producto, ni `localhost`/`127.0.0.1` (dev sin www).
    if (
        hostname.startsWith('www.') &&
        !hostname.includes('landingchat.co') &&
        !hostname.includes('localhost') &&
        !hostname.includes('127.0.0.1')
    ) {
        const apexHost = hostname.substring(4)
        const redirectUrl = new URL(
            request.nextUrl.pathname + request.nextUrl.search,
            `https://${apexHost}`,
        )
        console.log(`[MIDDLEWARE] www→apex redirect (custom domain): ${hostname} → ${apexHost}`)
        return NextResponse.redirect(redirectUrl, 301)
    }

    // ============================================
    // MODO EMERGENCIA: Cortar TODO el tráfico a Supabase
    // Cambiar a false cuando la BD esté healthy
    // ============================================
    const EMERGENCY_MAINTENANCE = false
    if (EMERGENCY_MAINTENANCE && !pathname.startsWith('/_next') && !pathname.includes('.')) {
        return new NextResponse(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LandingChat - Mantenimiento</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#334155}.c{text-align:center;padding:2rem;max-width:500px}h1{font-size:1.5rem;margin-bottom:1rem;color:#0f172a}p{color:#64748b;line-height:1.6;margin-bottom:.5rem}.icon{font-size:3rem;margin-bottom:1rem}</style></head><body><div class="c"><div class="icon">🔧</div><h1>Estamos en mantenimiento</h1><p>Estamos mejorando nuestros servidores para brindarte un mejor servicio.</p><p>Volveremos en unos minutos.</p></div></body></html>`,
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '300' } }
        )
    }

    if (isDiscoveryRoute) {
        return NextResponse.next()
    }

    if (ORDER_STATUS_PATH_PATTERN.test(pathname)) {
        const statusSlug = await resolveStoreSlugFromHost(hostname, request)
        if (statusSlug) {
            const url = new URL(`/store/${statusSlug}${pathname}`, request.url)
            request.nextUrl.searchParams.forEach((value, key) => {
                if (key !== 'store') url.searchParams.set(key, value)
            })
            return NextResponse.rewrite(url)
        }
    }

    // ============================================
    // RUTAS QUE NUNCA SE REESCRIBEN
    // Estas rutas pasan directo al manejador de autenticación
    // ============================================
    if (
        pathname.startsWith('/_next') ||      // Archivos internos de Next.js
        pathname.startsWith('/api') ||        // Rutas de API
        pathname.startsWith('/ingest') ||     // PostHog analytics proxy — NO debe consultar BD
        pathname.startsWith('/dashboard') ||  // Panel de administración
        pathname.startsWith('/admin') ||      // Panel de superadmin
        pathname.startsWith('/auth') ||       // Callbacks de autenticación
        pathname.startsWith('/onboarding') || // Flujo de onboarding
        pathname.startsWith('/checkout/wompi') ||   // Return URL de Wompi (lee host)
        pathname.startsWith('/checkout/epayco') || // Return URL de ePayco (lee host)
        pathname.startsWith('/order') ||      // Página de orden (para dominios personalizados)
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
    // REDIRECTS PARA COMPATIBILIDAD CON CAMPAÑAS
    // Mantener URLs de campañas activas funcionando
    // ============================================
    
    // Redirect: /tienda/[producto] → /producto/[producto]
    // Para campañas de Meta que usan el formato anterior
    if (pathname.startsWith('/tienda/') && pathname !== '/tienda' && pathname !== '/tienda/') {
        const productSlug = pathname.replace('/tienda/', '')
        const newPath = `/producto/${productSlug}`
        console.log(`[MIDDLEWARE] Campaign URL redirect: ${pathname} → ${newPath}`)
        return NextResponse.redirect(new URL(newPath, request.url), 301) // 301 = Permanent redirect
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
            // Es un dominio personalizado — primero buscar en cache
            const cacheKey = `domain:${hostname}`
            const cachedSlug = getCache<string | null>(cacheKey)
            if (cachedSlug !== undefined) {
                slug = cachedSlug
            } else {
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

                    const result = await withTimeout(
                        Promise.resolve(supabase.from("organizations").select("slug").eq("custom_domain", hostname).single()),
                        { data: null, error: null } satisfies CustomDomainLookupResult
                    )

                    slug = result.data?.slug || null
                    setCache(cacheKey, slug)
                } catch (error) {
                    console.error("[MIDDLEWARE] Error checking custom domain:", error)
                    setCache(cacheKey, null)
                }
            }
        } else {
            // Es un subdominio de landingchat.co
            const parts = hostname.split('.')

            // Detectar subdominio: tienda.landingchat.co → ['tienda', 'landingchat', 'co']
            if (parts.length >= 3) {
                const subdomain = parts[0]

                // Ignorar subdominios reservados del sistema
                if (!RESERVED_SUBDOMAINS.includes(subdomain)) {
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

    // Limpiar URLs redundantes en subdominios Y dominios personalizados
    // Ejemplo: qp.landingchat.co/store/qp/producto/123 → qp.landingchat.co/producto/123
    // Ejemplo: tez.com.co/store/tez/profile → tez.com.co/profile
    if (isProductionDomain && pathname.startsWith(`/store/${slug}/`)) {
        const cleanPath = pathname.replace(`/store/${slug}`, '')
        return NextResponse.redirect(new URL(cleanPath, request.url))
    }

    // ============================================
    // VERIFICAR MODO DE MANTENIMIENTO DE LA TIENDA
    // ============================================
    
    // Verificar si la tienda está en mantenimiento (solo para rutas públicas)
    if (slug && !pathname.startsWith('/dashboard') && !pathname.startsWith('/admin')) {
        try {
            // Buscar en cache primero
            const maintenanceCacheKey = `maintenance:${slug}`
            let orgData = getCache<{ maintenance_mode: boolean; maintenance_message: string | null; id: string; maintenance_bypass_token: string | null }>(maintenanceCacheKey)

            if (orgData === undefined) {
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

                const result = await withTimeout(
                    Promise.resolve(supabaseService.from("organizations")
                        .select("maintenance_mode, maintenance_message, id, maintenance_bypass_token")
                        .eq("slug", slug)
                        .single()),
                    { data: null, error: null } satisfies MaintenanceLookupResult
                )

                orgData = result.data ?? undefined
                setCache(maintenanceCacheKey, orgData)
            }

            if (orgData?.maintenance_mode) {
                let canAccess = false

                // MÉTODO 1: Verificar token de bypass en URL (?bypass=TOKEN)
                const bypassToken = request.nextUrl.searchParams.get('bypass')
                if (bypassToken && orgData.maintenance_bypass_token && bypassToken === orgData.maintenance_bypass_token) {
                    canAccess = true
                }

                // MÉTODO 2: Verificar si el usuario está autenticado (dueño o superadmin)
                if (!canAccess) {
                    const supabaseAuth = createServerClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                        {
                            cookies: {
                                getAll() { return request.cookies.getAll() },
                                setAll() { }
                            }
                        }
                    )

                    const { data: { user } } = await withTimeout(
                        supabaseAuth.auth.getUser(),
                        { data: { user: null } } satisfies AuthUserLookupResult
                    )

                    if (user) {
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

                        const { data: profile } = await withTimeout(
                            Promise.resolve(supabaseService.from("profiles")
                                .select("organization_id, is_superadmin")
                                .eq("id", user.id)
                                .single()),
                            { data: null, error: null } satisfies ProfileLookupResult
                        )

                        canAccess = profile?.is_superadmin || profile?.organization_id === orgData.id
                    }
                }

                if (!canAccess) {
                    const maintenanceUrl = new URL(`/store/${slug}/maintenance`, request.url)
                    return NextResponse.rewrite(maintenanceUrl)
                }
            }
        } catch (error) {
            console.error("[MIDDLEWARE] Error checking maintenance mode:", error)
        }
    }

    // ============================================
    // REESCRIBIR RUTAS PARA LA TIENDA
    // Mapea las rutas del subdominio a las rutas internas
    // ============================================

    // RUTAS QUE NO SE REESCRIBEN PARA DOMINIOS PERSONALIZADOS
    // Estas rutas tienen sus propias páginas que manejan dominios personalizados
    // y obtienen la organización del header host
    if (
        pathname.startsWith('/order') ||           // Página de orden (usa custom_domain del host)
        pathname.startsWith('/checkout/wompi') ||  // Return URL de Wompi (lee host)
        pathname.startsWith('/checkout/epayco')    // Return URL de ePayco (lee host)
    ) {
        console.log(`[MIDDLEWARE] Custom domain route bypass: ${pathname} - not rewriting`)
        return handleAuth(request)
    }

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

    // Asesor inmobiliario: tienda.landingchat.co/asesor → /chat/tienda/asesor
    if (pathname === '/asesor' || pathname === '/asesor/') {
        const url = new URL(`/chat/${slug}/asesor`, request.url)
        request.nextUrl.searchParams.forEach((value, key) => {
            if (key !== 'store') url.searchParams.set(key, value)
        })
        return NextResponse.rewrite(url)
    }

    // Productos por ID corto: tienda.landingchat.co/p/123 → /store/tienda/p/123
    if (pathname.startsWith('/p/')) {
        const url = new URL(`/store/${slug}${pathname}`, request.url)
        request.nextUrl.searchParams.forEach((value, key) => {
            if (key !== 'store') url.searchParams.set(key, value)
        })
        return NextResponse.rewrite(url)
    }

    // ============================================
    // REDIRECTS SEO DE MIGRACIÓN WOOCOMMERCE → LANDINGCHAT
    // Merchants migrados de WooCommerce (ej. goldcaps) tienen URLs indexadas en
    // Google con el permalink de WooCommerce que aquí no existen → 404 y pérdida de
    // tráfico SEO. 301-redirigimos los patrones conocidos al catálogo de productos.
    // Solo corre para tiendas resueltas (slug != null); el dominio principal cae al
    // landing antes de llegar aquí.
    // ============================================
    const isWooLegacyUrl =
        // Feeds RSS de WordPress: /.../feed o /feed (categorías, atributos, etc.)
        /\/feed\/?$/.test(pathname) ||
        // Categorías de producto WooCommerce (permalink ES/EN)
        pathname.startsWith('/categoria-producto/') ||
        pathname.startsWith('/product-category/')
    if (isWooLegacyUrl) {
        console.log(`[MIDDLEWARE] WooCommerce SEO redirect 301: ${hostname}${pathname} → /productos`)
        return NextResponse.redirect(new URL('/productos', request.url), 301)
    }

    // Cualquier otra ruta bajo el subdominio
    // Ejemplo: tienda.landingchat.co/productos → /store/tienda/productos
    // Ejemplo: tez.com.co/profile?phone=123 → /store/tez/profile?phone=123
    const url = new URL(`/store/${slug}${pathname}`, request.url)
    request.nextUrl.searchParams.forEach((value, key) => {
        if (key !== 'store') url.searchParams.set(key, value)
    })
    return NextResponse.rewrite(url)
}

// ============================================
// HELPER: Opciones de cookies
// ============================================
function getCookieOptions(options?: Record<string, unknown>): Record<string, unknown> {
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
    const publicRoutes = ['/', '/store', '/chat', '/api', '/auth', '/login', '/registro', '/recuperar', '/checkout', '/order', '/founding', '/privacidad', '/terminos', '/seguridad', '/robots.txt', '/sitemap.xml', '/llms.txt', '/.well-known']
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
        // Excluir archivos estáticos, assets y analytics proxy
        '/((?!_next/static|_next/image|ingest|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'
    ],
}
