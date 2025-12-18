import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EmailTemplateRepository } from '@/lib/email-templates/repository'
import { 
  CreateEmailTemplateSchema,
  EmailTemplateTypeSchema
} from '@/types/email-template'
import type { EmailTemplateType } from '@/types/email-template'

/**
 * GET /api/dashboard/settings/email-templates
 * Get all email templates for the authenticated user's organization
 */
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get current user and organization
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (orgError || !userOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get templates
    const templates = await EmailTemplateRepository.getTemplatesByOrganization(userOrg.organization_id)
    
    return NextResponse.json({ templates })
  } catch (error) {
    console.error('[API] Error fetching email templates:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

/**
 * POST /api/dashboard/settings/email-templates
 * Create or update an email template
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user and organization
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (orgError || !userOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    
    // Validate template type
    const templateTypeResult = EmailTemplateTypeSchema.safeParse(body.templateType)
    if (!templateTypeResult.success) {
      return NextResponse.json(
        { error: 'Invalid template type' }, 
        { status: 400 }
      )
    }

    // Validate template data
    const templateResult = CreateEmailTemplateSchema.safeParse(body)
    if (!templateResult.success) {
      return NextResponse.json(
        { error: 'Invalid template data', details: templateResult.error.issues }, 
        { status: 400 }
      )
    }

    // Save template
    const template = await EmailTemplateRepository.upsertTemplate(
      userOrg.organization_id,
      templateTypeResult.data,
      templateResult.data
    )
    
    return NextResponse.json({ template })
  } catch (error) {
    console.error('[API] Error saving email template:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}