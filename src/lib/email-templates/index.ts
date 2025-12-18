/**
 * Email Templates System - Main Export
 * Centralized exports for the customizable email templates system
 */

// Core repository and service
export { EmailTemplateRepository, hasCustomTemplates, getEmailSettingsWithDefaults } from './repository'
export { EmailTemplateService, sendOrderConfirmationEmailWithTemplates, sendOrderNotificationToOwnerWithTemplates } from './service'

// Template engine and utilities
export { EmailTemplateEngine, previewTemplate, validateEmailTemplate } from './engine'

// Default templates
export { 
  getDefaultTemplate, 
  createDefaultTemplatesForOrganization,
  DEFAULT_CUSTOMER_CONFIRMATION_SUBJECT,
  DEFAULT_CUSTOMER_CONFIRMATION_HTML,
  DEFAULT_OWNER_NOTIFICATION_SUBJECT,
  DEFAULT_OWNER_NOTIFICATION_HTML,
  EMERGENCY_CUSTOMER_TEMPLATE,
  EMERGENCY_OWNER_TEMPLATE
} from './defaults'

// Re-export types for convenience
export type {
  EmailTemplate,
  OrganizationEmailSettings,
  EmailTemplateVariables,
  EmailTemplateType,
  TemplateVariable,
  ValidationResult,
  ValidationError,
  TemplatePreview,
  EmailResult,
  CreateEmailTemplateInput,
  UpdateEmailTemplateInput,
  CreateOrganizationEmailSettingsInput,
  UpdateOrganizationEmailSettingsInput
} from '@/types/email-template'

// Re-export template variables
export { 
  getTemplateVariables,
  CUSTOMER_CONFIRMATION_VARIABLES,
  OWNER_NOTIFICATION_VARIABLES,
  isEmailTemplateType
} from '@/types/email-template'