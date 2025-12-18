/**
 * Email Template System Types
 * Defines interfaces for customizable email templates and organization email settings
 */

import { z } from 'zod'

// Email template types
export type EmailTemplateType = 'customer_confirmation' | 'owner_notification'

// Base email template interface
export interface EmailTemplate {
  id: string
  organizationId: string
  templateType: EmailTemplateType
  subjectTemplate: string
  htmlTemplate: string
  variables: Record<string, any>
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Organization email settings interface
export interface OrganizationEmailSettings {
  id: string
  organizationId: string
  businessName?: string
  contactEmail?: string
  contactPhone?: string
  businessAddress?: string
  paymentInstructions?: string
  supportMessage?: string
  logoUrl?: string
  primaryColor: string
  createdAt: Date
  updatedAt: Date
}

// Template variables for email generation
export interface EmailTemplateVariables {
  // Order variables
  orderNumber: string
  orderDate: string
  orderTotal: string
  orderItems: OrderItem[]
  orderStatus: string
  
  // Customer variables
  customerName: string
  customerEmail: string
  customerPhone?: string
  
  // Store variables
  storeName: string
  storeUrl: string
  storeLogoUrl?: string
  
  // Business variables
  businessName: string
  contactEmail: string
  contactPhone?: string
  businessAddress?: string
  paymentInstructions?: string
  supportMessage?: string
  
  // Payment variables
  paymentMethod: string
  
  // Links
  profileUrl?: string
  orderManagementUrl?: string
}

// Order item interface for email templates
export interface OrderItem {
  name: string
  quantity: number
  price: number
  total: number
}

// Template variable definition for editor
export interface TemplateVariable {
  key: string
  description: string
  type: 'string' | 'number' | 'date' | 'currency' | 'array'
  required: boolean
  example: string
}

// Validation result for template validation
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

// Template preview interface
export interface TemplatePreview {
  html: string
  subject: string
  variables: EmailTemplateVariables
  errors: ValidationError[]
}

// Email service result
export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

// Zod validation schemas
export const EmailTemplateTypeSchema = z.enum(['customer_confirmation', 'owner_notification'])

export const EmailTemplateSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  templateType: EmailTemplateTypeSchema,
  subjectTemplate: z.string().min(1, 'Subject template is required'),
  htmlTemplate: z.string().min(1, 'HTML template is required'),
  variables: z.record(z.string(), z.any()).default({}),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const OrganizationEmailSettingsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  businessName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  businessAddress: z.string().optional(),
  paymentInstructions: z.string().optional(),
  supportMessage: z.string().optional(),
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Must be a valid hex color').default('#000000'),
  createdAt: z.date(),
  updatedAt: z.date()
})

// Input schemas for API endpoints
export const CreateEmailTemplateSchema = z.object({
  templateType: EmailTemplateTypeSchema,
  subjectTemplate: z.string().min(1, 'Subject template is required'),
  htmlTemplate: z.string().min(1, 'HTML template is required'),
  variables: z.record(z.string(), z.any()).optional().default({})
})

export const UpdateEmailTemplateSchema = CreateEmailTemplateSchema.partial()

export const CreateOrganizationEmailSettingsSchema = z.object({
  businessName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  businessAddress: z.string().optional(),
  paymentInstructions: z.string().optional(),
  supportMessage: z.string().optional(),
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Must be a valid hex color').default('#000000')
})

export const UpdateOrganizationEmailSettingsSchema = CreateOrganizationEmailSettingsSchema.partial()

