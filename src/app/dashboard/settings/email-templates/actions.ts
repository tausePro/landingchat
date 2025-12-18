'use server'

import { createClient } from '@/lib/supabase/server'
import { EmailTemplateRepository } from '@/lib/email-templates/repository'
import type { 
  EmailTemplate, 
  OrganizationEmailSettings,
  CreateEmailTemplateInput,
  CreateOrganizationEmailSettingsInput,
  EmailTemplateType
} from '@/types/email-template'
import { 
  CreateEmailTemplateSchema,
  CreateOrganizationEmailSettingsSchema
} from '@/types/email-template'
import { revalidatePath } from 'next/cache'

/**
 * Obtiene la organización del usuario actual
 * Patrón copiado de payments/actions.ts
 */
async function getCurrentOrganization() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()

  return profile?.organization_id
}

/**
 * Get email templates and settings data for the dashboard
 */
export async function getEmailTemplatesData() {
  const supabase = await createClient()
  
  try {
    const organizationId = await getCurrentOrganization()
    if (!organizationId) {
      throw new Error('No autorizado')
    }

    // Get organization details with profile info
    const { data: organization, error: orgDetailsError } = await supabase
      .from('organizations')
      .select(`
        id, name, slug, custom_domain,
        profiles!inner(email)
      `)
      .eq('id', organizationId)
      .single()

    if (orgDetailsError || !organization) {
      throw new Error('No se pudieron obtener los detalles de la organización')
    }

    // Get email templates and settings
    const [customerTemplate, ownerTemplate, emailSettings] = await Promise.all([
      EmailTemplateRepository.getTemplate(organizationId, 'customer_confirmation'),
      EmailTemplateRepository.getTemplate(organizationId, 'owner_notification'),
      EmailTemplateRepository.getEmailSettings(organizationId)
    ])

    return {
      organization: {
        ...organization,
        ownerEmail: organization.profiles?.[0]?.email || null
      },
      customerTemplate,
      ownerTemplate,
      emailSettings
    }
  } catch (error) {
    console.error('[EMAIL_TEMPLATES] Error in getEmailTemplatesData:', error)
    throw error
  }
}

/**
 * Save or update an email template
 */
export async function saveEmailTemplate(
  templateType: EmailTemplateType,
  input: CreateEmailTemplateInput
): Promise<{ success: boolean; error?: string; template?: EmailTemplate }> {
  try {
    const organizationId = await getCurrentOrganization()
    if (!organizationId) {
      return { success: false, error: 'No autorizado' }
    }

    // Validate input
    const validatedInput = CreateEmailTemplateSchema.parse(input)

    // Save template
    const template = await EmailTemplateRepository.upsertTemplate(
      organizationId,
      templateType,
      validatedInput
    )

    // Revalidate the page
    revalidatePath('/dashboard/settings/email-templates')

    return { success: true, template }
  } catch (error) {
    console.error('[EMAIL_TEMPLATES] Error saving email template:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error al guardar plantilla' 
    }
  }
}

/**
 * Delete an email template (revert to default)
 */
export async function deleteEmailTemplate(
  templateType: EmailTemplateType
): Promise<{ success: boolean; error?: string }> {
  try {
    const organizationId = await getCurrentOrganization()
    if (!organizationId) {
      return { success: false, error: 'No autorizado' }
    }

    // Delete template
    await EmailTemplateRepository.deleteTemplate(organizationId, templateType)

    // Revalidate the page
    revalidatePath('/dashboard/settings/email-templates')

    return { success: true }
  } catch (error) {
    console.error('[EMAIL_TEMPLATES] Error deleting email template:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error al eliminar plantilla' 
    }
  }
}

/**
 * Save or update email settings
 */
