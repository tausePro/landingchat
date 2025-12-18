/**
 * Client-safe Default Email Templates
 * Templates that can be safely imported in client components
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
        <h1 style="color: #1f2937; margin: 0; font-size: 28px;">{{storeName}}</h1>
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
            <span style="color: #6b7280;">Método de Pago:</span>
            <span style="font-weight: 600;">{{paymentMethod}}</span>
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
                {{#each orderItems}}
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">{{name}}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">{{quantity}}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">{{price}}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">{{total}}</td>
                </tr>
                {{/each}}
            </tbody>
            <tfoot>
                <tr style="background: #f3f4f6;">
                    <td colspan="3" style="padding: 16px; font-weight: 600; text-align: right;">Total a Pagar:</td>
                    <td style="padding: 16px; font-weight: 700; text-align: right; font-size: 18px; color: #059669;">{{orderTotal}}</td>
                </tr>
            </tfoot>
        </table>
    </div>

    <!-- Payment Instructions (conditional) -->
    {{#if paymentInstructions}}
    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 16px 0; color: #92400e;">Instrucciones de Pago</h3>
        <div style="color: #92400e;">
            <p>{{paymentInstructions}}</p>
            <div style="background: #fbbf24; padding: 12px; border-radius: 6px; margin-top: 16px;">
                <strong>Importante:</strong> Guarda el número de pedido <strong>{{orderNumber}}</strong> para tu referencia.
            </div>
        </div>
    </div>
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

    <!-- Footer -->
    <div style="text-align: center; padding-top: 30px; border-top: 1px solid #e5e7eb; color: #6b7280;">
        <p>{{supportMessage}}</p>
        <div style="margin: 16px 0 0 0; display: flex; justify-content: center; gap: 16px;">
            {{#if profileUrl}}
            <a href="{{profileUrl}}" style="color: #3b82f6; text-decoration: none;">Ver Mi Perfil</a>
            <span style="color: #d1d5db;">|</span>
            {{/if}}
            <a href="{{storeUrl}}" style="color: #3b82f6; text-decoration: none;">Visitar Tienda</a>
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 30px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 10px;">🛒</div>
        <h2 style="color: #166534; margin: 0 0 8px 0;">Nuevo Pedido Recibido</h2>
        <p style="color: #166534; margin: 0;">{{storeName}}</p>
    </div>

    <!-- Order Summary -->
    <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 16px 0; color: #1f2937;">Resumen del Pedido</h3>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="color: #6b7280;">Número de Pedido:</span>
            <span style="font-weight: 600; font-family: monospace;">{{orderNumber}}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="color: #6b7280;">Fecha:</span>
            <span style="font-weight: 600;">{{orderDate}}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="color: #6b7280;">Total:</span>
            <span style="font-weight: 700; font-size: 18px; color: #059669;">{{orderTotal}}</span>
        </div>
    </div>

    <!-- Customer Information -->
    <div style="background: #eff6ff; border-radius: 8px; padding: 24px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 16px 0; color: #1f2937;">Información del Cliente</h3>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="color: #6b7280;">Nombre:</span>
            <span style="font-weight: 600;">{{customerName}}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="color: #6b7280;">Email:</span>
            <span style="font-weight: 600;">{{customerEmail}}</span>
        </div>
        
        {{#if customerPhone}}
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="color: #6b7280;">Teléfono:</span>
            <span style="font-weight: 600;">{{customerPhone}}</span>
        </div>
        {{/if}}
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="color: #6b7280;">Método de Pago:</span>
            <span style="font-weight: 600;">{{paymentMethod}}</span>
        </div>
    </div>

    <!-- Products -->
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
                {{#each orderItems}}
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">{{name}}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">{{quantity}}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">{{price}}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">{{total}}</td>
                </tr>
                {{/each}}
            </tbody>
        </table>
    </div>

    <!-- Action Buttons -->
    <div style="text-align: center; margin-bottom: 30px;">
        <a href="{{orderManagementUrl}}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 0 8px;">
            Ver Pedido Completo
        </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding-top: 30px; border-top: 1px solid #e5e7eb; color: #6b7280;">
        <p>Este es un pedido automático generado desde {{storeName}}.</p>
        <p style="font-size: 14px; margin-top: 16px;">
            Revisa todos los detalles en tu dashboard de administración.
        </p>
    </div>

</body>
</html>
`

/**
 * Get default template for a specific type (client-safe version)
 */
export function getDefaultTemplate(templateType: EmailTemplateType): { subjectTemplate: string; htmlTemplate: string } {
  switch (templateType) {
    case 'customer_confirmation':
      return {
        subjectTemplate: DEFAULT_CUSTOMER_CONFIRMATION_SUBJECT,
        htmlTemplate: DEFAULT_CUSTOMER_CONFIRMATION_HTML
      }
    case 'owner_notification':
      return {
        subjectTemplate: DEFAULT_OWNER_NOTIFICATION_SUBJECT,
        htmlTemplate: DEFAULT_OWNER_NOTIFICATION_HTML
      }
    default:
      throw new Error(`Unknown template type: ${templateType}`)
  }
}