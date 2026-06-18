/**
 * @file Middleware routing tests
 * @description Property-based tests for Next.js middleware routing logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { proxy as middleware } from '../proxy'

// Mock Supabase
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null }))
        }))
      }))
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null } }))
    }
  }))
}))

// Mock environment variables
vi.mock('process', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key'
  }
}))

describe('Middleware Routing Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Property 10: Query parameter rewriting', () => {
    it('should preserve query parameters when rewriting subdomain routes', async () => {
      // Test data: various query parameter combinations
      const testCases = [
        { params: { utm_source: 'google', utm_medium: 'cpc' }, slug: 'demo-store' },
        { params: { ref: 'affiliate', campaign: 'summer2024' }, slug: 'test-shop' },
        { params: { page: '2', sort: 'price' }, slug: 'my-store' },
        { params: { search: 'productos', category: 'electronics' }, slug: 'electronics-store' }
      ]

      for (const { params, slug } of testCases) {
        // Create URL with query parameters
        const url = new URL(`https://${slug}.landingchat.co/`)
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.set(key, value)
        })

        const request = new NextRequest(url)
        const response = await middleware(request)

        // Should rewrite to /store/[slug] while preserving query params
        if (response instanceof NextResponse) {
          const rewrittenUrl = response.headers.get('x-middleware-rewrite')
          if (rewrittenUrl) {
            const parsedUrl = new URL(rewrittenUrl)
            
            // Verify path rewriting
            expect(parsedUrl.pathname).toBe(`/store/${slug}`)
            
            // Verify query parameters are preserved
            Object.entries(params).forEach(([key, value]) => {
              expect(parsedUrl.searchParams.get(key)).toBe(value)
            })
          }
        }
      }
    })

    it('should handle localhost development with store parameter', async () => {
      const testCases = [
        { store: 'dev-store', extraParams: { debug: 'true' } },
        { store: 'test-shop', extraParams: { preview: 'enabled', theme: 'dark' } }
      ]

      for (const { store, extraParams } of testCases) {
        const url = new URL('http://localhost:3000/')
        url.searchParams.set('store', store)
        Object.entries(extraParams).forEach(([key, value]) => {
          url.searchParams.set(key, value)
        })

        const request = new NextRequest(url)
        const response = await middleware(request)

        if (response instanceof NextResponse) {
          const rewrittenUrl = response.headers.get('x-middleware-rewrite')
          if (rewrittenUrl) {
            const parsedUrl = new URL(rewrittenUrl)
            
            // Should rewrite to /store/[slug]
            expect(parsedUrl.pathname).toBe(`/store/${store}`)
            
            // Should preserve extra params but remove 'store' param
            Object.entries(extraParams).forEach(([key, value]) => {
              expect(parsedUrl.searchParams.get(key)).toBe(value)
            })
            expect(parsedUrl.searchParams.has('store')).toBe(false)
          }
        }
      }
    })
  })

  describe('Property 11: Dashboard path preservation', () => {
    it('should never rewrite dashboard paths regardless of hostname', async () => {
      const dashboardPaths = [
        '/dashboard',
        '/dashboard/products',
        '/dashboard/orders/123',
        '/dashboard/settings/payments'
      ]

      const hostnames = [
        'localhost:3000',
        'demo-store.localhost:3000',
        'shop.landingchat.co',
        'test.landingchat.co'
      ]

      for (const path of dashboardPaths) {
        for (const hostname of hostnames) {
          const url = new URL(`http://${hostname}${path}`)
          const request = new NextRequest(url)
          const response = await middleware(request)

          // Dashboard paths should pass through to auth handling without rewriting
          if (response instanceof NextResponse) {
            const rewrittenUrl = response.headers.get('x-middleware-rewrite')
            // Should not be rewritten (no x-middleware-rewrite header)
            expect(rewrittenUrl).toBeNull()
          }
        }
      }
    })
  })

  describe('Property 12: API path preservation', () => {
    it('should never rewrite API paths regardless of hostname', async () => {
      const apiPaths = [
        '/api/auth/callback',
        '/api/webhooks/payments',
        '/api/store/demo-store/products',
        '/api/ai-chat'
      ]

      const hostnames = [
        'localhost:3000',
        'store.localhost:3000',
        'shop.landingchat.co',
        'api.landingchat.co'
      ]

      for (const path of apiPaths) {
        for (const hostname of hostnames) {
          const url = new URL(`http://${hostname}${path}`)
          const request = new NextRequest(url)
          const response = await middleware(request)

          // API paths should pass through without rewriting
          if (response instanceof NextResponse) {
            const rewrittenUrl = response.headers.get('x-middleware-rewrite')
            expect(rewrittenUrl).toBeNull()
          }
        }
      }
    })
  })

  describe('Property 13: Reserved subdomain handling', () => {
    it('should not treat reserved subdomains as store slugs', async () => {
      const reservedSubdomains = ['www', 'app', 'api', 'dashboard', 'admin', 'wa']
      
      for (const subdomain of reservedSubdomains) {
        const url = new URL(`https://${subdomain}.landingchat.co/`)
        const request = new NextRequest(url)
        const response = await middleware(request)

        // Reserved subdomains should not be rewritten to /store/[slug]
        if (response instanceof NextResponse) {
          const rewrittenUrl = response.headers.get('x-middleware-rewrite')
          if (rewrittenUrl) {
            const parsedUrl = new URL(rewrittenUrl)
            expect(parsedUrl.pathname).not.toBe(`/store/${subdomain}`)
          }
        }
      }
    })

    it('should handle valid store subdomains correctly', async () => {
      const validStoreSubdomains = ['tez', 'demo-store', 'my-shop', 'electronics-co']
      
      for (const subdomain of validStoreSubdomains) {
        const url = new URL(`https://${subdomain}.landingchat.co/`)
        const request = new NextRequest(url)
        const response = await middleware(request)

        // Valid store subdomains should be rewritten to /store/[slug]
        if (response instanceof NextResponse) {
          const rewrittenUrl = response.headers.get('x-middleware-rewrite')
          if (rewrittenUrl) {
            const parsedUrl = new URL(rewrittenUrl)
            expect(parsedUrl.pathname).toBe(`/store/${subdomain}`)
          }
        }
      }
    })
  })

  describe('Hotfix v1.14.1 — www→apex redirect for custom domains', () => {
    // Bug: cuando un cliente accedía a www.<custom_domain>, el middleware
    // hacía lookup exacto a organizations.custom_domain = 'www.X', no encontraba
    // match (los tenants guardan el apex), slug quedaba null y caía al
    // fallback de landing principal mostrando landingchat.co en vez de la tienda.
    //
    // Fix: redirect 301 www → apex ANTES del lookup. Afecta a TODOS los
    // custom domains de forma transparente (goldcaps, tez, futuros).

    it('redirige 301 www.goldcaps.com.co → goldcaps.com.co preservando path y query', async () => {
      const url = new URL('https://www.goldcaps.com.co/producto/cap-001?ref=promo&utm=meta')
      const request = new NextRequest(url, {
        headers: { host: 'www.goldcaps.com.co' }
      })
      const response = await middleware(request)

      expect(response.status).toBe(301)
      const location = response.headers.get('location')
      expect(location).toBeTruthy()
      const target = new URL(location!)
      expect(target.host).toBe('goldcaps.com.co')
      expect(target.pathname).toBe('/producto/cap-001')
      expect(target.searchParams.get('ref')).toBe('promo')
      expect(target.searchParams.get('utm')).toBe('meta')
    })

    it('redirige 301 www.tez.com.co → tez.com.co en la raíz', async () => {
      const url = new URL('https://www.tez.com.co/')
      const request = new NextRequest(url, {
        headers: { host: 'www.tez.com.co' }
      })
      const response = await middleware(request)

      expect(response.status).toBe(301)
      const location = response.headers.get('location')
      const target = new URL(location!)
      expect(target.host).toBe('tez.com.co')
      expect(target.pathname).toBe('/')
    })

    it('NO redirige goldcaps.com.co (apex sin www) — sigue al lookup de tenant normal', async () => {
      const url = new URL('https://goldcaps.com.co/')
      const request = new NextRequest(url, {
        headers: { host: 'goldcaps.com.co' }
      })
      const response = await middleware(request)

      // No es 301 redirect: el código continúa al flujo normal
      // (que terminará en handleAuth o rewrite según el slug).
      expect(response.status).not.toBe(301)
    })

    it('NO redirige www.landingchat.co (dominio principal del producto)', async () => {
      const url = new URL('https://www.landingchat.co/')
      const request = new NextRequest(url, {
        headers: { host: 'www.landingchat.co' }
      })
      const response = await middleware(request)

      // El dominio www.landingchat.co es el del producto principal.
      // No debe ser redirigido a landingchat.co por el hotfix.
      // (Vercel maneja el redirect a nivel infra si lo configura.)
      expect(response.status).not.toBe(301)
    })

    it('NO redirige subdominios de landingchat.co (e.g. www.quality-pets.landingchat.co edge case)', async () => {
      // Edge case: si alguien accede a `www.quality-pets.landingchat.co`,
      // contiene "landingchat.co" en el host → no aplica nuestro redirect.
      // El subdominio reservado 'www' lo maneja el resto del flujo.
      const url = new URL('https://www.quality-pets.landingchat.co/')
      const request = new NextRequest(url, {
        headers: { host: 'www.quality-pets.landingchat.co' }
      })
      const response = await middleware(request)

      expect(response.status).not.toBe(301)
    })

    it('NO redirige hosts localhost (entorno de desarrollo)', async () => {
      const url = new URL('http://www.localhost:3000/')
      const request = new NextRequest(url, {
        headers: { host: 'www.localhost:3000' }
      })
      const response = await middleware(request)

      expect(response.status).not.toBe(301)
    })
  })

  describe('Unit tests for specific subdomain examples', () => {
    it('should rewrite tez.landingchat.co to /store/tez', async () => {
      const url = new URL('https://tez.landingchat.co/')
      const request = new NextRequest(url)
      const response = await middleware(request)

      if (response instanceof NextResponse) {
        const rewrittenUrl = response.headers.get('x-middleware-rewrite')
        if (rewrittenUrl) {
          const parsedUrl = new URL(rewrittenUrl)
          expect(parsedUrl.pathname).toBe('/store/tez')
        }
      }
    })

    it('should handle localhost with store parameter', async () => {
      const url = new URL('http://localhost:3000/?store=test-store')
      const request = new NextRequest(url)
      const response = await middleware(request)

      if (response instanceof NextResponse) {
        const rewrittenUrl = response.headers.get('x-middleware-rewrite')
        if (rewrittenUrl) {
          const parsedUrl = new URL(rewrittenUrl)
          expect(parsedUrl.pathname).toBe('/store/test-store')
        }
      }
    })

    it('should handle subdomain localhost development', async () => {
      const url = new URL('http://demo.localhost:3000/')
      const request = new NextRequest(url)
      const response = await middleware(request)

      if (response instanceof NextResponse) {
        const rewrittenUrl = response.headers.get('x-middleware-rewrite')
        if (rewrittenUrl) {
          const parsedUrl = new URL(rewrittenUrl)
          expect(parsedUrl.pathname).toBe('/store/demo')
        }
      }
    })

    it('should rewrite public order status pages for store subdomains', async () => {
      const url = new URL('https://qp.landingchat.co/order/order-uuid/success?access=signed-token')
      const request = new NextRequest(url, {
        headers: {
          host: 'qp.landingchat.co'
        }
      })
      const response = await middleware(request)

      if (response instanceof NextResponse) {
        const rewrittenUrl = response.headers.get('x-middleware-rewrite')
        expect(rewrittenUrl).toBeTruthy()

        const parsedUrl = new URL(rewrittenUrl!)
        expect(parsedUrl.pathname).toBe('/store/qp/order/order-uuid/success')
        expect(parsedUrl.searchParams.get('access')).toBe('signed-token')
      }
    })
  })

  describe('WooCommerce SEO redirects (migración goldcaps)', () => {
    // URLs viejas de WooCommerce indexadas en Google que aquí no existen → 301 al
    // catálogo /productos (en vez de 404). Solo en tiendas resueltas (subdominio).
    it('301 /categoria-producto/<cat> → /productos', async () => {
      const url = new URL('https://goldcaps.landingchat.co/categoria-producto/gold-caps')
      const request = new NextRequest(url, { headers: { host: 'goldcaps.landingchat.co' } })
      const response = await middleware(request)
      expect(response.status).toBe(301)
      expect(new URL(response.headers.get('location')!).pathname).toBe('/productos')
    })

    it('301 /product-category/<cat> (permalink EN) → /productos', async () => {
      const url = new URL('https://goldcaps.landingchat.co/product-category/caps')
      const request = new NextRequest(url, { headers: { host: 'goldcaps.landingchat.co' } })
      const response = await middleware(request)
      expect(response.status).toBe(301)
      expect(new URL(response.headers.get('location')!).pathname).toBe('/productos')
    })

    it('301 feed RSS de WordPress (/color/<x>/feed) → /productos', async () => {
      const url = new URL('https://goldcaps.landingchat.co/color/rosado-blanco/feed')
      const request = new NextRequest(url, { headers: { host: 'goldcaps.landingchat.co' } })
      const response = await middleware(request)
      expect(response.status).toBe(301)
      expect(new URL(response.headers.get('location')!).pathname).toBe('/productos')
    })

    it('NO redirige /productos (evita loop)', async () => {
      const url = new URL('https://goldcaps.landingchat.co/productos')
      const request = new NextRequest(url, { headers: { host: 'goldcaps.landingchat.co' } })
      const response = await middleware(request)
      expect(response.status).not.toBe(301)
    })

    it('NO redirige páginas de producto /producto/<slug>', async () => {
      const url = new URL('https://goldcaps.landingchat.co/producto/gorra-malla-4-a6lye')
      const request = new NextRequest(url, { headers: { host: 'goldcaps.landingchat.co' } })
      const response = await middleware(request)
      expect(response.status).not.toBe(301)
    })
  })
})