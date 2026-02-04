import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/utils/encryption'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')

    if (!orgId) {
      return NextResponse.json({ error: 'orgId required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Obtener integración
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', orgId)
      .eq('provider', 'nuby')
      .single()

    if (error || !integration) {
      return NextResponse.json({ error: 'Integration not found', details: error }, { status: 404 })
    }

    // Construir URL
    const instance = integration.credentials.instance
    const token = decrypt(integration.credentials.token)
    const url = `https://${instance}.arrendasoft.co/service/v2/public/properties?limit=1`

    // Test de conexión
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      url,
      hasToken: !!token,
      tokenLength: token?.length,
      data: response.ok ? data : null,
      error: !response.ok ? data : null
    })

  } catch (error: any) {
    return NextResponse.json({
      error: 'Test failed',
      message: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
