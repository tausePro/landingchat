import { createBrowserClient } from '@supabase/ssr'

/**
 * Crea un cliente de Supabase para el navegador
 * 
 * En producción, las cookies se configuran con domain=.landingchat.co
 * para compartir la sesión entre subdominios (www, tez, qp, etc.)
 */
export function createClient() {
  const isProduction = typeof window !== 'undefined' && 
    window.location.hostname.includes('landingchat.co')

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: isProduction ? {
        domain: '.landingchat.co',
        secure: true,
        sameSite: 'lax' as const,
      } : undefined
    }
  )
}
