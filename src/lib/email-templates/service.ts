/**
 * Enhanced Email Service with Template Support
 * Integrates custom email templates with the existing email system
 */

import { Resend } from 'resend'
import { EmailTemplateRepository, getEmailSettingsWithDefaults } from './repository'
import { EmailTemplateEngine } from './engine'
import type { 
  EmailTemplateVariables, 
  EmailTemplateType,
  EmailResult,
  OrderItem
} from '@/types/email-template'

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Enhanced email service that supports custom templates
 */
export class EmailTemplateService {
  
  /**
   * Send order confirmation email to customer using custom template if available
   */
  static async sendOrderConfirmation(data: {
    organizationId: string
    organizationName: string
    orderNumber: string
    customerName: string
    customerEmail: string
    total: number
    items: Array<{
      name: string
      quantity: number
      price: number
    }>
    paymentMethod: string
    storeUrl: string
    customDomain?: string
  }): Promise<EmailResult> {
    try {
      // Skip email sending if no API key is configured
      if (!process.env.RESEND_API_KEY) {
        console.log(`[EMAIL_TEMPLATES] Resend API key not configured, skipping email to ${data.customerEmail}`)
        return { success: true }
      }

      // Skip if customer email is empty
      if (!data.customerEmail || data.customerEmail.trim() === '') {
        console.log(`[EMAIL_TEMPLATES] Customer email is empty, skipping email notification`)
        return { success: true }
      }

      console.log(`[EMAIL_TEMPLATES] Sending order confirmation to ${data.customerEmail} for order ${data.orderNumber}`)

      // Try to get custom template
      const customTemplate = await EmailTemplateRepository.getTemplateWithFallback(
        data.organizationId, 
        'customer_confirmation'
      )

      let subject: string
      let htmlContent: string

      if (customTemplate) {
        // Use custom template
        console.log(`[EMAIL_TEMPLATES] Using custom template for organization ${data.organizationId}`)
        
        const emailSettings = await getEmailSettingsWithDefaults(data.organizationId, data.organizationName)
        const variables = await this.buildCustomerVariables(data, emailSettings)
        
        subject = EmailTemplateEngine.renderTemplate(customTemplate.subjectTemplate, variables)
        htmlContent = EmailTemplateEngine.renderTemplate(customTemplate.htmlTemplate, variables)
        htmlContent = EmailTemplateEngine.sanitizeTemplate(htmlContent)
      } else {
        // Fallback to existing hardcoded template
        console.log(`[EMAIL_TEMPLATES] No custom template found, using default template`)
        
        const { generateOrderEmailHTML } = await import('@/lib/notifications/email')
        subject = `Confirmación de Pedido ${data.orderNumber} - ${data.organizationName}`
        htmlContent = generateOrderEmailHTML({
          orderNumber: data.orderNumber,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          total: data.total,
          items: data.items,
          paymentMethod: data.paymentMethod,
          organizationName: data.organizationName,
          storeUrl: data.storeUrl
        })
      }

      const response = await resend.emails.send({
        from: `${data.organizationName} <noreply@landingchat.co>`,
        to: data.customerEmail,
        subject,
        html: htmlContent,
      })

      if (response.error) {
        console.error('[EMAIL_TEMPLATES] Resend error:', response.error)
        return { success: false, error: response.error.message }
      }

      console.log(`[EMAIL_TEMPLATES] Order confirmation sent successfully to ${data.customerEmail}, ID: ${response.data?.id}`)
      return { success: true, messageId: response.data?.id }
      
    } catch (error) {
      console.error('[EMAIL_TEMPLATES] Error sending order confirmation:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Send order notification email to store owner using custom template if available
   */
  static async sendOwnerNotification(data: {
    organizationId: string
    organizationName: string
    orderNumber: string
    customerName: string
    customerEmail: string
    customerPhone?: string
    total: number
    items: Array<{ name: string; quantity: number; price: number }>
    ownerEmail: string
    paymentMethod: string
  }): Promise<EmailResult> {
    try {
      // Skip email sending if no API key is configured
      if (!process.env.RESEND_API_KEY) {
        console.log(`[EMAIL_TEMPLATES] Resend API key not configured, skipping owner notification`)
        return { success: true }
      }

      // Skip if owner email is empty
      if (!data.ownerEmail || data.ownerEmail.trim() === '') {
        console.log(`[EMAIL_TEMPLATES] Owner email is empty, skipping owner notification`)
        return { success: true }
      }

      console.log(`[EMAIL_TEMPLATES] Sending new order notification to owner ${data.ownerEmail} for order ${data.orderNumber}`)

      // Try to get custom template
      const customTemplate = await EmailTemplateRepository.getTemplateWithFallback(
        data.organizationId, 
        'owner_notification'
      )

      let subject: string
      let htmlContent: string

      if (customTemplate) {
        // Use custom template
        console.log(`[EMAIL_TEMPLATES] Using custom owner template for organization ${data.organizationId}`)
        
        const emailSettings = await getEmailSettingsWithDefaults(data.organizationId, data.organizationName)
        const variables = await this.buildOwnerVariables(data, emailSettings)
        
        subject = EmailTemplateEngine.renderTemplate(customTemplate.subjectTemplate, variables)
        htmlContent = EmailTemplateEngine.renderTemplate(customTemplate.htmlTemplate, variables)
        htmlContent = EmailTemplateEngine.sanitizeTemplate(htmlContent)
      } else {
        // Fallback to existing hardcoded template
        console.log(`[EMAIL_TEMPLATES] No custom owner template found, using default template`)
        
        const { generateOwnerNotificationHTML } = await import('@/lib/notifications/email')
        subject = `🛒 Nuevo Pedido ${data.orderNumber} - ${data.organizationName}`
        htmlContent = generateOwnerNotificationHTML({
          orderNumber: data.orderNumber,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          total: data.total,
          items: data.items,
          organizationName: data.organizationName
        })
      }

      const response = await resend.emails.send({
        from: `LandingChat <noreply@landingchat.co>`,
        to: data.ownerEmail,
        subject,
        html: htmlContent,
      })

      if (response.error) {
        console.error('[EMAIL_TEMPLATES] Resend error for owner notification:', response.error)
        return { success: false, error: response.error.message }
      }

      console.log(`[EMAIL_TEMPLATES] Owner notification sent successfully to ${data.ownerEmail}, ID: ${response.data?.id}`)
      return { success: true, messageId: response.data?.id }
      
    } catch (error) {
      console.error('[EMAIL_TEMPLATES] Error sending owner notification:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Build variables for customer confirmation email
   */
  private static async buildCustomerVariables(
    data: {
      organizationName: string
      orderNumber: string
      customerName: string
      customerEmail: string
      total: number
      items: Array<{ name: string; quantity: number; price: number }>
      paymentMethod: string
      storeUrl: string
      customDomain?: string
    },
    emailSettings: Partial<any>
  ): Promise<EmailTemplateVariables> {
    // Format order items
    const orderItems: OrderItem[] = data.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      total: item.price * item.quantity
    }))

    // Determine URLs based on custom domain
    const baseUrl = data.customDomain || data.storeUrl
    const profileUrl = `${baseUrl}/profile?email=${encodeURIComponent(data.customerEmail)}`

    return {
      // Order variables
      orderNumber: data.orderNumber,
      orderDate: new Date().toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      orderTotal: this.formatCurrency(data.total),
      orderItems,
      orderStatus: 'pending',
      
      // Customer variables
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: '', // Not available in current data structure
      
      // Store variables
      storeName: data.organizationName,
      storeUrl: baseUrl,
      storeLogoUrl: emailSettings.logoUrl,
      
      // Business variables
      businessName: emailSettings.businessName || data.organizationName,
      contactEmail: emailSettings.contactEmail || '',
      contactPhone: emailSettings.contactPhone || '',
      businessAddress: emailSettings.businessAddress || '',
      paymentInstructions: emailSettings.paymentInstructions || 'Por favor contacta al vendedor para obtener los detalles de pago.',
      supportMessage: emailSettings.supportMessage || '¿Tienes preguntas? Contáctanos directamente desde la tienda.',
      
      // Payment variables
      paymentMethod: data.paymentMethod,
      
      // Links
      profileUrl,
      orderManagementUrl: `https://landingchat.co/dashboard/orders/${data.orderNumber}`
    }
  }

  /**
   * Build variables for owner notification email
   */
  private static async buildOwnerVariables(
    data: {
      organizationName: string
      orderNumber: string
      customerName: string
      customerEmail: string
      customerPhone?: string
      total: number
      items: Array<{ name: string; quantity: number; price: number }>
      paymentMethod: string
    },
    emailSettings: Partial<any>
  ): Promise<EmailTemplateVariables> {
    // Format order items
    const orderItems: OrderItem[] = data.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      total: item.price * item.quantity
    }))

    return {
      // Order variables
      orderNumber: data.orderNumber,
      orderDate: new Date().toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      orderTotal: this.formatCurrency(data.total),
      orderItems,
      orderStatus: 'pending',
      
      // Customer variables
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone || '',
      
      // Store variables
      storeName: data.organizationName,
      storeUrl: `https://${data.organizationName.toLowerCase()}.landingchat.co`,
      storeLogoUrl: emailSettings.logoUrl,
      
      // Business variables
      businessName: emailSettings.businessName || data.organizationName,
      contactEmail: emailSettings.contactEmail || '',
      contactPhone: emailSettings.contactPhone || '',
      businessAddress: emailSettings.businessAddress || '',
      paymentInstructions: emailSettings.paymentInstructions || '',
      supportMessage: emailSettings.supportMessage || '',
      
      // Payment variables
      paymentMethod: data.paymentMethod,
      
      // Links
      profileUrl: '',
      orderManagementUrl: `https://landingchat.co/dashboard/orders/${data.orderNumber}`
    }
  }

