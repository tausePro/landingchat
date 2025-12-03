import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    const hostname = request.headers.get('host') || ''
    const pathname = request.nextUrl.pathname

    // ============================================
    // RUTAS QUE NUNCA SE REESCRIBEN
    // ============================================
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/admin') ||
        pathname.startsWith('/auth') ||
        pathname.startsWith('/onboarding') ||
        pathname.includes('.') // archivos estáticos
    ) {
        return handleAuth(request)
    }

    // Redirección de migración /products -> /productos (excluyendo dashboard ya filtrado arriba)
    if (pathname.endsWith('/products')) {
        const newPath = pathname.replace('/products', '/productos')
        return NextResponse.redirect(new URL(newPath, request.url))
    }

    // ============================================
    // DETECTAR SLUG DE LA TIENDA
    // ============================================
    let slug: string | null = null

    // === DESARROLLO ===
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
        // Opción 1: Query param → localhost:3000?store=demo-store
        slug = request.nextUrl.searchParams.get('store')

        // Opción 2: Subdominio local → demo-store.localhost:3000
        if (!slug) {
            const hostPart = hostname.split(':')[0] // quitar puerto
            const parts = hostPart.split('.')
            if (parts.length > 1 && parts[0] !== 'localhost' && parts[0] !== '127') {
                slug = parts[0]
            }
        }

        // Opción 3: Path tradicional → localhost:3000/store/demo-store
        if (!slug && (pathname.startsWith('/store/') || pathname.startsWith('/chat/'))) {
            return handleAuth(request)
        }
    }
    // === PRODUCCIÓN ===
    else {
        const parts = hostname.split('.')

        // tienda.landingchat.co → ['tienda', 'landingchat', 'co']
        if (parts.length >= 3) {
            const subdomain = parts[0]

            // Ignorar subdominios reservados
            const reserved = ['www', 'app', 'api', 'dashboard', 'admin', 'wa']
            if (!reserved.includes(subdomain)) {
                slug = subdomain
            }
        }
    }

    // Si no hay slug, continuar normal (landing page principal)
    if (!slug) {
        return handleAuth(request)
    }

    // Si estamos en subdominio y la ruta es /dashboard, redirigir al dominio principal
    // Evitar redirigir en localhost si estamos probando con ?store=...
    const isProductionSubdomain = !hostname.includes('localhost') && !hostname.includes('127.0.0.1') && slug
    if (isProductionSubdomain && pathname.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL(pathname, `https://www.landingchat.co`))
    }

    // ============================================
    // REESCRIBIR RUTAS PARA LA TIENDA
    // ============================================

    // tienda.landingchat.co/ → /store/tienda
    if (pathname === '/' || pathname === '') {
        const url = new URL(`/store/${slug}`, request.url)
        // Preservar query params
        request.nextUrl.searchParams.forEach((value, key) => {
            if (key !== 'store') url.searchParams.set(key, value)
        })
        return NextResponse.rewrite(url)
    }

    // tienda.landingchat.co/chat → /chat/tienda
    if (pathname === '/chat' || pathname === '/chat/') {
        const url = new URL(`/chat/${slug}`, request.url)
        request.nextUrl.searchParams.forEach((value, key) => {
            if (key !== 'store') url.searchParams.set(key, value)
        })
        return NextResponse.rewrite(url)
    }

    // tienda.landingchat.co/p/123 → /store/tienda/p/123
    if (pathname.startsWith('/p/')) {
        return NextResponse.rewrite(new URL(`/store/${slug}${pathname}`, request.url))
    }

    // Cualquier otra ruta bajo el subdominio
    return NextResponse.rewrite(new URL(`/store/${slug}${pathname}`, request.url))
}

// ============================================
// FUNCIÓN DE AUTENTICACIÓN (existente)
// ============================================
async function handleAuth(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()

    // Rutas públicas
    const publicRoutes = ['/', '/store', '/chat', '/api', '/auth', '/login', '/registro', '/recuperar']
    const isPublicRoute = publicRoutes.some(route =>
        request.nextUrl.pathname === route ||
        request.nextUrl.pathname.startsWith(route + '/')
    )

    // Redirigir si no hay usuario y es ruta protegida
    if (!user && !isPublicRoute && !request.nextUrl.pathname.startsWith('/onboarding')) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