// Template variable definitions for different template types
export const CUSTOMER_CONFIRMATION_VARIABLES: TemplateVariable[] = [
  { key: 'customerName', description: 'Customer full name', type: 'string', required: true, example: 'Juan Pérez' },
  { key: 'orderNumber', description: 'Order number', type: 'string', required: true, example: 'ORD-001' },
  { key: 'orderTotal', description: 'Order total amount', type: 'currency', required: true, example: '$150.000' },
  { key: 'orderItems', description: 'List of ordered items', type: 'array', required: true, example: '[Product 1, Product 2]' },
  { key: 'orderDate', description: 'Order creation date', type: 'date', required: true, example: '2024-12-17' },
  { key: 'orderStatus', description: 'Current order status', type: 'string', required: true, example: 'pending' },
  { key: 'customerEmail', description: 'Customer email address', type: 'string', required: true, example: 'juan@example.com' },
  { key: 'customerPhone', description: 'Customer phone number', type: 'string', required: false, example: '+57 300 123 4567' },
  { key: 'storeName', description: 'Store name', type: 'string', required: true, example: 'Mi Tienda' },
  { key: 'storeUrl', description: 'Store URL', type: 'string', required: true, example: 'https://mitienda.landingchat.co' },
  { key: 'businessName', description: 'Business name', type: 'string', required: false, example: 'Mi Empresa SAS' },
  { key: 'contactEmail', description: 'Business contact email', type: 'string', required: false, example: 'contacto@miempresa.com' },
  { key: 'contactPhone', description: 'Business contact phone', type: 'string', required: false, example: '+57 1 234 5678' },
  { key: 'businessAddress', description: 'Business address', type: 'string', required: false, example: 'Calle 123 #45-67, Bogotá' },
  { key: 'paymentInstructions', description: 'Payment instructions', type: 'string', required: false, example: 'Transferir a cuenta...' },
  { key: 'supportMessage', description: 'Support message', type: 'string', required: false, example: 'Contáctanos si tienes dudas' },
  { key: 'paymentMethod', description: 'Payment method used', type: 'string', required: true, example: 'manual' },
  { key: 'profileUrl', description: 'Customer profile URL', type: 'string', required: false, example: 'https://mitienda.landingchat.co/profile' }
]

export const OWNER_NOTIFICATION_VARIABLES: TemplateVariable[] = [
  { key: 'orderNumber', description: 'Order number', type: 'string', required: true, example: 'ORD-001' },
  { key: 'customerName', description: 'Customer full name', type: 'string', required: true, example: 'Juan Pérez' },
  { key: 'customerEmail', description: 'Customer email address', type: 'string', required: true, example: 'juan@example.com' },
  { key: 'customerPhone', description: 'Customer phone number', type: 'string', required: false, example: '+57 300 123 4567' },
  { key: 'orderTotal', description: 'Order total amount', type: 'currency', required: true, example: '$150.000' },
  { key: 'orderItems', description: 'List of ordered items', type: 'array', required: true, example: '[Product 1, Product 2]' },
  { key: 'orderDate', description: 'Order creation date', type: 'date', required: true, example: '2024-12-17' },
  { key: 'orderStatus', description: 'Current order status', type: 'string', required: true, example: 'pending' },
  { key: 'paymentMethod', description: 'Payment method used', type: 'string', required: true, example: 'manual' },
  { key: 'storeName', description: 'Store name', type: 'string', required: true, example: 'Mi Tienda' },
  { key: 'orderManagementUrl', description: 'Direct link to manage the order', type: 'string', required: false, example: 'https://landingchat.co/dashboard/orders/123' }
]

// Helper function to get variables for template type
export function getTemplateVariables(templateType: EmailTemplateType): TemplateVariable[] {
  switch (templateType) {
    case 'customer_confirmation':
      return CUSTOMER_CONFIRMATION_VARIABLES
    case 'owner_notification':
      return OWNER_NOTIFICATION_VARIABLES
    default:
      return []
  }
}

// Type guards
export function isEmailTemplateType(value: string): value is EmailTemplateType {
  return ['customer_confirmation', 'owner_notification'].includes(value)
}

// Input types for API
export type CreateEmailTemplateInput = z.infer<typeof CreateEmailTemplateSchema>
export type UpdateEmailTemplateInput = z.infer<typeof UpdateEmailTemplateSchema>
export type CreateOrganizationEmailSettingsInput = z.infer<typeof CreateOrganizationEmailSettingsSchema>
export type UpdateOrganizationEmailSettingsInput = z.infer<typeof UpdateOrganizationEmailSettingsSchema>