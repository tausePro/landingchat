/**
 * Tipos para Meta WhatsApp Cloud API (Graph API v24.0)
 *
 * Ref: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

// ============================================
// Configuración global de la app Meta
// ============================================

export interface MetaWhatsAppConfig {
  app_id: string
  app_secret: string
  verify_token: string       // Token para verificación de webhook
  config_id?: string         // Configuration ID para Embedded Signup
  solution_id?: string       // Solution ID para Embedded Signup
}

// ============================================
// Envío de mensajes
// ============================================

export interface MetaSendMessageResponse {
  messaging_product: "whatsapp"
  contacts: Array<{
    input: string
    wa_id: string
  }>
  messages: Array<{
    id: string
  }>
}

export interface MetaSendTextPayload {
  messaging_product: "whatsapp"
  recipient_type: "individual"
  to: string
  type: "text"
  text: {
    preview_url?: boolean
    body: string
  }
}

export type MetaMediaType = "image" | "video" | "audio" | "document"

export interface MetaSendMediaPayload {
  messaging_product: "whatsapp"
  recipient_type: "individual"
  to: string
  type: MetaMediaType
  [key: string]: unknown  // image: {link, caption}, video: {link, caption}, etc.
}

export interface MetaSendTemplatePayload {
  messaging_product: "whatsapp"
  to: string
  type: "template"
  template: {
    name: string
    language: {
      code: string
    }
    components?: Array<{
      type: "header" | "body" | "button"
      parameters?: Array<{
        type: "text" | "currency" | "date_time" | "image" | "document" | "video"
        text?: string
        currency?: { fallback_value: string; code: string; amount_1000: number }
        date_time?: { fallback_value: string }
        image?: { link: string }
        document?: { link: string; filename: string }
        video?: { link: string }
      }>
      sub_type?: "quick_reply" | "url"
      index?: string
    }>
  }
}

export interface MetaSendInteractivePayload {
  messaging_product: "whatsapp"
  recipient_type: "individual"
  to: string
  type: "interactive"
  interactive: {
    type: "list" | "button" | "product" | "product_list"
    header?: {
      type: "text" | "image" | "video" | "document"
      text?: string
    }
    body: {
      text: string
    }
    footer?: {
      text: string
    }
    action: Record<string, unknown>
  }
}

// ============================================
// Webhook payloads (entrantes)
// ============================================

export interface MetaWebhookPayload {
  object: "whatsapp_business_account"
  entry: Array<{
    id: string  // WABA ID
    changes: Array<{
      value: MetaWebhookValue
      field: "messages"
    }>
  }>
}

export interface MetaWebhookValue {
  messaging_product: "whatsapp"
  metadata: {
    display_phone_number: string
    phone_number_id: string
  }
  contacts?: Array<{
    profile: {
      name: string
    }
    wa_id: string
  }>
  messages?: MetaWebhookMessage[]
  statuses?: MetaWebhookStatus[]
  errors?: Array<{
    code: number
    title: string
    message: string
    error_data?: {
      details: string
    }
  }>
}

export type MetaWebhookMessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "location"
  | "contacts"
  | "sticker"
  | "reaction"
  | "interactive"
  | "button"
  | "order"
  | "unknown"

export interface MetaWebhookMessage {
  from: string           // Número del remitente (sin +)
  id: string             // wamid.xxx
  timestamp: string      // Unix timestamp string
  type: MetaWebhookMessageType
  text?: {
    body: string
  }
  image?: {
    id: string
    mime_type: string
    sha256: string
    caption?: string
  }
  video?: {
    id: string
    mime_type: string
    sha256: string
    caption?: string
  }
  audio?: {
    id: string
    mime_type: string
    sha256: string
  }
  document?: {
    id: string
    mime_type: string
    sha256: string
    filename: string
    caption?: string
  }
  location?: {
    latitude: number
    longitude: number
    name?: string
    address?: string
  }
  sticker?: {
    id: string
    mime_type: string
    sha256: string
    animated: boolean
  }
  reaction?: {
    message_id: string
    emoji: string
  }
  interactive?: {
    type: "button_reply" | "list_reply"
    button_reply?: {
      id: string
      title: string
    }
    list_reply?: {
      id: string
      title: string
      description?: string
    }
  }
  button?: {
    text: string
    payload: string
  }
  context?: {
    from: string
    id: string
    referred_product?: {
      catalog_id: string
      product_retailer_id: string
    }
  }
}

export type MetaWebhookStatusType = "sent" | "delivered" | "read" | "failed"

export interface MetaWebhookStatus {
  id: string              // wamid.xxx del mensaje original
  recipient_id: string    // Número del destinatario
  status: MetaWebhookStatusType
  timestamp: string
  conversation?: {
    id: string
    origin: {
      type: "business_initiated" | "user_initiated" | "referral_conversion"
    }
    expiration_timestamp?: string
  }
  pricing?: {
    billable: boolean
    pricing_model: "CBP"
    category: "authentication" | "marketing" | "utility" | "service" | "referral_conversion"
  }
  errors?: Array<{
    code: number
    title: string
    message: string
    error_data?: {
      details: string
    }
    href?: string
  }>
}

// ============================================
// Embedded Signup
// ============================================

export interface EmbeddedSignupResponse {
  phone_number_id: string
  waba_id: string
  code: string  // Authorization code para token exchange
}

export interface TokenExchangeResponse {
  access_token: string
  token_type: "bearer"
}

// ============================================
// Business Management
// ============================================

export interface MetaPhoneNumber {
  id: string
  display_phone_number: string
  verified_name: string
  quality_rating: "GREEN" | "YELLOW" | "RED" | "UNKNOWN"
  status: string
  name_status: string
}

export interface MetaBusinessProfile {
  about?: string
  address?: string
  description?: string
  email?: string
  messaging_product: "whatsapp"
  profile_picture_url?: string
  vertical?: string
  websites?: string[]
}

export interface MetaMessageTemplate {
  id: string
  name: string
  status: "APPROVED" | "PENDING" | "REJECTED"
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION"
  language: string
  components: Array<{
    type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS"
    text?: string
    format?: string
    buttons?: Array<{
      type: string
      text: string
      url?: string
      phone_number?: string
    }>
  }>
}

// ============================================
// Error Response
// ============================================

export interface MetaAPIError {
  error: {
    message: string
    type: string
    code: number
    error_subcode?: number
    fbtrace_id?: string
    error_data?: {
      messaging_product: "whatsapp"
      details: string
    }
  }
}
