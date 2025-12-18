import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EmailTemplateRepository } from '@/lib/email-templates/repository'
import { 
  CreateOrganizationEmailSettingsSchema,
  UpdateOrganizationEmailSettingsSchema
} from '@/types/email-template'

/**
 * GET /api/dashboard/settings/email-settings
 * Get email settings for the authenticated user's organization
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

    // Get email settings
    const settings = await EmailTemplateRepository.getEmailSettings(userOrg.organization_id)
    
    return NextResponse.json({ settings })
  } catch (error) {
    console.error('[API] Error fetching email settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

/**
 * POST /api/dashboard/settings/email-settings
 * Create email settings for the authenticated user's organization
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
    
    // Validate settings data
    const settingsResult = CreateOrganizationEmailSettingsSchema.safeParse(body)
    if (!settingsResult.success) {
      return NextResponse.json(
        { error: 'Invalid settings data', details: settingsResult.error.issues }, 
        { status: 400 }
      )
    }

    // Save settings
    const settings = await EmailTemplateRepository.upsertEmailSettings(
      userOrg.organization_id,
      settingsResult.data
    )
    
    return NextResponse.json({ settings })
  } catch (error) {
    console.error('[API] Error saving email settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

/**
 * PUT /api/dashboard/settings/email-settings
 * Update email settings for the authenticated user's organization
 */
export async function PUT(request: NextRequest) {
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
    
    // Validate settings data
    const settingsResult = UpdateOrganizationEmailSettingsSchema.safeParse(body)
    if (!settingsResult.success) {
      return NextResponse.json(
        { error: 'Invalid settings data', details: settingsResult.error.issues }, 
        { status: 400 }
      )
    }

    // Update settings
    const settings = await EmailTemplateRepository.updateEmailSettings(
      userOrg.organization_id,
      settingsResult.data
    )
    
    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 })
    }
    
    return NextResponse.json({ settings })
  } catch (error) {
    console.error('[API] Error updating email settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}