  /**
   * Format currency for Colombian pesos
   */
  private static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }
}

/**
 * Backward compatibility functions that wrap the new service
 * These maintain the existing API while adding template support
 */

/**
 * Enhanced version of sendOrderConfirmationEmail with template support
 */
export async function sendOrderConfirmationEmailWithTemplates(data: {
  organizationId: string
  orderNumber: string
  customerName: string
  customerEmail: string
  total: number
  items: Array<{
    name: string
    quantity: number
    price: number
  }>
  paymentMethod: string
  organizationName: string
  storeUrl: string
  customDomain?: string
}): Promise<boolean> {
  const result = await EmailTemplateService.sendOrderConfirmation(data)
  return result.success
}

/**
 * Enhanced version of sendOrderNotificationToOwner with template support
 */
export async function sendOrderNotificationToOwnerWithTemplates(data: {
  organizationId: string
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  total: number
  items: Array<{ name: string; quantity: number; price: number }>
  ownerEmail: string
  organizationName: string
  paymentMethod: string
}): Promise<boolean> {
  const result = await EmailTemplateService.sendOwnerNotification(data)
  return result.success
}

// Re-export the original functions for backward compatibility
export { 
  sendOrderConfirmationEmail, 
  sendOrderNotificationToOwner 
} from '@/lib/notifications/email'