/**
 * Catálogo central de tipos de eventos del backbone event-sourced
 * (`platform_events`). Cualquier evento nuevo se agrega aquí — la tabla
 * NO tiene CHECK de event_type a propósito, para evolucionar sin migración.
 *
 * Spec: .kiro/specs/copilot-merchant-loop-v0/design.md §2.1
 */
export const PLATFORM_EVENT_TYPES = {
    // Commerce
    ORDER_CREATED: 'order.created',
    ORDER_PAID: 'order.paid',
    ORDER_CANCELLED: 'order.cancelled',
    CART_ABANDONED: 'cart.abandoned',
    CUSTOMER_FIRST_PURCHASE: 'customer.first_purchase',
    CUSTOMER_REPEAT_PURCHASE: 'customer.repeat_purchase',
    CUSTOMER_CHURN_RISK: 'customer.churn_risk',

    // Conversational
    CHAT_STARTED: 'chat.started',
    CHAT_HANDED_OFF_TO_HUMAN: 'chat.handed_off_to_human',

    // Copilot lifecycle
    COPILOT_INSIGHT_PROPOSED: 'copilot.insight_proposed',
    COPILOT_INSIGHT_APPROVED: 'copilot.insight_approved',
    COPILOT_INSIGHT_DISMISSED: 'copilot.insight_dismissed',
    COPILOT_ACTION_EXECUTED: 'copilot.action_executed',
    /** Mensaje de texto libre de un merchant al número platform, procesado por Atlas (dedupe + rate limit). */
    ATLAS_CHAT_REPLY: 'copilot.atlas_chat_reply',
} as const

export type PlatformEventType = typeof PLATFORM_EVENT_TYPES[keyof typeof PLATFORM_EVENT_TYPES]

export const ALL_PLATFORM_EVENT_TYPES = Object.values(PLATFORM_EVENT_TYPES)

export type PlatformEventSource = 'web' | 'whatsapp' | 'webhook' | 'system' | 'copilot'
