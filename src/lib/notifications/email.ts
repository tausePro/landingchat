/**
 * Email notification service for order confirmations.
 * Uses Resend API for sending transactional emails.
 *
 * T1.3i — i18n-aware: cada email recibe `locale` y `currency` del tenant
 * (default `es-CO` / `COP` para retro-compatibilidad). Tantor's House
 * (`en-US`/`USD`) recibe el email en inglés con precios en USD.
 */

import { Resend } from 'resend'
import { appendVariantToItemName } from '@/lib/utils/variantInfo'
import { t } from '@/lib/i18n/storefront-strings'
import { formatCurrency } from '@/lib/utils'
import type { SupportedCurrency, SupportedLocale } from '@/types/organization'

// Initialize Resend client
// Use a fallback key to prevent crash during module evaluation if env var is missing
const resend = new Resend(process.env.RESEND_API_KEY || 're_missing_key')

interface OrderEmailData {
    orderNumber: string
    customerName: string
    customerEmail: string
    total: number
    items: Array<{
        name: string
        quantity: number
        price: number
        variant_title?: string | null
    }>
    paymentMethod: string
    organizationName: string
    storeUrl: string
    orderUrl: string
    /**
     * Locale del tenant (BCP 47). Default `'es-CO'` por retro-compatibilidad
     * con tenants existentes. Tantor's House pasa `'en-US'`.
     */
    locale?: SupportedLocale
    /**
     * Currency del tenant (ISO 4217). Default `'COP'`. Tantor pasa `'USD'`.
     */
    currency?: SupportedCurrency
}

/**
 * Send order confirmation email to customer
 */
export async function sendOrderConfirmationEmail(data: OrderEmailData): Promise<boolean> {
    try {
        // Skip email sending if no API key is configured
        if (!process.env.RESEND_API_KEY) {
            console.log(`[EMAIL] Resend API key not configured, skipping email to ${data.customerEmail}`)
            return true
        }

        // Skip if customer email is empty
        if (!data.customerEmail || data.customerEmail.trim() === '') {
            console.log(`[EMAIL] Customer email is empty, skipping email notification`)
            return true
        }
        
        const locale: SupportedLocale = data.locale ?? "es-CO"
        const currency: SupportedCurrency = data.currency ?? "COP"
        const emailContent = generateOrderEmailHTML(data, locale, currency)
        const subject = t("email.order_confirmation.subject", locale, {
            orderNumber: data.orderNumber,
            organizationName: data.organizationName,
        })

        console.log(`[EMAIL] Sending order confirmation to ${data.customerEmail} for order ${data.orderNumber} (locale=${locale}, currency=${currency})`)

        const response = await resend.emails.send({
            from: `${data.organizationName} <noreply@landingchat.co>`,
            to: data.customerEmail,
            subject,
            html: emailContent,
        })

        if (response.error) {
            console.error('[EMAIL] Resend error:', response.error)
            return false
        }

        console.log(`[EMAIL] Order confirmation sent successfully to ${data.customerEmail}, ID: ${response.data?.id}`)
        return true
        
    } catch (error) {
        console.error('[EMAIL] Error sending order confirmation:', error)
        return false
    }
}

/**
 * Generate HTML email template for order confirmation.
 *
 * @param locale  Locale del tenant (BCP 47). Determina los strings i18n.
 * @param currency Currency del tenant (ISO 4217). Determina el formato de
 *                 los precios en el email (`Intl.NumberFormat`).
 */
