# Implementation Plan - Customizable Email Templates

## Overview
This implementation plan transforms the current hardcoded email system into a flexible, organization-specific templating system that allows store owners to customize email templates while maintaining professional standards.

## Tasks

- [x] 1. Create database schema for email templates and settings
  - Create `email_templates` table for storing custom templates per organization
  - Create `organization_email_settings` table for business information
  - Add RLS policies to ensure organization isolation
  - Create indexes for performance optimization
  - _Requirements: 1.3, 3.1, 3.3_

- [ ] 2. Implement core email template data models and validation
  - [x] 2.1 Create TypeScript interfaces for email templates and settings
    - Define `EmailTemplate`, `OrganizationEmailSettings`, and `EmailTemplateVariables` interfaces
    - Create template type definitions and validation schemas using Zod
    - _Requirements: 1.2, 4.1_

  - [ ]* 2.2 Write property test for template validation
    - **Property 1: Template validation preserves required variables**
    - **Validates: Requirements 1.2, 4.1**

  - [x] 2.3 Create email template repository with CRUD operations
    - Implement functions to save, load, and validate email templates
    - Add organization isolation and fallback logic for missing templates
    - _Requirements: 1.3, 1.4, 1.5_

  - [ ]* 2.4 Write property test for organization template isolation
    - **Property 2: Organization template isolation**
    - **Validates: Requirements 1.3**

- [ ] 3. Build template engine and variable substitution system
  - [x] 3.1 Implement template engine with Handlebars.js
    - Create template compilation and variable substitution logic
    - Add template validation for required variables and syntax
    - Implement security sanitization to prevent XSS attacks
    - _Requirements: 1.2, 2.4, 4.1, 4.4_

  - [ ]* 3.2 Write property test for template selection logic
    - **Property 3: Template selection logic**
    - **Validates: Requirements 1.4, 1.5**

  - [x] 3.3 Create template variable system and sample data generator
    - Define available variables for customer and owner templates
    - Implement sample data generation for preview functionality
    - _Requirements: 2.1, 2.2_

  - [ ]* 3.4 Write property test for template validation error handling
    - **Property 4: Template validation error handling**
    - **Validates: Requirements 2.4, 4.4**

- [ ] 4. Refactor existing email service to use template system
  - [x] 4.1 Update email service to support custom templates
    - Modify `sendOrderConfirmationEmail` and `sendOrderNotificationToOwner` functions
    - Implement template loading with fallback to defaults
    - Add error handling and template corruption recovery
    - _Requirements: 1.4, 1.5, 4.5_

  - [ ]* 4.2 Write property test for template corruption recovery
    - **Property 8: Template corruption recovery**
    - **Validates: Requirements 4.5**

  - [x] 4.3 Create default email templates
    - Convert existing hardcoded templates to default template format
    - Ensure templates include all required variables and professional styling
    - _Requirements: 1.5, 4.2, 4.3_

  - [ ]* 4.4 Write property test for email template round-trip consistency
    - **Property 10: Email template round-trip consistency**
    - **Validates: Requirements 1.3**

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Build email template management dashboard interface
  - [x] 6.1 Create email settings page in dashboard
    - Add new route `/dashboard/settings/email-templates`
    - Create page layout with template type selection (customer/owner)
    - _Requirements: 1.1, 2.1_

  - [x] 6.2 Implement template editor component
    - Create rich text editor for HTML template editing
    - Add subject line editor with variable support
    - Implement template variable insertion helpers
    - _Requirements: 1.2, 2.2_

  - [x] 6.3 Build live preview system
    - Create preview component that renders templates with sample data
    - Add desktop and mobile preview modes
    - Implement real-time preview updates as user types
    - _Requirements: 2.1, 2.3_

  - [x] 6.4 Create business information settings form
    - Add form for business contact information, payment instructions
    - Implement logo upload functionality
    - Add color picker for brand customization
    - _Requirements: 3.1, 3.2_

- [ ] 7. Implement template validation and error handling
  - [ ] 7.1 Add client-side template validation
    - Validate required variables are present in templates
    - Check for valid HTML syntax and structure
    - Display clear error messages for validation failures
    - _Requirements: 2.4, 4.1, 4.4_

  - [ ] 7.2 Create server-side validation and sanitization
    - Implement server-side template validation before saving
    - Add HTML sanitization to prevent security issues
    - Create validation error response handling
    - _Requirements: 4.1, 4.4_

- [ ] 8. Add advanced template features
  - [ ] 8.1 Implement business information propagation
    - Update email generation to use organization's business settings
    - Add automatic business information updates in templates
    - _Requirements: 3.3_

  - [ ]* 8.2 Write property test for business information propagation
    - **Property 5: Business information propagation**
    - **Validates: Requirements 3.3**

  - [ ] 8.3 Add payment instruction inclusion logic
    - Implement conditional payment instructions for manual payments
    - Add payment method detection and instruction insertion
    - _Requirements: 3.2, 5.3_

  - [ ]* 8.4 Write property test for payment instruction inclusion
    - **Property 6: Payment instruction inclusion**
    - **Validates: Requirements 3.2, 5.3**

  - [ ] 8.5 Implement custom domain URL generation
    - Update email links to use organization's custom domain when configured
    - Add fallback to default LandingChat domain
    - _Requirements: 3.5, 5.5_

  - [ ]* 8.6 Write property test for custom domain URL generation
    - **Property 7: Custom domain URL generation**
    - **Validates: Requirements 3.5, 5.5**

- [ ] 9. Enhance owner notification system
  - [ ] 9.1 Improve owner notification completeness
    - Add complete order details, customer information, and management links
    - Implement direct links to order management dashboard
    - Add notification preference settings
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [ ]* 9.2 Write property test for owner notification completeness
    - **Property 9: Owner notification completeness**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [ ] 10. Create API endpoints for template management
  - [x] 10.1 Implement template CRUD API endpoints
    - Create GET `/api/dashboard/settings/email-templates` endpoint
    - Create POST `/api/dashboard/settings/email-templates` for saving templates
    - Add template preview endpoint with sample data
    - _Requirements: 1.1, 1.2, 2.1_

  - [x] 10.2 Add business settings API endpoints
    - Create PUT `/api/dashboard/settings/email-settings` endpoint
    - Add GET endpoint for available template variables
    - Implement proper authentication and organization isolation
    - _Requirements: 3.1, 3.3_

- [ ] 11. Add template performance optimizations
  - [ ] 11.1 Implement template caching system
    - Add Redis or in-memory caching for compiled templates
    - Implement cache invalidation on template updates
    - Add performance monitoring for email generation
    - _Requirements: Performance optimization_

  - [ ] 11.2 Create template backup and recovery system
    - Implement automatic template backups before updates
    - Add template version history tracking
    - Create recovery mechanism for corrupted templates
    - _Requirements: 4.5_

- [ ] 12. Final integration and testing
  - [ ] 12.1 Integration testing for complete email flow
    - Test end-to-end email sending with custom templates
    - Verify template isolation across multiple organizations
    - Test fallback mechanisms and error recovery
    - _Requirements: All requirements_

  - [ ]* 12.2 Write integration tests for email template system
    - Test complete flow from order creation to email delivery
    - Verify template editor and preview functionality
    - Test multi-tenant isolation and security

- [ ] 13. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.