import type { StorefrontTemplateVersion } from "@/types/storefront"

export const STOREFRONT_EVENT_NAMES = {
    heroViewed: "storefront.hero_viewed",
    heroCtaClicked: "storefront.hero_cta_clicked",
    productViewed: "storefront.product_viewed",
    productCtaClicked: "storefront.product_cta_clicked",
    chatOpened: "storefront.chat_opened",
    whatsappCtaClicked: "storefront.whatsapp_cta_clicked",
} as const

export type StorefrontCanonicalEventName = typeof STOREFRONT_EVENT_NAMES[keyof typeof STOREFRONT_EVENT_NAMES]

export type StorefrontEventChannel = "web" | "whatsapp" | "instagram" | "messenger" | "system"
export type StorefrontEventEntityType = "product" | "property" | "page" | "hero" | "cta" | "chat"

export interface StorefrontCanonicalEvent {
    id: string
    organizationId: string
    organizationSlug?: string
    sessionId?: string
    customerId?: string
    chatId?: string
    channel: StorefrontEventChannel
    surface: "storefront"
    eventName: StorefrontCanonicalEventName
    entityType?: StorefrontEventEntityType
    entityId?: string
    templateKey?: string
    templateVersion?: StorefrontTemplateVersion
    metadata: Record<string, unknown>
    occurredAt: string
}

export interface CreateStorefrontCanonicalEventInput {
    id?: string
    organizationId: string
    organizationSlug?: string
    sessionId?: string
    customerId?: string
    chatId?: string
    channel?: StorefrontEventChannel
    eventName: StorefrontCanonicalEventName
    entityType?: StorefrontEventEntityType
    entityId?: string
    templateKey?: string
    templateVersion?: StorefrontTemplateVersion
    metadata?: Record<string, unknown>
    occurredAt?: string
}

function createEventId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID()
    }

    return `storefront_${Date.now()}`
}

export function isStorefrontCanonicalEventName(value: string): value is StorefrontCanonicalEventName {
    return Object.values(STOREFRONT_EVENT_NAMES).includes(value as StorefrontCanonicalEventName)
}

export function createStorefrontCanonicalEvent(input: CreateStorefrontCanonicalEventInput): StorefrontCanonicalEvent {
    return {
        id: input.id || createEventId(),
        organizationId: input.organizationId,
        organizationSlug: input.organizationSlug,
        sessionId: input.sessionId,
        customerId: input.customerId,
        chatId: input.chatId,
        channel: input.channel || "web",
        surface: "storefront",
        eventName: input.eventName,
        entityType: input.entityType,
        entityId: input.entityId,
        templateKey: input.templateKey,
        templateVersion: input.templateVersion,
        metadata: input.metadata || {},
        occurredAt: input.occurredAt || new Date().toISOString(),
    }
}

export function toPosthogStorefrontEvent(event: StorefrontCanonicalEvent): {
    event: StorefrontCanonicalEventName
    properties: Record<string, unknown>
} {
    return {
        event: event.eventName,
        properties: {
            surface: event.surface,
            channel: event.channel,
            organizationId: event.organizationId,
            organizationSlug: event.organizationSlug,
            sessionId: event.sessionId,
            customerId: event.customerId,
            chatId: event.chatId,
            entityType: event.entityType,
            entityId: event.entityId,
            templateKey: event.templateKey,
            templateVersion: event.templateVersion,
            occurredAt: event.occurredAt,
            ...event.metadata,
        },
    }
}
