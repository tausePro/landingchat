/**
 * Email notification service for order confirmations
 * Uses Resend API for sending transactional emails
 */

interface OrderEmailData {
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
}

/**
 * Send order confirmation email to customer
 */
export async function sendOrderConfirmationEmail(data: OrderEmailData): Promise<boolean> {
    try {
        // For now, we'll use a simple fetch to a webhook or email service
        // In production, you would integrate with Resend, SendGrid, or similar
        
        const emailContent = generateOrderEmailHTML(data)
        
        // TODO: Replace with actual email service integration
        console.log(`[EMAIL] Order confirmation for ${data.customerEmail}:`, {
            to: data.customerEmail,
            subject: `Confirmación de Pedido ${data.orderNumber} - ${data.organizationName}`,
            html: emailContent
        })

        // For MVP, we'll just log the email content
        // In production, integrate with your preferred email service:
        /*
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: `${data.organizationName} <noreply@landingchat.co>`,
                to: data.customerEmail,
                subject: `Confirmación de Pedido ${data.orderNumber}`,
                html: emailContent,
            }),
        })
        
        return response.ok
        */
        
        return true // For MVP, always return success
    } catch (error) {
        console.error('[EMAIL] Error sending order confirmation:', error)
        return false
    }
}

/**
 * Generate HTML email template for order confirmation
 */
function generateOrderEmailHTML(data: OrderEmailData): string {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount)
    }

    const itemsHTML = data.items.map(item => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                ${item.name}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
                ${item.quantity}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
                ${formatCurrency(item.price)}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">
                ${formatCurrency(item.price * item.quantity)}
            </td>
        </tr>
    `).join('')

    return `
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
            <h1 style="color: #1f2937; margin: 0; font-size: 28px;">${data.organizationName}</h1>
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
                <span style="font-weight: 600; font-family: monospace;">${data.orderNumber}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span style="color: #6b7280;">Cliente:</span>
                <span style="font-weight: 600;">${data.customerName}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span style="color: #6b7280;">Método de Pago:</span>
                <span style="font-weight: 600;">${data.paymentMethod === 'manual' ? 'Transferencia Bancaria' : data.paymentMethod}</span>
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
                    ${itemsHTML}
                </tbody>
                <tfoot>
                    <tr style="background: #f3f4f6;">
                        <td colspan="3" style="padding: 16px; font-weight: 600; text-align: right;">Total a Pagar:</td>
                        <td style="padding: 16px; font-weight: 700; text-align: right; font-size: 18px; color: #059669;">
                            ${formatCurrency(data.total)}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>

        ${data.paymentMethod === 'manual' ? `
        <!-- Payment Instructions -->
        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <h3 style="margin: 0 0 16px 0; color: #92400e;">Información para Transferencia</h3>
            <div style="color: #92400e;">
                <p><strong>Banco:</strong> Bancolombia</p>
                <p><strong>Tipo de Cuenta:</strong> Ahorros</p>
                <p><strong>Número de Cuenta:</strong> 60100000000</p>
                <p><strong>Nequi:</strong> 3001234567</p>
                <p><strong>Titular:</strong> LANDINGCHAT SAS</p>
                <div style="background: #fbbf24; padding: 12px; border-radius: 6px; margin-top: 16px;">
                    <strong>Importante:</strong> Envía el comprobante de pago por WhatsApp al +57 301 234 5678 
                    con el número de pedido <strong>${data.orderNumber}</strong>
                </div>
            </div>
        </div>
        ` : ''}

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
            <p>¿Tienes preguntas? Contáctanos por WhatsApp: +57 301 234 5678</p>
            <div style="margin: 16px 0 0 0; display: flex; justify-content: center; gap: 16px;">
                <a href="${data.storeUrl}/profile?email=${encodeURIComponent(data.customerEmail)}" style="color: #3b82f6; text-decoration: none;">Ver Mi Perfil</a>
                <span style="color: #d1d5db;">|</span>
                <a href="${data.storeUrl}" style="color: #3b82f6; text-decoration: none;">Visitar Tienda</a>
            </div>
        </div>

    </body>
    </html>
    `
}

/**
 * Send order notification email to store owner
 */
export async function sendOrderNotificationToOwner(data: {
    orderNumber: string
    customerName: string
    customerEmail: string
    total: number
    items: Array<{ name: string; quantity: number; price: number }>
    ownerEmail: string
    organizationName: string
}): Promise<boolean> {
    try {
        const emailContent = generateOwnerNotificationHTML(data)
        
        console.log(`[EMAIL] New order notification for ${data.ownerEmail}:`, {
            to: data.ownerEmail,
            subject: `🛒 Nuevo Pedido ${data.orderNumber} - ${data.organizationName}`,
            html: emailContent
        })

        // TODO: Integrate with actual email service
        return true
    } catch (error) {
        console.error('[EMAIL] Error sending owner notification:', error)
        return false
    }
}

function generateOwnerNotificationHTML(data: {
    orderNumber: string
    customerName: string
    customerEmail: string
    total: number
    items: Array<{ name: string; quantity: number; price: number }>
    organizationName: string
}): string {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount)
    }

    const itemsHTML = data.items.map(item => `
        <li>${item.quantity}x ${item.name} - ${formatCurrency(item.price * item.quantity)}</li>
    `).join('')

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Nuevo Pedido</title>
    </head>
    <body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h2 style="color: #166534; margin: 0;">🛒 Nuevo Pedido Recibido</h2>
        </div>
        
        <h3>Detalles del Pedido</h3>
        <p><strong>Número:</strong> ${data.orderNumber}</p>
        <p><strong>Cliente:</strong> ${data.customerName}</p>
        <p><strong>Email:</strong> ${data.customerEmail}</p>
        <p><strong>Total:</strong> ${formatCurrency(data.total)}</p>
        
        <h3>Productos:</h3>
        <ul>${itemsHTML}</ul>
        
        <p style="margin-top: 30px; padding: 15px; background: #f3f4f6; border-radius: 6px;">
            Revisa los detalles completos en tu dashboard de ${data.organizationName}.
        </p>
    </body>
    </html>
    `
}