/**
 * @file Rate limiting utilities using Upstash Redis
 * @description Implements sliding window rate limiting for API endpoints
 */

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Check if Redis is properly configured
const isRedisConfigured = process.env.UPSTASH_REDIS_REST_URL && 
                         process.env.UPSTASH_REDIS_REST_TOKEN &&
                         process.env.UPSTASH_REDIS_REST_URL.startsWith('https')

// Initialize Redis client only if properly configured
let redis: Redis | null = null
if (isRedisConfigured) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

// Mock rate limiter for when Redis is not available
const mockRateLimit = {
  limit: async () => ({
    success: true,
    limit: 10,
    remaining: 9,
    reset: Date.now() + 60000,
    pending: Promise.resolve()
  })
}

// AI Chat rate limiter: 10 requests per minute per IP
export const aiChatRateLimit = redis ? new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
  prefix: "ratelimit:ai-chat",
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