function generateOrderEmailHTML(
    data: OrderEmailData,
    locale: SupportedLocale,
    currency: SupportedCurrency,
): string {
    const formatPrice = (amount: number) =>
        formatCurrency(amount, { locale, currency })

    const itemsHTML = data.items.map(item => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                ${appendVariantToItemName(item.name, item.variant_title)}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
                ${item.quantity}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
                ${formatPrice(item.price)}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">
                ${formatPrice(item.price * item.quantity)}
            </td>
        </tr>
    `).join('')

    // Resolución de método de pago: si es 'manual' lo traducimos, sino dejamos
    // el string crudo del provider (Wompi, MercadoPago, etc.) que ya viene
    // formateado en su propia capa.
    const paymentMethodLabel = data.paymentMethod === 'manual'
        ? t("email.order_confirmation.payment_bank_transfer", locale)
        : data.paymentMethod

    const isManualPayment = data.paymentMethod === 'manual'

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t("email.order_confirmation.title", locale)}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb;">
            <h1 style="color: #1f2937; margin: 0; font-size: 28px;">${data.organizationName}</h1>
            <p style="color: #6b7280; margin: 8px 0 0 0;">${t("email.order_confirmation.title", locale)}</p>
        </div>

        <!-- Success Message -->
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
            <h2 style="color: #166534; margin: 0 0 8px 0;">${t("email.order_confirmation.thanks_heading", locale)}</h2>
            <p style="color: #166534; margin: 0;">${t("email.order_confirmation.thanks_body", locale)}</p>
        </div>

        <!-- Order Details -->
        <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 30px;">
            <h3 style="margin: 0 0 16px 0; color: #1f2937;">${t("email.order_confirmation.order_details_heading", locale)}</h3>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span style="color: #6b7280;">${t("email.order_confirmation.order_number_label", locale)}</span>
                <span style="font-weight: 600; font-family: monospace;">${data.orderNumber}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span style="color: #6b7280;">${t("email.order_confirmation.customer_label", locale)}</span>
                <span style="font-weight: 600;">${data.customerName}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span style="color: #6b7280;">${t("email.order_confirmation.payment_method_label", locale)}</span>
                <span style="font-weight: 600;">${paymentMethodLabel}</span>
            </div>
        </div>

        <!-- Items Table -->
        <div style="margin-bottom: 30px;">
            <h3 style="margin: 0 0 16px 0; color: #1f2937;">${t("email.order_confirmation.products_heading", locale)}</h3>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                    <tr style="background: #f3f4f6;">
                        <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">${t("email.order_confirmation.table_product", locale)}</th>
                        <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">${t("email.order_confirmation.table_quantity", locale)}</th>
                        <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">${t("email.order_confirmation.table_price", locale)}</th>
                        <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">${t("email.order_confirmation.table_total", locale)}</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
                <tfoot>
                    <tr style="background: #f3f4f6;">
                        <td colspan="3" style="padding: 16px; font-weight: 600; text-align: right;">${t("email.order_confirmation.total_to_pay", locale)}</td>
                        <td style="padding: 16px; font-weight: 700; text-align: right; font-size: 18px; color: #059669;">
                            ${formatPrice(data.total)}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>

        ${isManualPayment ? `
        <!-- Payment Instructions -->
        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <h3 style="margin: 0 0 16px 0; color: #92400e;">${t("email.order_confirmation.payment_instructions_heading", locale)}</h3>
            <div style="color: #92400e;">
                <p>${t("email.order_confirmation.payment_instructions_body", locale)}</p>
                <div style="background: #fbbf24; padding: 12px; border-radius: 6px; margin-top: 16px;">
                    <strong>${t("email.order_confirmation.payment_important_label", locale)}</strong> ${t("email.order_confirmation.payment_keep_order_number", locale, { orderNumber: `<strong>${data.orderNumber}</strong>` })}
                </div>
            </div>
        </div>
        ` : ''}

        <!-- Next Steps -->
        <div style="background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <h3 style="margin: 0 0 16px 0; color: #1e40af;">${t("email.order_confirmation.next_steps_heading", locale)}</h3>
            <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
                <li>${t("email.order_confirmation.next_step_notify", locale)}</li>
                <li>${t("email.order_confirmation.next_step_tracking", locale)}</li>
                <li>${t("email.order_confirmation.next_step_contact", locale)}</li>
            </ul>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding-top: 30px; border-top: 1px solid #e5e7eb; color: #6b7280;">
            <p>${t("email.order_confirmation.footer_questions", locale)}</p>
            <div style="margin: 16px 0 0 0; display: flex; justify-content: center; gap: 16px;">
                <a href="${data.orderUrl}" style="color: #3b82f6; text-decoration: none;">${t("email.order_confirmation.footer_view_order", locale)}</a>
                <span style="color: #d1d5db;">|</span>
                <a href="${data.storeUrl}" style="color: #3b82f6; text-decoration: none;">${t("email.order_confirmation.footer_visit_store", locale)}</a>
            </div>
        </div>

    </body>
    </html>
    `
}

/**
 * Send order notification email to store owner.
 *
 * T1.3i — Recibe `locale` y `currency` opcionales del tenant. Default es-CO/COP.
 */
export async function sendOrderNotificationToOwner(data: {
    orderNumber: string
    customerName: string
    customerEmail: string
    total: number
    items: Array<{ name: string; quantity: number; price: number; variant_title?: string | null }>
    ownerEmail: string
    /** Correos adicionales de notificación (además del ownerEmail). */
    additionalEmails?: string[]
    organizationName: string
    locale?: SupportedLocale
    currency?: SupportedCurrency
}): Promise<boolean> {
    try {
        // Skip email sending if no API key is configured
        if (!process.env.RESEND_API_KEY) {
            console.log(`[EMAIL] Resend API key not configured, skipping owner notification`)
            return true
        }

        // Destinatarios: ownerEmail (contact_email) + correos adicionales del merchant.
        const recipients = Array.from(new Set(
            [data.ownerEmail, ...(data.additionalEmails ?? [])]
                .map((e) => (typeof e === "string" ? e.trim() : ""))
                .filter((e) => e.length > 0)
        ))
        if (recipients.length === 0) {
            console.log(`[EMAIL] No owner recipients, skipping owner notification`)
            return true
        }

        const locale: SupportedLocale = data.locale ?? "es-CO"
        const currency: SupportedCurrency = data.currency ?? "COP"
        const emailContent = generateOwnerNotificationHTML(data, locale, currency)
        const subject = t("email.owner_notification.subject", locale, {
            orderNumber: data.orderNumber,
            organizationName: data.organizationName,
        })

        console.log(`[EMAIL] Sending new order notification to owner ${data.ownerEmail} for order ${data.orderNumber} (locale=${locale}, currency=${currency})`)

        const response = await resend.emails.send({
            from: `LandingChat <noreply@landingchat.co>`,
            to: recipients,
            subject,
            html: emailContent,
        })

        if (response.error) {
            console.error('[EMAIL] Resend error for owner notification:', response.error)
            return false
        }

        console.log(`[EMAIL] Owner notification sent successfully to ${data.ownerEmail}, ID: ${response.data?.id}`)
        return true
        
    } catch (error) {
        console.error('[EMAIL] Error sending owner notification:', error)
        return false
    }
}

/**
 * Genera el HTML del email de notificación al owner.
 *
 * @param locale  Locale del tenant (BCP 47).
 * @param currency Currency del tenant (ISO 4217).
 */
function generateOwnerNotificationHTML(
    data: {
        orderNumber: string
        customerName: string
        customerEmail: string
        total: number
        items: Array<{ name: string; quantity: number; price: number; variant_title?: string | null }>
        organizationName: string
    },
    locale: SupportedLocale,
    currency: SupportedCurrency,
): string {
    const formatPrice = (amount: number) =>
        formatCurrency(amount, { locale, currency })

    const itemsHTML = data.items.map(item => `
        <li>${item.quantity}x ${appendVariantToItemName(item.name, item.variant_title)} - ${formatPrice(item.price * item.quantity)}</li>
    `).join('')

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>${t("email.owner_notification.title", locale)}</title>
    </head>
    <body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h2 style="color: #166534; margin: 0;">${t("email.owner_notification.heading", locale)}</h2>
        </div>
        
        <h3>${t("email.owner_notification.order_details_heading", locale)}</h3>
        <p><strong>${t("email.owner_notification.number_label", locale)}</strong> ${data.orderNumber}</p>
        <p><strong>${t("email.owner_notification.customer_label", locale)}</strong> ${data.customerName}</p>
        <p><strong>${t("email.owner_notification.email_label", locale)}</strong> ${data.customerEmail}</p>
        <p><strong>${t("email.owner_notification.total_label", locale)}</strong> ${formatPrice(data.total)}</p>
        
        <h3>${t("email.owner_notification.products_heading", locale)}</h3>
        <ul>${itemsHTML}</ul>
        
        <p style="margin-top: 30px; padding: 15px; background: #f3f4f6; border-radius: 6px;">
            ${t("email.owner_notification.dashboard_hint", locale, { organizationName: data.organizationName })}
        </p>
    </body>
    </html>
    `
}

// ============================================================================
// Atlas Copilot — insight semanal por correo (canal REDUNDANTE)
// ============================================================================
// Llega aunque el WhatsApp del merchant falle. El cuerpo ya viene en el locale
// del tenant (lo compone insightComposer); el chrome del email es es-CO.

function escapeHtml(input: string): string {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
}

function generateCopilotInsightHTML(data: {
    title: string
    body: string
    proposedActions?: Array<{ human_label: string }>
    organizationName: string
}): string {
    const bodyHtml = escapeHtml(data.body).replace(/\n/g, "<br>")
    const actions = data.proposedActions ?? []
    const actionsHtml = actions.length > 0
        ? `<h3 style="margin: 24px 0 8px 0; color: #1f2937;">Acciones propuestas</h3>
           <ul style="margin: 0; padding-left: 20px; color: #374151;">
             ${actions.map((a) => `<li style="margin-bottom: 6px;">${escapeHtml(a.human_label)}</li>`).join("")}
           </ul>`
        : ""

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Atlas Copilot</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #e5e7eb;">
            <p style="color: #6b7280; margin: 0; font-size: 14px;">Atlas Copilot — Reporte semanal</p>
            <h1 style="color: #1f2937; margin: 8px 0 0 0; font-size: 22px;">${escapeHtml(data.title)}</h1>
        </div>

        <div style="color: #374151; font-size: 15px;">${bodyHtml}</div>

        ${actionsHtml}

        <div style="margin-top: 28px; text-align: center;">
            <a href="https://landingchat.co/dashboard/copilot"
               style="display: inline-block; background: #1f2937; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
                Ver y aprobar acciones
            </a>
        </div>

        <p style="margin-top: 28px; color: #9ca3af; font-size: 12px; text-align: center;">
            ${escapeHtml(data.organizationName)} · LandingChat
        </p>
    </body>
    </html>
    `
}

/**
 * Envía el insight semanal de Atlas Copilot por correo al dueño (+ correos
 * adicionales de `notification_emails`). Canal redundante al WhatsApp.
 * Devuelve el status para registrarlo en `notification_logs`.
 */
export async function sendCopilotInsightEmail(data: {
    ownerEmail: string
    additionalEmails?: string[]
    title: string
    body: string
    proposedActions?: Array<{ human_label: string }>
    organizationName: string
}): Promise<{ status: "sent" | "skipped" | "failed"; error?: string }> {
    try {
        if (!process.env.RESEND_API_KEY) {
            console.log(`[EMAIL] Resend API key not configured, skipping copilot insight email`)
            return { status: "skipped" }
        }

        const recipients = Array.from(new Set(
            [data.ownerEmail, ...(data.additionalEmails ?? [])]
                .map((e) => (typeof e === "string" ? e.trim() : ""))
                .filter((e) => e.length > 0)
        ))
        if (recipients.length === 0) {
            console.log(`[EMAIL] No owner recipients for copilot insight, skipping`)
            return { status: "skipped" }
        }

        const response = await resend.emails.send({
            from: `Atlas Copilot <noreply@landingchat.co>`,
            to: recipients,
            subject: `Atlas Copilot — ${data.title}`,
            html: generateCopilotInsightHTML(data),
        })

        if (response.error) {
            console.error("[EMAIL] Resend error for copilot insight:", response.error)
            return {
                status: "failed",
                error: JSON.stringify(response.error),
            }
        }

        console.log(`[EMAIL] Copilot insight sent to ${recipients.length} recipient(s), ID: ${response.data?.id}`)
        return { status: "sent" }
    } catch (error) {
        console.error("[EMAIL] Error sending copilot insight:", error)
        return { status: "failed", error: error instanceof Error ? error.message : "unknown" }
    }
}

// ============================================================================
// Email order-paid (T1.6 — markOrderAsPaid)
// ============================================================================
// Se dispara desde `runPaidOrderSideEffects` cada vez que una orden pasa a
// `payment_status='paid'` por primera vez. Cubre tanto confirmaciones
// manuales desde el dashboard (T1.6) como webhooks Wompi/ePayco automáticos.
//
// Idioma + currency siguen el locale del tenant (mismo patrón que T1.3i).
// Tantor's House (en-US/USD) recibe el email en inglés con precios USD.

interface OrderPaidEmailData {
    orderNumber: string
    customerName: string
    customerEmail: string
    total: number
    paymentMethod: string
    organizationName: string
    orderUrl: string
    /**
     * Locale del tenant (BCP 47). Default `'es-CO'` por retro-compat.
     */
    locale?: SupportedLocale
    /**
     * Currency del tenant (ISO 4217). Default `'COP'`.
     */
    currency?: SupportedCurrency
    /**
     * Timestamp UTC de confirmación. Default `now()` al render.
     */
    confirmedAt?: string
}

/**
 * Envía el email "Pago confirmado" al cliente.
 *
 * Retorna `true` si:
 *   - El email se mandó correctamente.
 *   - No había `RESEND_API_KEY` (no-op silencioso, no es error).
 *   - El cliente no tenía email (no-op).
 *
 * Retorna `false` solo en errores reales del envío. Errores no rompen el flow
 * del caller — la confirmación del pago no debe fallar por un email.
 */
export async function sendOrderPaidEmail(data: OrderPaidEmailData): Promise<boolean> {
    try {
        if (!process.env.RESEND_API_KEY) {
            console.log(`[EMAIL] Resend API key not configured, skipping order-paid email to ${data.customerEmail}`)
            return true
        }

        if (!data.customerEmail || data.customerEmail.trim() === '') {
            console.log(`[EMAIL] Customer email is empty, skipping order-paid email`)
            return true
        }

        const locale: SupportedLocale = data.locale ?? "es-CO"
        const currency: SupportedCurrency = data.currency ?? "COP"
        const emailContent = generateOrderPaidEmailHTML(data, locale, currency)
        const subject = t("email.order_paid.subject", locale, {
            orderNumber: data.orderNumber,
            organizationName: data.organizationName,
        })

        console.log(`[EMAIL] Sending order-paid to ${data.customerEmail} for order ${data.orderNumber} (locale=${locale}, currency=${currency})`)

        const response = await resend.emails.send({
            from: `${data.organizationName} <noreply@landingchat.co>`,
            to: data.customerEmail,
            subject,
            html: emailContent,
        })

        if (response.error) {
            console.error('[EMAIL] Resend error for order-paid:', response.error)
            return false
        }

        console.log(`[EMAIL] Order-paid sent successfully to ${data.customerEmail}, ID: ${response.data?.id}`)
        return true
    } catch (error) {
        console.error('[EMAIL] Error sending order-paid:', error)
        return false
    }
}

// ============================================================================
// Email de cambio de estado del pedido al COMPRADOR
// ============================================================================

function orderStatusLabel(status: string, locale: SupportedLocale): string | null {
    switch (status) {
        case "processing": return t("email.order_status.label_processing", locale)
        case "shipped": return t("email.order_status.label_shipped", locale)
        case "delivered": return t("email.order_status.label_delivered", locale)
        case "cancelled": return t("email.order_status.label_cancelled", locale)
        default: return null
    }
}

/**
 * Email al comprador cuando su pedido cambia de estado (en preparación, enviado,
 * entregado, cancelado). Estados sin label → no-op (no notifica). Mismo contrato
 * que los demás: sin API key o sin email → no-op true; false solo en error real.
 */
export async function sendOrderStatusEmail(data: {
    orderNumber: string
    customerName: string
    customerEmail: string
    status: string
    organizationName: string
    orderUrl: string
    locale?: SupportedLocale
    currency?: SupportedCurrency
}): Promise<boolean> {
    try {
        if (!process.env.RESEND_API_KEY) {
            console.log(`[EMAIL] Resend API key not configured, skipping status email`)
            return true
        }
        if (!data.customerEmail || data.customerEmail.trim() === "") {
            console.log(`[EMAIL] Customer email is empty, skipping status email`)
            return true
        }
        const locale: SupportedLocale = data.locale ?? "es-CO"
        const statusLabel = orderStatusLabel(data.status, locale)
        if (!statusLabel) {
            return true // estado sin notificación al comprador (pending/confirmed/etc.)
        }
        const subject = t("email.order_status.subject", locale, {
            orderNumber: data.orderNumber,
            statusLabel,
        })
        const response = await resend.emails.send({
            from: `${data.organizationName} <noreply@landingchat.co>`,
            to: data.customerEmail,
            subject,
            html: generateOrderStatusEmailHTML(data, statusLabel, locale),
        })
        if (response.error) {
            console.error("[EMAIL] Resend error (order status):", response.error)
            return false
        }
        console.log(`[EMAIL] Order-status (${data.status}) sent to ${data.customerEmail}`)
        return true
    } catch (error) {
        console.error("[EMAIL] Error sending order status:", error)
        return false
    }
}

function generateOrderStatusEmailHTML(
    data: { orderNumber: string; organizationName: string; orderUrl: string },
    statusLabel: string,
    locale: SupportedLocale,
): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t("email.order_status.heading", locale)}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb;">
            <h1 style="color: #1f2937; margin: 0; font-size: 26px;">${data.organizationName}</h1>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 28px;">
            <h2 style="color: #0f172a; margin: 0 0 8px 0; font-size: 20px;">${t("email.order_status.heading", locale)}</h2>
            <p style="color: #475569; margin: 0;">${t("email.order_status.body", locale, { orderNumber: data.orderNumber, statusLabel })}</p>
        </div>
        <div style="text-align: center; margin-bottom: 28px;">
            <a href="${data.orderUrl}" style="display: inline-block; background: #0f172a; color: white; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 600;">
                ${t("email.order_status.view_order_cta", locale)}
            </a>
        </div>
        <p style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 36px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            ${t("email.order_status.footer", locale, { organizationName: data.organizationName })}
        </p>
    </body>
    </html>
    `
}

interface ReviewRequestEmailData {
    customerName: string
    customerEmail: string
    organizationName: string
    /** Link tokenizado a la página pública de reseña (/resena/[orderId]?t=...) */
    reviewUrl: string
    locale?: SupportedLocale
}

/**
 * Email de solicitud de reseña post-compra (cron review-requests).
 * Mismo contrato que los demás: sin API key o sin email → no-op true;
 * solo retorna false en errores reales de envío.
 */
export async function sendReviewRequestEmail(data: ReviewRequestEmailData): Promise<boolean> {
    try {
        if (!process.env.RESEND_API_KEY) {
            console.log(`[EMAIL] Resend API key not configured, skipping review request to ${data.customerEmail}`)
            return true
        }

        if (!data.customerEmail || data.customerEmail.trim() === '') {
            console.log(`[EMAIL] Customer email is empty, skipping review request`)
            return true
        }

        const locale: SupportedLocale = data.locale ?? "es-CO"
        const subject = t("email.review_request.subject", locale, {
            organizationName: data.organizationName,
        })

        console.log(`[EMAIL] Sending review request to ${data.customerEmail} (locale=${locale})`)

        const response = await resend.emails.send({
            from: `${data.organizationName} <noreply@landingchat.co>`,
            to: data.customerEmail,
            subject,
            html: generateReviewRequestEmailHTML(data, locale),
        })

        if (response.error) {
            console.error('[EMAIL] Resend error (review request):', response.error)
            return false
        }

        return true
    } catch (error) {
        console.error('[EMAIL] Error sending review request:', error)
        return false
    }
}

function generateReviewRequestEmailHTML(data: ReviewRequestEmailData, locale: SupportedLocale): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t("email.review_request.subject", locale, { organizationName: data.organizationName })}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">

        <!-- Header -->
        <div style="text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb;">
            <h1 style="color: #1f2937; margin: 0; font-size: 28px;">${data.organizationName}</h1>
        </div>

        <!-- Hero -->
        <div style="background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 24px; margin-bottom: 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">⭐</div>
            <h2 style="color: #92400e; margin: 0 0 8px 0;">${t("email.review_request.heading", locale, { customerName: data.customerName })}</h2>
            <p style="color: #92400e; margin: 0;">${t("email.review_request.body", locale, { organizationName: data.organizationName })}</p>
        </div>

        <!-- CTA -->
        <div style="text-align: center; margin-bottom: 30px;">
            <a href="${data.reviewUrl}" style="display: inline-block; background: #059669; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                ${t("email.review_request.cta", locale)}
            </a>
        </div>

        <!-- Footer -->
        <p style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            ${t("email.review_request.footer", locale, { organizationName: data.organizationName })}
        </p>
    </body>
    </html>
    `
}

