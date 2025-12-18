/**
 * Email Template Repository
 * Handles CRUD operations for email templates and organization email settings
 */

import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { 
  EmailTemplate, 
  OrganizationEmailSettings, 
  EmailTemplateType,
  CreateEmailTemplateInput,
  UpdateEmailTemplateInput,
  CreateOrganizationEmailSettingsInput,
  UpdateOrganizationEmailSettingsInput
} from '@/types/email-template'

/**
 * Email Template Repository Class
 * Provides methods to manage email templates with organization isolation
 */
export class EmailTemplateRepository {
  
  /**
   * Get all email templates for an organization
   */
  static async getTemplatesByOrganization(organizationId: string): Promise<EmailTemplate[]> {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('template_type')
    
    if (error) {
      console.error('[EMAIL_TEMPLATES] Error fetching templates:', error)
      throw new Error(`Failed to fetch email templates: ${error.message}`)
    }
    
    return data?.map(this.mapDatabaseToEmailTemplate) || []
  }
  
  /**
   * Get a specific email template by organization and type
   */
  static async getTemplate(organizationId: string, templateType: EmailTemplateType): Promise<EmailTemplate | null> {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('template_type', templateType)
      .eq('is_active', true)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - template doesn't exist
        return null
      }
      console.error('[EMAIL_TEMPLATES] Error fetching template:', error)
      throw new Error(`Failed to fetch email template: ${error.message}`)
    }
    
    return data ? this.mapDatabaseToEmailTemplate(data) : null
  }
  
  /**
   * Create or update an email template
   */
  static async upsertTemplate(
    organizationId: string, 
    templateType: EmailTemplateType,
    input: CreateEmailTemplateInput
  ): Promise<EmailTemplate> {
    const supabase = await createClient()
    
    const templateData = {
      organization_id: organizationId,
      template_type: templateType,
      subject_template: input.subjectTemplate,
      html_template: input.htmlTemplate,
      variables: input.variables || {},
      is_active: true,
      updated_at: new Date().toISOString()
    }
    
    const { data, error } = await supabase
      .from('email_templates')
      .upsert(templateData, {
        onConflict: 'organization_id,template_type'
      })
      .select()
      .single()
    
    if (error) {
      console.error('[EMAIL_TEMPLATES] Error upserting template:', error)
      throw new Error(`Failed to save email template: ${error.message}`)
    }
    
    return this.mapDatabaseToEmailTemplate(data)
  }
  
  /**
   * Update an existing email template
   */
  static async updateTemplate(
    organizationId: string,
    templateType: EmailTemplateType,
    input: UpdateEmailTemplateInput
  ): Promise<EmailTemplate | null> {
    const supabase = await createClient()
    
    const updateData: any = {
      updated_at: new Date().toISOString()
    }
    
    if (input.subjectTemplate !== undefined) {
      updateData.subject_template = input.subjectTemplate
    }
    if (input.htmlTemplate !== undefined) {
      updateData.html_template = input.htmlTemplate
    }
    if (input.variables !== undefined) {
      updateData.variables = input.variables
    }
    
    const { data, error } = await supabase
      .from('email_templates')
      .update(updateData)
      .eq('organization_id', organizationId)
      .eq('template_type', templateType)
      .eq('is_active', true)
      .select()
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('[EMAIL_TEMPLATES] Error updating template:', error)
      throw new Error(`Failed to update email template: ${error.message}`)
    }
    
    return this.mapDatabaseToEmailTemplate(data)
  }
  
  /**
   * Delete an email template (soft delete by setting is_active = false)
   */
  static async deleteTemplate(organizationId: string, templateType: EmailTemplateType): Promise<boolean> {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('email_templates')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', organizationId)
      .eq('template_type', templateType)
    
    if (error) {
      console.error('[EMAIL_TEMPLATES] Error deleting template:', error)
      throw new Error(`Failed to delete email template: ${error.message}`)
    }
    
    return true
  }
  
  /**
   * Get organization email settings
   */
  static async getEmailSettings(organizationId: string): Promise<OrganizationEmailSettings | null> {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('organization_email_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No settings found - return null
        return null
      }
      console.error('[EMAIL_TEMPLATES] Error fetching email settings:', error)
      throw new Error(`Failed to fetch email settings: ${error.message}`)
    }
    
    return data ? this.mapDatabaseToEmailSettings(data) : null
  }
  
  /**
   * Create or update organization email settings
   */
  static async upsertEmailSettings(
    organizationId: string,
    input: CreateOrganizationEmailSettingsInput
  ): Promise<OrganizationEmailSettings> {
    const supabase = await createClient()
    
    const settingsData = {
      organization_id: organizationId,
      business_name: input.businessName,
      contact_email: input.contactEmail,
      contact_phone: input.contactPhone,
      business_address: input.businessAddress,
      payment_instructions: input.paymentInstructions,
      support_message: input.supportMessage,
      logo_url: input.logoUrl,
      primary_color: input.primaryColor || '#000000',
      updated_at: new Date().toISOString()
    }
    
    const { data, error } = await supabase
      .from('organization_email_settings')
      .upsert(settingsData, {
        onConflict: 'organization_id'
      })
      .select()
      .single()
    
    if (error) {
      console.error('[EMAIL_TEMPLATES] Error upserting email settings:', error)
      throw new Error(`Failed to save email settings: ${error.message}`)
    }
    
    return this.mapDatabaseToEmailSettings(data)
  }
  
  /**
   * Update organization email settings
   */
  static async updateEmailSettings(
    organizationId: string,
    input: UpdateOrganizationEmailSettingsInput
  ): Promise<OrganizationEmailSettings | null> {
    const supabase = await createClient()
    
    const updateData: any = {
      updated_at: new Date().toISOString()
    }
    
    // Only update fields that are provided
    if (input.businessName !== undefined) updateData.business_name = input.businessName
    if (input.contactEmail !== undefined) updateData.contact_email = input.contactEmail
    if (input.contactPhone !== undefined) updateData.contact_phone = input.contactPhone
    if (input.businessAddress !== undefined) updateData.business_address = input.businessAddress
    if (input.paymentInstructions !== undefined) updateData.payment_instructions = input.paymentInstructions
    if (input.supportMessage !== undefined) updateData.support_message = input.supportMessage
    if (input.logoUrl !== undefined) updateData.logo_url = input.logoUrl
    if (input.primaryColor !== undefined) updateData.primary_color = input.primaryColor
    
    const { data, error } = await supabase
      .from('organization_email_settings')
      .update(updateData)
      .eq('organization_id', organizationId)
      .select()
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('[EMAIL_TEMPLATES] Error updating email settings:', error)
      throw new Error(`Failed to update email settings: ${error.message}`)
    }
    
    return this.mapDatabaseToEmailSettings(data)
  }
  
  /**
   * Get template with fallback to default (for email generation)
   * This method uses service client to bypass RLS for system operations
   */
  static async getTemplateWithFallback(
    organizationId: string, 
    templateType: EmailTemplateType
  ): Promise<EmailTemplate | null> {
    // First try to get organization's custom template
    try {
      const customTemplate = await this.getTemplate(organizationId, templateType)
      if (customTemplate) {
        return customTemplate
      }
    } catch (error) {
      console.warn('[EMAIL_TEMPLATES] Error fetching custom template, falling back to default:', error)
    }
    
    // If no custom template, we'll return null and let the email service use hardcoded defaults
    // In the future, we could store default templates in the database
    return null
  }
  
  /**
   * Map database row to EmailTemplate interface
   */
  private static mapDatabaseToEmailTemplate(data: any): EmailTemplate {
    return {
      id: data.id,
      organizationId: data.organization_id,
      templateType: data.template_type,
      subjectTemplate: data.subject_template,
      htmlTemplate: data.html_template,
      variables: data.variables || {},
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }
  
  /**
   * Map database row to OrganizationEmailSettings interface
   */
  private static mapDatabaseToEmailSettings(data: any): OrganizationEmailSettings {
    return {
      id: data.id,
      organizationId: data.organization_id,
      businessName: data.business_name,
      contactEmail: data.contact_email,
      contactPhone: data.contact_phone,
      businessAddress: data.business_address,
      paymentInstructions: data.payment_instructions,
      supportMessage: data.support_message,
      logoUrl: data.logo_url,
      primaryColor: data.primary_color || '#000000',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }
}

/**
 * Helper functions for common operations
 */

/**
 * Check if an organization has custom templates configured
 */
export async function hasCustomTemplates(organizationId: string): Promise<boolean> {
  try {
    const templates = await EmailTemplateRepository.getTemplatesByOrganization(organizationId)
    return templates.length > 0
  } catch (error) {
    console.error('[EMAIL_TEMPLATES] Error checking for custom templates:', error)
    return false
  }
}

/**
 * Get email settings with sensible defaults
 */
export async function getEmailSettingsWithDefaults(
  organizationId: string,
  organizationName: string
): Promise<Partial<OrganizationEmailSettings>> {
  try {
    const settings = await EmailTemplateRepository.getEmailSettings(organizationId)
    
    // Return settings with defaults
    return {
      businessName: settings?.businessName || organizationName,
      contactEmail: settings?.contactEmail,
      contactPhone: settings?.contactPhone,
      businessAddress: settings?.businessAddress,
      paymentInstructions: settings?.paymentInstructions || 'Por favor contacta al vendedor para obtener los detalles de pago.',
      supportMessage: settings?.supportMessage || '¿Tienes preguntas? Contáctanos directamente desde la tienda.',
      logoUrl: settings?.logoUrl,
      primaryColor: settings?.primaryColor || '#000000'
    }
  } catch (error) {
    console.error('[EMAIL_TEMPLATES] Error fetching email settings, using defaults:', error)
    
    // Return minimal defaults on error
    return {
      businessName: organizationName,
      paymentInstructions: 'Por favor contacta al vendedor para obtener los detalles de pago.',
      supportMessage: '¿Tienes preguntas? Contáctanos directamente desde la tienda.',
      primaryColor: '#000000'
    }
  }
}