export async function saveEmailSettings(
  input: CreateOrganizationEmailSettingsInput
): Promise<{ success: boolean; error?: string; settings?: OrganizationEmailSettings }> {
  try {
    const organizationId = await getCurrentOrganization()
    if (!organizationId) {
      return { success: false, error: 'No autorizado' }
    }

    // Validate input
    const validatedInput = CreateOrganizationEmailSettingsSchema.parse(input)

    // Save settings
    const settings = await EmailTemplateRepository.upsertEmailSettings(
      organizationId,
      validatedInput
    )

    // Revalidate the page
    revalidatePath('/dashboard/settings/email-templates')

    return { success: true, settings }
  } catch (error) {
    console.error('[EMAIL_TEMPLATES] Error saving email settings:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error al guardar configuración' 
    }
  }
}

/**
 * Preview an email template with sample data usando datos reales de la organización
 */
export async function previewEmailTemplate(
  templateType: EmailTemplateType,
  subjectTemplate: string,
  htmlTemplate: string
): Promise<{ success: boolean; error?: string; preview?: { subject: string; html: string } }> {
  try {
    const organizationId = await getCurrentOrganization()
    if (!organizationId) {
      return { success: false, error: 'No autorizado' }
    }

    // Get real organization data
    const supabase = await createClient()
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, slug, custom_domain')
      .eq('id', organizationId)
      .single()

    // Get email settings if they exist
    const emailSettings = await EmailTemplateRepository.getEmailSettings(organizationId)

    const { previewTemplate } = await import('@/lib/email-templates/engine')
    
    // Use real organization data for preview
    const customVariables = {
      storeName: org?.name || 'Mi Tienda',
      businessName: emailSettings?.businessName || org?.name || 'Mi Empresa',
      storeUrl: org?.custom_domain ? `https://${org.custom_domain}` : `https://${org?.slug}.landingchat.co`,
      contactEmail: emailSettings?.contactEmail || 'contacto@miempresa.com',
      contactPhone: emailSettings?.contactPhone || '+57 300 123 4567',
      businessAddress: emailSettings?.businessAddress || 'Bogotá, Colombia',
      paymentInstructions: emailSettings?.paymentInstructions || 'Por favor contacta al vendedor para obtener los detalles de pago.',
      supportMessage: emailSettings?.supportMessage || '¿Tienes preguntas? Contáctanos directamente desde la tienda.',
      primaryColor: emailSettings?.primaryColor || '#000000'
    }
    
    const preview = previewTemplate(subjectTemplate, htmlTemplate, templateType, customVariables)
    
    if (preview.errors.length > 0) {
      return { 
        success: false, 
        error: `Template validation errors: ${preview.errors.map(e => e.message).join(', ')}` 
      }
    }

    return { 
      success: true, 
      preview: { 
        subject: preview.subject, 
        html: preview.html 
      } 
    }
  } catch (error) {
    console.error('[EMAIL_TEMPLATES] Error previewing template:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error generando preview' 
    }
  }
}

/**
 * Send a test email with the current template
 */
export async function sendTestEmail(
  templateType: EmailTemplateType,
  subjectTemplate: string,
  htmlTemplate: string,
  testEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const organizationId = await getCurrentOrganization()
    if (!organizationId) {
      return { success: false, error: 'No autorizado' }
    }

    // Import email service
    const { Resend } = await import('resend')
    
    if (!process.env.RESEND_API_KEY) {
      return { success: false, error: 'Servicio de email no configurado. Configura RESEND_API_KEY en las variables de entorno.' }
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    
    // Generate preview with sample data
    const { previewTemplate } = await import('@/lib/email-templates/engine')
    const preview = previewTemplate(subjectTemplate, htmlTemplate, templateType)
    
    if (preview.errors.length > 0) {
      return { 
        success: false, 
        error: `Errores en el template: ${preview.errors.map(e => e.message).join(', ')}` 
      }
    }

    // Send test email
    const response = await resend.emails.send({
      from: 'LandingChat <noreply@landingchat.co>',
      to: testEmail,
      subject: `[PRUEBA] ${preview.subject}`,
      html: preview.html,
    })

    if (response.error) {
      console.error('[EMAIL_TEMPLATES] Test email error:', response.error)
      return { success: false, error: 'Error enviando email de prueba' }
    }

    return { success: true }
  } catch (error) {
    console.error('[EMAIL_TEMPLATES] Error sending test email:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error enviando email de prueba' 
    }
  }
}