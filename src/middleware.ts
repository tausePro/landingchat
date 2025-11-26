import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Get user session
    const {
        data: { user },
    } = await supabase.auth.getUser()

    console.log("Middleware - Path:", request.nextUrl.pathname)
    console.log("Middleware - User:", user?.email)

    // Public routes that don't require auth
    const publicRoutes = ['/', '/chat', '/api', '/store']
    const isPublicRoute = publicRoutes.some(route => request.nextUrl.pathname.startsWith(route))

    // If user is not logged in and trying to access protected route
    if (!user && !isPublicRoute && !request.nextUrl.pathname.startsWith('/onboarding')) {
        console.log("Middleware - Redirecting to / (No User)")
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/'
        return NextResponse.redirect(redirectUrl)
    }

    // If user is logged in, check onboarding status
    if (user && !request.nextUrl.pathname.startsWith('/onboarding')) {
        // Get user's organization and onboarding status
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id, is_superadmin')
            .eq('id', user.id)
            .single()

        console.log("Middleware - Profile:", profile)

        // Allow superadmins to bypass onboarding
        if (profile?.is_superadmin) {
            console.log("Middleware - Superadmin bypass")
            return supabaseResponse
        }

        if (profile?.organization_id) {
            const { data: organization } = await supabase
                .from('organizations')
                .select('onboarding_completed')
                .eq('id', profile.organization_id)
                .single()

            // If onboarding not completed, redirect to onboarding
            if (organization && !organization.onboarding_completed) {
                const redirectUrl = request.nextUrl.clone()
                redirectUrl.pathname = '/onboarding/welcome'
                return NextResponse.redirect(redirectUrl)
            }
        }
    }

    // If user completed onboarding and tries to access onboarding routes, redirect to dashboard
    if (user && request.nextUrl.pathname.startsWith('/onboarding')) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single()

        if (profile?.organization_id) {
            const { data: organization } = await supabase
                .from('organizations')
                .select('onboarding_completed')
                .eq('id', profile.organization_id)
                .single()

            if (organization?.onboarding_completed) {
                const redirectUrl = request.nextUrl.clone()
                redirectUrl.pathname = '/dashboard'
                return NextResponse.redirect(redirectUrl)
            }
        }
    }

    // Protect Admin Routes
    if (request.nextUrl.pathname.startsWith('/admin')) {
        if (!user) {
            const redirectUrl = request.nextUrl.clone()
            redirectUrl.pathname = '/auth'
            return NextResponse.redirect(redirectUrl)
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('is_superadmin')
            .eq('id', user.id)
            .single()

        if (!profile?.is_superadmin) {
            const redirectUrl = request.nextUrl.clone()
            redirectUrl.pathname = '/dashboard'
            return NextResponse.redirect(redirectUrl)
        }
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (public folder)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
