/**
 * Default Email Templates
 * Professional templates converted from hardcoded versions with variable support
 */

import type { EmailTemplateType } from '@/types/email-template'

/**
 * Default customer confirmation email template
 */
export const DEFAULT_CUSTOMER_CONFIRMATION_SUBJECT = 'Confirmación de Pedido {{orderNumber}} - {{storeName}}'

export const DEFAULT_CUSTOMER_CONFIRMATION_HTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirmación de Pedido</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb;">
        {{#if storeLogoUrl}}
        <img src="{{storeLogoUrl}}" alt="{{storeName}}" style="max-height: 60px; margin-bottom: 16px;">
        {{/if}}
        <h1 style="color: {{primaryColor}}; margin: 0; font-size: 28px;">{{businessName}}</h1>
        <p style="color: #6b7280; margin: 8px 0 0 0;">Confirmación de Pedido</p>
    </div>

    <!-- Success Message -->
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 30px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
        <h2 style="color: #166534; margin: 0 0 8px 0;">¡Gracias por tu compra!</h2>
        <p style="color: #166534; margin: 0;">Tu pedido ha sido recibido y está siendo procesado.</p>
    </div>

    <!-- Order Details -->
    <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 16px 0; color: #1f2937;">Detalles del Pedido</h3>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="color: #6b7280;">Número de Pedido:</span>
            <span style="font-weight: 600; font-family: monospace;">{{orderNumber}}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="color: #6b7280;">Cliente:</span>
            <span style="font-weight: 600;">{{customerName}}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="color: #6b7280;">Fecha:</span>
            <span style="font-weight: 600;">{{orderDate}}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="color: #6b7280;">Método de Pago:</span>
            <span style="font-weight: 600;">{{#if paymentMethod}}{{#eq paymentMethod 'manual'}}Transferencia Bancaria{{else}}{{paymentMethod}}{{/eq}}{{else}}No especificado{{/if}}</span>
        </div>
    </div>

    <!-- Items Table -->
    <div style="margin-bottom: 30px;">
        <h3 style="margin: 0 0 16px 0; color: #1f2937;">Productos Pedidos</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <thead>
                <tr style="background: #f3f4f6;">
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Producto</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Cant.</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Precio</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Total</th>
                </tr>
            </thead>
            <tbody>
                {{orderItems}}
            </tbody>
            <tfoot>
                <tr style="background: #f3f4f6;">
                    <td colspan="3" style="padding: 16px; font-weight: 600; text-align: right;">Total a Pagar:</td>
                    <td style="padding: 16px; font-weight: 700; text-align: right; font-size: 18px; color: #059669;">
                        {{orderTotal}}
                    </td>
                </tr>
            </tfoot>
        </table>
    </div>

    {{#if paymentInstructions}}
    {{#eq paymentMethod 'manual'}}
    <!-- Payment Instructions -->
    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 16px 0; color: #92400e;">Instrucciones de Pago</h3>
        <div style="color: #92400e;">
            <p>{{paymentInstructions}}</p>
            <div style="background: #fbbf24; padding: 12px; border-radius: 6px; margin-top: 16px;">
                <strong>Importante:</strong> Guarda el número de pedido <strong>{{orderNumber}}</strong> para tu referencia.
            </div>
        </div>
    </div>
    {{/eq}}
    {{/if}}

    <!-- Next Steps -->
    <div style="background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 16px 0; color: #1e40af;">Próximos Pasos</h3>
        <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
            <li>Te notificaremos cuando tu pedido sea enviado</li>
            <li>Recibirás el número de guía para rastrear tu envío</li>
            <li>Puedes contactarnos si tienes alguna pregunta</li>
        </ul>
    </div>

    <!-- Contact Information -->
    {{#if contactEmail}}
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 16px 0; color: #1f2937;">Información de Contacto</h3>
        <div style="color: #4b5563;">
            {{#if contactEmail}}<p><strong>Email:</strong> {{contactEmail}}</p>{{/if}}
            {{#if contactPhone}}<p><strong>Teléfono:</strong> {{contactPhone}}</p>{{/if}}
            {{#if businessAddress}}<p><strong>Dirección:</strong> {{businessAddress}}</p>{{/if}}
        </div>
    </div>
    {{/if}}

    <!-- Footer -->
    <div style="text-align: center; padding-top: 30px; border-top: 1px solid #e5e7eb; color: #6b7280;">
        {{#if supportMessage}}
        <p>{{supportMessage}}</p>
        {{else}}
        <p>¿Tienes preguntas? Contáctanos directamente desde la tienda.</p>
        {{/if}}
        
        <div style="margin: 16px 0 0 0; display: flex; justify-content: center; gap: 16px;">
            {{#if profileUrl}}
            <a href="{{profileUrl}}" style="color: #3b82f6; text-decoration: none;">Ver Mi Perfil</a>
            <span style="color: #d1d5db;">|</span>
            {{/if}}
            <a href="{{storeUrl}}" style="color: #3b82f6; text-decoration: none;">Visitar Tienda</a>
        </div>
        
        <div style="margin-top: 20px; font-size: 12px; color: #9ca3af;">
            <p>Este email fue enviado por {{businessName}}</p>
        </div>
    </div>

</body>
</html>
`

/**
 * Default owner notification email template
 */
export const DEFAULT_OWNER_NOTIFICATION_SUBJECT = '🛒 Nuevo Pedido {{orderNumber}} - {{storeName}}'

export const DEFAULT_OWNER_NOTIFICATION_HTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nuevo Pedido</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
        <h2 style="color: #166534; margin: 0; font-size: 24px;">🛒 Nuevo Pedido Recibido</h2>
        <p style="color: #166534; margin: 8px 0 0 0;">{{storeName}}</p>
    </div>
    
    <!-- Order Summary -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 16px 0; color: #1f2937;">Resumen del Pedido</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
                <strong>Número:</strong> {{orderNumber}}
            </div>
            <div>
                <strong>Fecha:</strong> {{orderDate}}
            </div>
            <div>
                <strong>Cliente:</strong> {{customerName}}
            </div>
            <div>
                <strong>Total:</strong> {{orderTotal}}
            </div>
        </div>
    </div>
    
    <!-- Customer Information -->
    <div style="background: #fefefe; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 16px 0; color: #1f2937;">Información del Cliente</h3>
        
        <p><strong>Nombre:</strong> {{customerName}}</p>
        <p><strong>Email:</strong> <a href="mailto:{{customerEmail}}" style="color: #3b82f6;">{{customerEmail}}</a></p>
        {{#if customerPhone}}
        <p><strong>Teléfono:</strong> <a href="tel:{{customerPhone}}" style="color: #3b82f6;">{{customerPhone}}</a></p>
        {{/if}}
        <p><strong>Método de Pago:</strong> {{#eq paymentMethod 'manual'}}Transferencia Bancaria{{else}}{{paymentMethod}}{{/eq}}</p>
    </div>
    
    <!-- Products -->
    <div style="background: #fefefe; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 16px 0; color: #1f2937;">Productos Pedidos</h3>
        
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="border-bottom: 2px solid #e5e7eb;">
                    <th style="padding: 8px; text-align: left; font-weight: 600;">Producto</th>
                    <th style="padding: 8px; text-align: center; font-weight: 600;">Cant.</th>
                    <th style="padding: 8px; text-align: right; font-weight: 600;">Subtotal</th>
                </tr>
            </thead>
            <tbody>
                {{orderItems}}
            </tbody>
            <tfoot>
                <tr style="border-top: 2px solid #e5e7eb;">
                    <td colspan="2" style="padding: 12px 8px; font-weight: 600; text-align: right;">Total:</td>
                    <td style="padding: 12px 8px; font-weight: 700; text-align: right; color: #059669; font-size: 18px;">{{orderTotal}}</td>
                </tr>
            </tfoot>
        </table>
    </div>
    
    <!-- Action Buttons -->
    <div style="text-align: center; margin: 30px 0;">
        {{#if orderManagementUrl}}
        <a href="{{orderManagementUrl}}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 0 8px;">Ver Pedido Completo</a>
        {{/if}}
        
        <a href="mailto:{{customerEmail}}" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 0 8px;">Contactar Cliente</a>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
        <p>Este pedido fue realizado en <strong>{{storeName}}</strong></p>
        <p>Revisa todos los detalles en tu panel de administración de LandingChat.</p>
    </div>

</body>
</html>
`

/**
 * Get default template for a specific type
 */
export function getDefaultTemplate(templateType: EmailTemplateType): { subject: string; html: string } {
  switch (templateType) {
    case 'customer_confirmation':
      return {
        subject: DEFAULT_CUSTOMER_CONFIRMATION_SUBJECT,
        html: DEFAULT_CUSTOMER_CONFIRMATION_HTML
      }
    case 'owner_notification':
      return {
        subject: DEFAULT_OWNER_NOTIFICATION_SUBJECT,
        html: DEFAULT_OWNER_NOTIFICATION_HTML
      }
    default:
      throw new Error(`Unknown template type: ${templateType}`)
  }
}

/**
 * Create default templates for an organization
 */
export async function createDefaultTemplatesForOrganization(organizationId: string): Promise<void> {
  const { EmailTemplateRepository } = await import('./repository')
  
  try {
    // Create customer confirmation template
    await EmailTemplateRepository.upsertTemplate(organizationId, 'customer_confirmation', {
      templateType: 'customer_confirmation',
      subjectTemplate: DEFAULT_CUSTOMER_CONFIRMATION_SUBJECT,
      htmlTemplate: DEFAULT_CUSTOMER_CONFIRMATION_HTML,
      variables: {}
    })
    
    // Create owner notification template
    await EmailTemplateRepository.upsertTemplate(organizationId, 'owner_notification', {
      templateType: 'owner_notification',
      subjectTemplate: DEFAULT_OWNER_NOTIFICATION_SUBJECT,
      htmlTemplate: DEFAULT_OWNER_NOTIFICATION_HTML,
      variables: {}
    })
    
    console.log(`[EMAIL_TEMPLATES] Created default templates for organization ${organizationId}`)
  } catch (error) {
    console.error(`[EMAIL_TEMPLATES] Error creating default templates for organization ${organizationId}:`, error)
    throw error
  }
}

/**
 * Minimal templates for emergency fallback
 */
export const EMERGENCY_CUSTOMER_TEMPLATE = {
  subject: 'Confirmación de Pedido {{orderNumber}}',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>¡Gracias por tu pedido!</h2>
      <p><strong>Número de pedido:</strong> {{orderNumber}}</p>
      <p><strong>Cliente:</strong> {{customerName}}</p>
      <p><strong>Total:</strong> {{orderTotal}}</p>
      <p>Te contactaremos pronto con más detalles.</p>
    </div>
  `
}

export const EMERGENCY_OWNER_TEMPLATE = {
  subject: 'Nuevo Pedido {{orderNumber}}',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Nuevo pedido recibido</h2>
      <p><strong>Número:</strong> {{orderNumber}}</p>
      <p><strong>Cliente:</strong> {{customerName}} ({{customerEmail}})</p>
      <p><strong>Total:</strong> {{orderTotal}}</p>
      <p>Revisa los detalles en tu dashboard.</p>
    </div>
  `
}