/**
 * Email Template Engine
 * Handles template compilation, variable substitution, and validation using Handlebars.js
 */

import type { 
  EmailTemplateVariables, 
  ValidationResult, 
  ValidationError,
  EmailTemplateType,
  TemplateVariable
} from '@/types/email-template'
import { getTemplateVariables } from '@/types/email-template'

/**
 * Simple template engine using string replacement (avoiding external dependencies for now)
 * In production, this would use Handlebars.js for more advanced templating
 */
export class EmailTemplateEngine {
  
  /**
   * Compile and render a template with variables
   */
  static renderTemplate(
    template: string,
    variables: EmailTemplateVariables
  ): string {
    let rendered = template
    
    // Replace all variables in the format {{variableName}}
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      const stringValue = this.formatVariableValue(key, value)
      rendered = rendered.replace(regex, stringValue)
    })
    
    return rendered
  }
  
  /**
   * Validate template syntax and required variables
   */
  static validateTemplate(
    template: string,
    templateType: EmailTemplateType
  ): ValidationResult {
    const errors: ValidationError[] = []
    
    // Check for basic template structure
    if (!template || template.trim().length === 0) {
      errors.push({
        field: 'template',
        message: 'Template cannot be empty',
        code: 'TEMPLATE_EMPTY'
      })
      return { isValid: false, errors }
    }
    
    // Extract simple variables from template (not conditionals)
    const templateVariables = this.extractSimpleVariables(template)
    
    // Basic HTML validation (check for unclosed tags)
    const htmlErrors = this.validateBasicHTML(template)
    errors.push(...htmlErrors)
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
  
  /**
   * Extract simple variables (not conditionals) from template
   */
  private static extractSimpleVariables(template: string): string[] {
    const variableMatches = template.match(/{{\s*([^}#/]+)\s*}}/g) || []
    return variableMatches
      .map(match => match.replace(/[{}\s]/g, ''))
      .filter(v => v && !v.startsWith('#') && !v.startsWith('/') && !v.startsWith('else'))
  }
  
  /**
   * Sanitize HTML template to prevent XSS attacks
   */
  static sanitizeTemplate(template: string): string {
    // Basic sanitization - remove script tags and dangerous attributes
    let sanitized = template
    
    // Remove script tags
    sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    
    // Remove dangerous event handlers
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    
    // Remove javascript: protocols
    sanitized = sanitized.replace(/javascript:/gi, '')
    
    // Remove data: protocols (except for images)
    sanitized = sanitized.replace(/data:(?!image)/gi, '')
    
    return sanitized
  }
  
  /**
   * Generate sample data for template preview
   */
  static generateSampleData(templateType: EmailTemplateType): EmailTemplateVariables {
    const baseData: EmailTemplateVariables = {
      // Order variables
      orderNumber: 'ORD-2024-001',
      orderDate: '17 de diciembre de 2024',
      orderTotal: '$150.000',
      orderItems: [
        { name: 'Producto Ejemplo 1', quantity: 2, price: 50000, total: 100000 },
        { name: 'Producto Ejemplo 2', quantity: 1, price: 50000, total: 50000 }
      ],
      orderStatus: 'pending',
      
      // Customer variables
      customerName: 'Juan Pérez',
      customerEmail: 'juan.perez@example.com',
      customerPhone: '+57 300 123 4567',
      
      // Store variables
      storeName: 'Mi Tienda Demo',
      storeUrl: 'https://mitienda.landingchat.co',
      storeLogoUrl: 'https://mitienda.landingchat.co/logo.png',
      
      // Business variables
      businessName: 'Mi Empresa SAS',
      contactEmail: 'contacto@miempresa.com',
      contactPhone: '+57 1 234 5678',
      businessAddress: 'Calle 123 #45-67, Bogotá, Colombia',
      paymentInstructions: 'Transferir a la cuenta Bancolombia 123-456789-01 a nombre de Mi Empresa SAS',
      supportMessage: '¿Tienes preguntas? Contáctanos al WhatsApp +57 300 123 4567',
      
      // Payment variables
      paymentMethod: 'manual',
      
      // Links
      profileUrl: 'https://mitienda.landingchat.co/profile?email=juan.perez@example.com',
      orderManagementUrl: 'https://landingchat.co/dashboard/orders/ORD-2024-001'
    }
    
    return baseData
  }
  
  /**
   * Extract variables used in a template
   */
  static extractTemplateVariables(template: string): string[] {
    const variableMatches = template.match(/{{\s*([^}]+)\s*}}/g) || []
    return variableMatches.map(match => {
      // Remove {{ }} and whitespace, also handle conditionals
      return match.replace(/[{}\s]/g, '').replace(/^#(if|eq|unless)/, '').replace(/^\/(if|eq|unless)/, '')
    }).filter(v => v && !v.startsWith('/') && !v.startsWith('else'))
  }
  
  /**
   * Format variable value for display
   */
  private static formatVariableValue(key: string, value: any): string {
    if (value === null || value === undefined) {
      return ''
    }
    
    // Handle arrays (like order items)
    if (Array.isArray(value)) {
      if (key === 'orderItems') {
        return this.formatOrderItems(value)
      }
      return value.join(', ')
    }
    
    // Handle currency formatting
    if (key.includes('Total') || key.includes('Price') || key.includes('price')) {
      if (typeof value === 'number') {
        return new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value)
      }
    }
    
    return String(value)
  }
  
  /**
   * Format order items for email display
   */
  private static formatOrderItems(items: any[]): string {
    return items.map(item => {
      const total = item.price * item.quantity
      const formattedPrice = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(total)
      
      return `${item.quantity}x ${item.name} - ${formattedPrice}`
    }).join('<br>')
  }
  
  /**
   * Basic HTML validation
   */
  private static validateBasicHTML(html: string): ValidationError[] {
    const errors: ValidationError[] = []
    
    // Check for unclosed tags (basic check)
    const openTags = html.match(/<([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g) || []
    const closeTags = html.match(/<\/([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g) || []
    
    const openTagNames = openTags.map(tag => {
      const match = tag.match(/<([a-zA-Z][a-zA-Z0-9]*)/)
      return match ? match[1].toLowerCase() : ''
    }).filter(Boolean)
    
    const closeTagNames = closeTags.map(tag => {
      const match = tag.match(/<\/([a-zA-Z][a-zA-Z0-9]*)/)
      return match ? match[1].toLowerCase() : ''
    }).filter(Boolean)
    
    // Self-closing tags that don't need closing tags
    const selfClosingTags = ['img', 'br', 'hr', 'input', 'meta', 'link']
    
    // Count tags
    const tagCounts: Record<string, number> = {}
    
    openTagNames.forEach(tag => {
      if (!selfClosingTags.includes(tag)) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      }
    })
    
    closeTagNames.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) - 1
    })
    
    // Check for unmatched tags
    Object.entries(tagCounts).forEach(([tag, count]) => {
      if (count > 0) {
        errors.push({
          field: 'template',
          message: `Unclosed HTML tag: <${tag}>`,
          code: 'UNCLOSED_HTML_TAG'
        })
      } else if (count < 0) {
        errors.push({
          field: 'template',
          message: `Extra closing tag: </${tag}>`,
          code: 'EXTRA_CLOSING_TAG'
        })
      }
    })
    
    return errors
  }
}

/**
 * Helper functions for template operations
 */

/**
 * Create a preview of a template with sample data
 */
export function previewTemplate(
  subjectTemplate: string,
  htmlTemplate: string,
  templateType: EmailTemplateType,
  customVariables?: Partial<EmailTemplateVariables>
): { subject: string; html: string; errors: ValidationError[] } {
  // Validate templates
  const subjectValidation = EmailTemplateEngine.validateTemplate(subjectTemplate, templateType)
  const htmlValidation = EmailTemplateEngine.validateTemplate(htmlTemplate, templateType)
  
  const errors = [...subjectValidation.errors, ...htmlValidation.errors]
  
  // Generate sample data
  const sampleData = {
    ...EmailTemplateEngine.generateSampleData(templateType),
    ...customVariables
  }
  
  // Render templates
  const subject = EmailTemplateEngine.renderTemplate(subjectTemplate, sampleData)
  const html = EmailTemplateEngine.renderTemplate(htmlTemplate, sampleData)
  
  return {
    subject,
    html: EmailTemplateEngine.sanitizeTemplate(html),
    errors
  }
}

/**
 * Validate both subject and HTML templates
 */
export function validateEmailTemplate(
  subjectTemplate: string,
  htmlTemplate: string,
  templateType: EmailTemplateType
): ValidationResult {
  const subjectValidation = EmailTemplateEngine.validateTemplate(subjectTemplate, templateType)
  const htmlValidation = EmailTemplateEngine.validateTemplate(htmlTemplate, templateType)
  
  const allErrors = [...subjectValidation.errors, ...htmlValidation.errors]
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors
  }
}