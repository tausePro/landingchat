"use server"

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { encrypt, decrypt } from '@/lib/utils/encryption'
import { syncNubyProperties, getLastSyncStatus } from '@/lib/nuby/sync'
import type { NubyCredentials } from '@/lib/nuby/types'

export interface IntegrationData {
  id: string
  provider: string
  status: string
  last_sync_at: string | null
  error_message: string | null
  config: any
}

/**
 * Obtiene todas las integraciones de la organización
 */
export async function getIntegrations(): Promise<IntegrationData[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) return []

  const { data, error } = await supabase
    .from('integrations')
    .select('id, provider, status, last_sync_at, error_message, config')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching integrations:', error)
    return []
  }

  return data as IntegrationData[]
}

/**
 * Conecta una integración con Nuby
 */
export async function connectNuby(credentials: {
  instance: string
  clientId: string
  secretKey: string
  token: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) throw new Error('No organization found')

  // Encriptar token
  const encryptedToken = encrypt(credentials.token)

  const integrationData = {
    organization_id: profile.organization_id,
    provider: 'nuby',
    status: 'connected',
    credentials: {
      instance: credentials.instance,
      clientId: credentials.clientId,
      secretKey: credentials.secretKey,
      token: encryptedToken
    },
    config: {},
    sync_enabled: true
  }

  // Verificar si ya existe
  const { data: existing } = await supabase
    .from('integrations')
    .select('id')
    .eq('organization_id', profile.organization_id)
    .eq('provider', 'nuby')
    .single()

  if (existing) {
    // Actualizar
    const { error } = await supabase
      .from('integrations')
      .update(integrationData)
      .eq('id', existing.id)

    if (error) throw new Error(`Failed to update integration: ${error.message}`)
  } else {
    // Crear
    const { error } = await supabase
      .from('integrations')
      .insert(integrationData)

    if (error) throw new Error(`Failed to create integration: ${error.message}`)
  }

  revalidatePath('/dashboard/integrations')
  return { success: true }
}

/**
 * Desconecta una integración
 */
export async function disconnectIntegration(integrationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) throw new Error('No organization found')

  const { error } = await supabase
    .from('integrations')
    .update({
      status: 'disconnected',
      sync_enabled: false
    })
    .eq('id', integrationId)
    .eq('organization_id', profile.organization_id)

  if (error) throw new Error(`Failed to disconnect integration: ${error.message}`)

  revalidatePath('/dashboard/integrations')
  return { success: true }
}

/**
 * Sincroniza propiedades desde Nuby
 * Rate limit: máximo 1 sync cada 15 minutos por organización
 */
const SYNC_COOLDOWN_MS = 15 * 60 * 1000 // 15 minutos

export async function syncProperties(syncType: 'full' | 'incremental' = 'incremental') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) throw new Error('No organization found')

  // Rate limit: verificar última sincronización
  const { data: integration } = await supabase
    .from('integrations')
    .select('last_sync_at')
    .eq('organization_id', profile.organization_id)
    .eq('provider', 'nuby')
    .single()

  if (integration?.last_sync_at) {
    const lastSync = new Date(integration.last_sync_at).getTime()
    const elapsed = Date.now() - lastSync
    if (elapsed < SYNC_COOLDOWN_MS) {
      const minutesLeft = Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 60000)
      return {
        success: false,
        itemsProcessed: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsFailed: 0,
        errors: [`Sincronización en espera. Puedes sincronizar de nuevo en ${minutesLeft} minuto(s).`]
      }
    }
  }

  const result = await syncNubyProperties(profile.organization_id, syncType)

  revalidatePath('/dashboard/integrations')
  return result
}

/**
 * Obtiene el estado de la última sincronización
 */
export async function getSyncStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) return null

  return getLastSyncStatus(profile.organization_id)
}

/**
 * Obtiene los logs de sincronización
 */
export async function getSyncLogs(limit: number = 10) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) return []

  const { data, error } = await supabase
    .from('integration_sync_logs')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching sync logs:', error)
    return []
  }

  return data
}