/**
 * Genera el HTML del email order-paid.
 *
 * @param locale  Locale del tenant (BCP 47). Determina los strings i18n.
 * @param currency Currency del tenant (ISO 4217). Determina el formato del monto.
 */
function generateOrderPaidEmailHTML(
    data: OrderPaidEmailData,
    locale: SupportedLocale,
    currency: SupportedCurrency,
): string {
    const formatPrice = (amount: number) =>
        formatCurrency(amount, { locale, currency })

    const paymentMethodLabel = data.paymentMethod === 'manual'
        ? t("email.order_confirmation.payment_bank_transfer", locale)
        : data.paymentMethod

    // Fecha localizada (es-CO → "21 de mayo de 2026", en-US → "May 21, 2026")
    const confirmedDate = new Date(data.confirmedAt ?? new Date().toISOString())
    const dateLabel = new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(confirmedDate)

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t("email.order_paid.title", locale)}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">

        <!-- Header -->
        <div style="text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb;">
            <h1 style="color: #1f2937; margin: 0; font-size: 28px;">${data.organizationName}</h1>
            <p style="color: #6b7280; margin: 8px 0 0 0;">${t("email.order_paid.title", locale)}</p>
        </div>

        <!-- Hero green -->
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 24px; margin-bottom: 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
            <h2 style="color: #166534; margin: 0 0 8px 0;">${t("email.order_paid.heading", locale)}</h2>
            <p style="color: #166534; margin: 0;">${t("email.order_paid.body", locale)}</p>
        </div>

        <!-- Payment details -->
        <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 30px;">
            <h3 style="margin: 0 0 16px 0; color: #1f2937;">${t("email.order_paid.order_details_heading", locale)}</h3>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span style="color: #6b7280;">${t("email.order_paid.order_number_label", locale)}</span>
                <span style="font-weight: 600; font-family: monospace;">${data.orderNumber}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span style="color: #6b7280;">${t("email.order_paid.amount_label", locale)}</span>
                <span style="font-weight: 700; color: #059669;">${formatPrice(data.total)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span style="color: #6b7280;">${t("email.order_paid.payment_method_label", locale)}</span>
                <span style="font-weight: 600;">${paymentMethodLabel}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span style="color: #6b7280;">${t("email.order_paid.date_label", locale)}</span>
                <span style="font-weight: 600;">${dateLabel}</span>
            </div>
        </div>

        <!-- Next steps -->
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <h3 style="margin: 0 0 12px 0; color: #1e40af;">${t("email.order_paid.next_steps_heading", locale)}</h3>
            <p style="margin: 0; color: #1e40af;">${t("email.order_paid.next_steps_body", locale)}</p>
        </div>

        <!-- CTA -->
        <div style="text-align: center; margin-bottom: 30px;">
            <a href="${data.orderUrl}" style="display: inline-block; background: #059669; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                ${t("email.order_paid.view_order_cta", locale)}
            </a>
        </div>

        <!-- Footer -->
        <p style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            ${t("email.order_paid.thanks_footer", locale, { organizationName: data.organizationName })}
        </p>
    </body>
    </html>
    `
}