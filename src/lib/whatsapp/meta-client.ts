/**
 * Cliente para Meta WhatsApp Cloud API (Graph API v24.0)
 *
 * Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Este client es stateless — recibe phoneNumberId y token en cada llamada,
 * permitiendo que cada organización use sus propias credenciales.
 */

import type {
  MetaSendMessageResponse,
  MetaSendTextPayload,
  MetaSendMediaPayload,
  MetaSendTemplatePayload,
  MetaSendInteractivePayload,
  MetaMediaType,
  MetaBusinessProfile,
  MetaPhoneNumber,
  MetaMessageTemplate,
  MetaAPIError,
  TokenExchangeResponse,
} from "./meta-types"

const META_GRAPH_API_BASE = "https://graph.facebook.com/v24.0"

export class MetaCloudClient {
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || META_GRAPH_API_BASE
  }

  // ============================================
  // Headers
  // ============================================

  private getHeaders(token: string): HeadersInit {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }
  }

  // ============================================
  // Mensajería
  // ============================================

  /**
   * Envía un mensaje de texto
   */
  async sendTextMessage(
    phoneNumberId: string,
    token: string,
    to: string,
    text: string,
    previewUrl = false
  ): Promise<MetaSendMessageResponse> {
    const payload: MetaSendTextPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: previewUrl,
        body: text,
      },
    }

    return this.sendMessageWithRetry(phoneNumberId, token, payload)
  }

  /**
   * Envía un mensaje con media (imagen, video, audio, documento)
   */
  async sendMediaMessage(
    phoneNumberId: string,
    token: string,
    to: string,
    mediaType: MetaMediaType,
    url: string,
    caption?: string,
    filename?: string
  ): Promise<MetaSendMessageResponse> {
    const mediaData: Record<string, unknown> = { link: url }
    if (caption) mediaData.caption = caption
    if (filename && mediaType === "document") mediaData.filename = filename

    const payload: MetaSendMediaPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: mediaType,
      [mediaType]: mediaData,
    }

    return this.sendMessageWithRetry(phoneNumberId, token, payload)
  }

  /**
   * Envía un mensaje con template (para mensajes fuera de ventana de 24h)
   */
  async sendTemplateMessage(
    phoneNumberId: string,
    token: string,
    to: string,
    templateName: string,
    languageCode: string,
    components?: MetaSendTemplatePayload["template"]["components"]
  ): Promise<MetaSendMessageResponse> {
    const payload: MetaSendTemplatePayload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        components,
      },
    }

    return this.sendMessageWithRetry(phoneNumberId, token, payload)
  }

  /**
   * Envía un mensaje interactivo con botones de respuesta rápida (máximo 3)
   */
  async sendInteractiveButtons(
    phoneNumberId: string,
    token: string,
    to: string,
    body: string,
    buttons: Array<{ id: string; title: string }>,
    header?: string,
    footer?: string
  ): Promise<MetaSendMessageResponse> {
    const payload: MetaSendInteractivePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        ...(header ? { header: { type: "text", text: header } } : {}),
        body: { text: body },
        ...(footer ? { footer: { text: footer } } : {}),
        action: {
          buttons: buttons.slice(0, 3).map(b => ({
            type: "reply",
            reply: { id: b.id, title: b.title.substring(0, 20) }
          }))
        }
      }
    }

    return this.sendMessageWithRetry(phoneNumberId, token, payload)
  }

  /**
   * Envía un mensaje interactivo tipo lista (máximo 10 items)
   */
  async sendInteractiveList(
    phoneNumberId: string,
    token: string,
    to: string,
    body: string,
    buttonText: string,
    sections: Array<{
      title: string
      rows: Array<{ id: string; title: string; description?: string }>
    }>,
    header?: string,
    footer?: string
  ): Promise<MetaSendMessageResponse> {
    const payload: MetaSendInteractivePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        ...(header ? { header: { type: "text", text: header } } : {}),
        body: { text: body },
        ...(footer ? { footer: { text: footer } } : {}),
        action: {
          button: buttonText.substring(0, 20),
          sections: sections.map(s => ({
            title: s.title.substring(0, 24),
            rows: s.rows.slice(0, 10).map(r => ({
              id: r.id,
              title: r.title.substring(0, 24),
              ...(r.description ? { description: r.description.substring(0, 72) } : {})
            }))
          }))
        }
      }
    }

    return this.sendMessageWithRetry(phoneNumberId, token, payload)
  }

  /**
   * Marca un mensaje como leído
   */
  async markAsRead(
    phoneNumberId: string,
    token: string,
    messageId: string
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: this.getHeaders(token),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        }),
      }
    )

    if (!response.ok) {
      const error = await this.parseError(response)
      console.error("[MetaCloudClient] Error marking as read:", error)
      // No lanzar error — marcar como leído es best-effort
    }
  }

  // ============================================
  // Business Management
  // ============================================

  /**
   * Obtiene el perfil de negocio del número
   */
  async getBusinessProfile(
    phoneNumberId: string,
    token: string
  ): Promise<MetaBusinessProfile | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${phoneNumberId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`,
        {
          method: "GET",
          headers: this.getHeaders(token),
        }
      )

      if (!response.ok) {
        const error = await this.parseError(response)
        throw new Error(`Meta API error (${response.status}): ${error}`)
      }

      const data = await response.json()
      return data.data?.[0] || null
    } catch (error) {
      console.error("[MetaCloudClient] Error getting business profile:", error)
      return null
    }
  }

  /**
   * Obtiene los números de teléfono de un WABA
   */
  async getPhoneNumbers(
    wabaId: string,
    token: string
  ): Promise<MetaPhoneNumber[]> {
    const response = await fetch(
      `${this.baseUrl}/${wabaId}/phone_numbers`,
      {
        method: "GET",
        headers: this.getHeaders(token),
      }
    )

    if (!response.ok) {
      const error = await this.parseError(response)
      throw new Error(`Meta API error (${response.status}): ${error}`)
    }

    const data = await response.json()
    return data.data || []
  }

  /**
   * Obtiene las plantillas de mensaje de un WABA
   */
  async getMessageTemplates(
    wabaId: string,
    token: string
  ): Promise<MetaMessageTemplate[]> {
    const response = await fetch(
      `${this.baseUrl}/${wabaId}/message_templates?fields=name,status,category,language,components`,
      {
        method: "GET",
        headers: this.getHeaders(token),
      }
    )

    if (!response.ok) {
      const error = await this.parseError(response)
      throw new Error(`Meta API error (${response.status}): ${error}`)
    }

    const data = await response.json()
    return data.data || []
  }

  // ============================================
  // Webhook Subscription
  // ============================================

  /**
   * Suscribe el webhook de la app para recibir mensajes de WhatsApp.
   * Usa el WABA ID para suscribir la app al objeto whatsapp_business_account.
   *
   * Docs: https://developers.facebook.com/docs/whatsapp/embedded-signup/manage-accounts#subscribe
   */
  async subscribeWebhook(
    wabaId: string,
    token: string
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${wabaId}/subscribed_apps`,
        {
          method: "POST",
          headers: this.getHeaders(token),
        }
      )

      if (!response.ok) {
        const error = await this.parseError(response)
        console.error(`[MetaCloudClient] Error subscribing webhook for WABA ${wabaId}:`, error)
        return false
      }

      const data = await response.json()
      console.log(`[MetaCloudClient] Webhook subscribed for WABA ${wabaId}:`, data)
      return data.success === true
    } catch (error) {
      console.error("[MetaCloudClient] Error subscribing webhook:", error)
      return false
    }
  }

  /**
   * Verifica si la app está suscrita al webhook del WABA.
   */
  async checkWebhookSubscription(
    wabaId: string,
    token: string
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${wabaId}/subscribed_apps`,
        {
          method: "GET",
          headers: this.getHeaders(token),
        }
      )

      if (!response.ok) return false

      const data = await response.json()
      return (data.data?.length || 0) > 0
    } catch {
      return false
    }
  }

  // ============================================
  // OAuth / Token Exchange
  // ============================================

  /**
   * Intercambia un authorization code por un access token
   * (Usado después del Embedded Signup)
   */
  async exchangeCodeForToken(
    code: string,
    appId: string,
    appSecret: string
  ): Promise<TokenExchangeResponse> {
    const response = await fetch(
      `${this.baseUrl}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`,
      {
        method: "GET",
      }
    )

    if (!response.ok) {
      const error = await this.parseError(response)
      throw new Error(`Token exchange failed (${response.status}): ${error}`)
    }

    return response.json()
  }

  /**
   * Verifica la conexión consultando el número de teléfono
   */
  async testConnection(
    phoneNumberId: string,
    token: string
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
        {
          method: "GET",
          headers: this.getHeaders(token),
        }
      )
      return response.ok
    } catch {
      return false
    }
  }

  // ============================================
  // Utilidades internas
  // ============================================

  /**
   * Envía un mensaje con reintentos y backoff exponencial
   */
  private async sendMessageWithRetry(
    phoneNumberId: string,
    token: string,
    payload: MetaSendTextPayload | MetaSendMediaPayload | MetaSendTemplatePayload | MetaSendInteractivePayload | Record<string, unknown>,
    maxRetries = 3
  ): Promise<MetaSendMessageResponse> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(
          `${this.baseUrl}/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: this.getHeaders(token),
            body: JSON.stringify(payload),
          }
        )

        if (!response.ok) {
          const errorText = await this.parseError(response)
          const error = new Error(
            `Meta API error (${response.status}): ${errorText}`
          )

          // No reintentar errores 4xx (excepto 429 rate limit)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw error
          }

          lastError = error
        } else {
          return response.json()
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Si es error de cliente (no rate limit), no reintentar
        if (lastError.message.includes("Meta API error (4") && !lastError.message.includes("(429)")) {
          throw lastError
        }
      }

      if (attempt < maxRetries - 1) {
        // Backoff exponencial: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000
        console.log(`[MetaCloudClient] Retry ${attempt + 1}/${maxRetries} in ${delay}ms`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw lastError || new Error("Failed to send message after retries")
  }

  /**
   * Parsea error de respuesta Meta API
   */
  private async parseError(response: Response): Promise<string> {
    try {
      const body = await response.json() as MetaAPIError
      return body.error?.message || body.error?.error_data?.details || JSON.stringify(body)
    } catch {
      return `HTTP ${response.status} ${response.statusText}`
    }
  }
}
