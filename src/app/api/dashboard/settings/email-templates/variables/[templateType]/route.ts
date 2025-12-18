import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTemplateVariables } from '@/types/email-template'
import { EmailTemplateTypeSchema } from '@/types/email-template'

interface RouteParams {
  params: Promise<{
    templateType: string
  }>
}

/**
 * GET /api/dashboard/settings/email-templates/variables/[templateType]
 * Get available variables for a specific template type
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { templateType } = await params
    const supabase = await createClient()
    
    // Get current user (for authentication)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate template type
    const templateTypeResult = EmailTemplateTypeSchema.safeParse(templateType)
    if (!templateTypeResult.success) {
      return NextResponse.json(
        { error: 'Invalid template type' }, 
        { status: 400 }
      )
    }

    // Get variables for this template type
    const variables = getTemplateVariables(templateTypeResult.data)
    
    return NextResponse.json({ variables })
  } catch (error) {
    console.error('[API] Error fetching template variables:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}