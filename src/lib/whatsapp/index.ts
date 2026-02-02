/**
 * WhatsApp module barrel export
 *
 * Provider agnóstico — Los consumidores importan de aquí
 * sin necesitar saber si se usa Meta Cloud API o Evolution API.
 */

// Provider (punto de entrada principal)
export {
  sendWhatsAppMessage,
  getMetaWhatsAppConfig,
  findInstanceByMetaPhoneNumberId,
} from "./provider"

// Meta Cloud API Client (para uso directo cuando se necesite)
export { MetaCloudClient } from "./meta-client"

// Tipos Meta
export type {
  MetaWhatsAppConfig,
  MetaSendMessageResponse,
  MetaWebhookPayload,
  MetaWebhookValue,
  MetaWebhookMessage,
  MetaWebhookStatus,
  MetaWebhookMessageType,
  MetaWebhookStatusType,
  MetaPhoneNumber,
  MetaBusinessProfile,
  MetaMessageTemplate,
  MetaAPIError,
  EmbeddedSignupResponse,
  TokenExchangeResponse,
} from "./meta-types"
