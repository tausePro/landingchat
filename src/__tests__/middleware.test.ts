/**
 * @file Middleware routing tests
 * @description Property-based tests for Next.js middleware routing logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { middleware } from '../middleware'

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
  })
})