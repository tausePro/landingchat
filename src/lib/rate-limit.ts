/**
 * @file Rate limiting utilities using Upstash Redis
 * @description Implements sliding window rate limiting for API endpoints.
 *
 * Política fail-closed en producción (Fase 0.3, Bug D):
 * Cuando Redis no está configurado (falta UPSTASH_REDIS_REST_URL/TOKEN o su
 * fallback Vercel KV), los rate limiters exportados caen a `mockRateLimit`.
 * El mock se comporta según NODE_ENV:
 *   - production: success:false (fail-closed) → endpoints devuelven 429.
 *     Previene que la plataforma acepte tráfico ilimitado si Redis cae o las
 *     credenciales se rotan mal. Un ataque o pico no puede generar costo
 *     ilimitado en Anthropic/DB sin protección.
 *   - development/test: success:true (fail-open) → permite trabajar local sin
 *     tener que instalar Upstash.
 * Además, al cargar el módulo se emite un log único (error en prod, warn en
 * dev) para que el operador sepa inmediatamente en qué modo está corriendo.
 */

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { logger } from "@/lib/logger"

const log = logger("rate-limit")

// Resolve Redis URL/Token: Vercel integration uses KV_REST_API_*, Upstash SDK uses UPSTASH_REDIS_REST_*
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

const isRedisConfigured = redisUrl && redisToken && redisUrl.startsWith('https')

// Initialize Redis client only if properly configured
let redis: Redis | null = null
if (isRedisConfigured) {
  redis = new Redis({
    url: redisUrl!,
    token: redisToken!,
  })
}

// Log único al module load cuando Redis no está configurado.
// Solo durante runtime real (no en build ni en tests):
//   - production: log.error (fail-closed activo, operador debe saber)
//   - development: log.warn (fail-open, recordatorio)
// Se excluye NODE_ENV=test (ruido en Vitest) y NEXT_PHASE=phase-production-build
// (cada worker de static generation cargaría el módulo y repetiría el log).
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build"
if (!isRedisConfigured && process.env.NODE_ENV !== "test" && !isBuildPhase) {
  if (process.env.NODE_ENV === "production") {
    log.error(
      "FAIL-CLOSED mode: Redis no configurado (UPSTASH_REDIS_REST_URL/TOKEN ni KV_REST_API_URL/TOKEN). " +
      "Todos los endpoints rate-limitados devolverán 429 hasta que las credenciales se restauren."
    )
  } else {
    log.warn(
      "FAIL-OPEN mode (development): Redis no configurado. " +
      "Rate limits deshabilitados localmente. Configurar UPSTASH_REDIS_REST_URL para probar con protección real."
    )
  }
}

// Mock rate limiter cuando Redis no está disponible.
// El valor de `success` se decide en cada llamada leyendo NODE_ENV, lo que
// permite a los tests hacer `vi.stubEnv('NODE_ENV', ...)` entre casos sin
// reimportar el módulo.
const mockRateLimit = {
  limit: async () => {
    const isProd = process.env.NODE_ENV === "production"
    return {
      success: !isProd,
      limit: 10,
      remaining: isProd ? 0 : 9,
      reset: Date.now() + 60000,
      pending: Promise.resolve()
    }
  }
}

// AI Chat rate limiter: 10 requests per minute per IP
export const aiChatRateLimit = redis ? new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
  prefix: "ratelimit:ai-chat",
}) : mockRateLimit

// Store public endpoints: 30 requests per minute per IP
export const storeApiRateLimit = redis ? new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  analytics: true,
  prefix: "ratelimit:store-api",
}) : mockRateLimit

// Chat init: 5 per minute per IP (crear sesiones)
export const chatInitRateLimit = redis ? new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  analytics: true,
  prefix: "ratelimit:chat-init",
}) : mockRateLimit

// Bookings: 3 per minute per IP
export const bookingsRateLimit = redis ? new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(3, "1 m"),
  analytics: true,
  prefix: "ratelimit:bookings",
}) : mockRateLimit

// Generic rate limiter factory
export function createRateLimit(requests: number, windowMs: number, prefix: string) {
  if (!redis) {
    return mockRateLimit
  }
  
  return new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(requests, `${windowMs} ms`),
    analytics: true,
    prefix: `ratelimit:${prefix}`,
  })
}

// Rate limit response headers
export function getRateLimitHeaders(result: { limit: number; remaining: number; reset: number }) {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.reset).toISOString(),
  }
}

// Get client identifier for rate limiting
export function getClientIdentifier(request: Request): string {
  // Try to get IP from various headers (for different deployment environments)
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  
  // Use the first available IP, fallback to 'anonymous'
  const ip = forwarded?.split(',')[0] || realIp || cfConnectingIp || 'anonymous'
  
  return ip.trim()
}