import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { previewTemplate } from '@/lib/email-templates/engine'
import { EmailTemplateTypeSchema } from '@/types/email-template'
import { z } from 'zod'

const PreviewRequestSchema = z.object({
  templateType: EmailTemplateTypeSchema,
  subjectTemplate: z.string().min(1, 'Subject template is required'),
  htmlTemplate: z.string().min(1, 'HTML template is required'),
  customVariables: z.record(z.string(), z.any()).optional()
})

/**
 * POST /api/dashboard/settings/email-templates/preview
 * Generate a preview of an email template with sample data
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user (for authentication)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    
    // Validate request data
    const validationResult = PreviewRequestSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.issues }, 
        { status: 400 }
      )
    }

    const { templateType, subjectTemplate, htmlTemplate, customVariables } = validationResult.data

    // Generate preview
    const preview = previewTemplate(
      subjectTemplate,
      htmlTemplate,
      templateType,
      customVariables
    )
    
    return NextResponse.json({
      subject: preview.subject,
      html: preview.html,
      errors: preview.errors
    })
  } catch (error) {
    console.error('[API] Error generating email template preview:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}