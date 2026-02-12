import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/utils/encryption'
import { mapNubyPropertyToLocal } from '@/lib/nuby/mapper'
import https from 'https'

// Función para hacer request con https nativo
function httpsGet(url: string, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(new Error(`Invalid JSON: ${data.substring(0, 100)}`))
        }
      })
    })

    req.on('error', (e) => reject(e))
    req.end()
  })
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Obtener integración
    const { data: integration, error: integrationError } = await serviceClient
      .from('integrations')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .eq('provider', 'nuby')
      .single()

    if (integrationError || !integration) {
      return NextResponse.json({ error: 'Integración no encontrada' }, { status: 404 })
    }

    // Desencriptar token
    const token = decrypt(integration.credentials.token)
    // Limpiar instancia: quitar .arrendasoft.co si el usuario lo incluyó
    let instance = integration.credentials.instance.trim().toLowerCase()
    instance = instance.replace('.arrendasoft.co', '').replace('.arrendasoft', '')
    const url = `https://${instance}.arrendasoft.co/service/v2/public/properties`

    console.log('Fetching with https native:', url)
    console.log('Token:', token ? `${token.substring(0, 10)}...` : 'NO TOKEN')

    // Usar https nativo en lugar de fetch
    const properties = await httpsGet(url, token)

    // Guardar propiedades
    let created = 0
    let updated = 0

    for (const nubyProperty of properties) {
      const localProperty = mapNubyPropertyToLocal(nubyProperty, profile.organization_id)

      const { data: existing } = await serviceClient
        .from('properties')
        .select('id')
        .eq('external_code', localProperty.external_code)
        .eq('organization_id', profile.organization_id)
        .single()

      if (existing) {
        await serviceClient
          .from('properties')
          .update(localProperty)
          .eq('id', existing.id)
        updated++
      } else {
        await serviceClient
          .from('properties')
          .insert(localProperty)
        created++
      }
    }

    // Actualizar estado de integración
    await serviceClient
      .from('integrations')
      .update({ 
        status: 'connected',
        last_sync_at: new Date().toISOString(),
        error_message: null
      })
      .eq('id', integration.id)

    return NextResponse.json({
      success: true,
      total: properties.length,
      created,
      updated
    })

  } catch (error: any) {
    console.error('Sync error:', error)
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 })
  }
}
