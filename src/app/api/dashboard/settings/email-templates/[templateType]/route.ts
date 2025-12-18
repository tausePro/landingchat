import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EmailTemplateRepository } from '@/lib/email-templates/repository'
import { EmailTemplateTypeSchema } from '@/types/email-template'

interface RouteParams {
  params: Promise<{
    templateType: string
  }>
}

/**
 * GET /api/dashboard/settings/email-templates/[templateType]
 * Get a specific email template by type
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { templateType } = await params
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

    // Validate template type
    const templateTypeResult = EmailTemplateTypeSchema.safeParse(templateType)
    if (!templateTypeResult.success) {
      return NextResponse.json(
        { error: 'Invalid template type' }, 
        { status: 400 }
      )
    }

    // Get template
    const template = await EmailTemplateRepository.getTemplate(
      userOrg.organization_id,
      templateTypeResult.data
    )
    
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    
    return NextResponse.json({ template })
  } catch (error) {
    console.error('[API] Error fetching email template:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/dashboard/settings/email-templates/[templateType]
 * Delete an email template (revert to default)
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { templateType } = await params
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

    // Validate template type
    const templateTypeResult = EmailTemplateTypeSchema.safeParse(templateType)
    if (!templateTypeResult.success) {
      return NextResponse.json(
        { error: 'Invalid template type' }, 
        { status: 400 }
      )
    }

    // Delete template
    await EmailTemplateRepository.deleteTemplate(
      userOrg.organization_id,
      templateTypeResult.data
    )
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error deleting email template:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}