"use server"

import { createServiceClient } from '@/lib/supabase/server'
import { NubyClient } from './client'
import { mapNubyPropertyToLocal } from './mapper'
import { decrypt } from '@/lib/utils/encryption'
import type { NubyCredentials } from './types'

export interface SyncResult {
  success: boolean
  itemsProcessed: number
  itemsCreated: number
  itemsUpdated: number
  itemsFailed: number
  errors: string[]
}

/**
 * Sincroniza propiedades desde Nuby a la base de datos local
 */
export async function syncNubyProperties(
  organizationId: string,
  syncType: 'full' | 'incremental' = 'incremental'
): Promise<SyncResult> {
  const supabase = createServiceClient()
  
  const result: SyncResult = {
    success: false,
    itemsProcessed: 0,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsFailed: 0,
    errors: []
  }

  try {
    // 1. Obtener credenciales de Nuby
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('provider', 'nuby')
      .single()

    if (integrationError || !integration) {
      throw new Error('Integración con Nuby no encontrada')
    }

    if (integration.status !== 'connected') {
      throw new Error('Integración con Nuby no está conectada')
    }

    // 2. Desencriptar credenciales
    const credentials: NubyCredentials = {
      instance: integration.credentials.instance,
      clientId: integration.credentials.clientId,
      secretKey: integration.credentials.secretKey,
      token: decrypt(integration.credentials.token)
    }

    // 3. Crear cliente de Nuby
    const nubyClient = new NubyClient(credentials)

    // 4. Crear log de sincronización
    const { data: syncLog, error: logError } = await supabase
      .from('integration_sync_logs')
      .insert({
        integration_id: integration.id,
        organization_id: organizationId,
        sync_type: syncType,
        status: 'started'
      })
      .select()
      .single()

    if (logError) {
      console.error('Error creating sync log:', logError)
    }

    // 5. Obtener propiedades desde Nuby
    let nubyProperties
    
    if (syncType === 'full') {
      nubyProperties = await nubyClient.syncAllProperties()
    } else {
      // Sincronización incremental: solo propiedades actualizadas en las últimas 24h
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      nubyProperties = await nubyClient.getUpdatedPropertiesSince(yesterday)
    }

    result.itemsProcessed = nubyProperties.length

    // 6. Procesar cada propiedad
    for (const nubyProperty of nubyProperties) {
      try {
        const localProperty = mapNubyPropertyToLocal(nubyProperty, organizationId)

        // Verificar si ya existe
        const { data: existing } = await supabase
          .from('properties')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('external_id', localProperty.external_id)
          .single()

        if (existing) {
          // Actualizar
          const { error: updateError } = await supabase
            .from('properties')
            .update(localProperty)
            .eq('id', existing.id)

          if (updateError) {
            result.itemsFailed++
            result.errors.push(`Error updating ${localProperty.external_code}: ${updateError.message}`)
          } else {
            result.itemsUpdated++
          }
        } else {
          // Crear
          const { error: insertError } = await supabase
            .from('properties')
            .insert(localProperty)

          if (insertError) {
            result.itemsFailed++
            result.errors.push(`Error creating ${localProperty.external_code}: ${insertError.message}`)
          } else {
            result.itemsCreated++
          }
        }
      } catch (error: any) {
        result.itemsFailed++
        result.errors.push(`Error processing property: ${error.message}`)
      }
    }

    // 7. Actualizar integración
    await supabase
      .from('integrations')
      .update({
        last_sync_at: new Date().toISOString(),
        status: result.itemsFailed === 0 ? 'connected' : 'error',
        error_message: result.errors.length > 0 ? result.errors[0] : null
      })
      .eq('id', integration.id)

    // 8. Actualizar log de sincronización
    if (syncLog) {
      await supabase
        .from('integration_sync_logs')
        .update({
          status: result.itemsFailed === 0 ? 'success' : 'error',
          items_processed: result.itemsProcessed,
          items_created: result.itemsCreated,
          items_updated: result.itemsUpdated,
          items_failed: result.itemsFailed,
          error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
          error_details: result.errors.length > 0 ? { errors: result.errors } : null,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLog.id)
    }

    result.success = result.itemsFailed === 0

    return result

  } catch (error: any) {
    result.errors.push(error.message)
    
    // Actualizar integración con error
    await supabase
      .from('integrations')
      .update({
        status: 'error',
        error_message: error.message
      })
      .eq('organization_id', organizationId)
      .eq('provider', 'nuby')

    return result
  }
}

/**
 * Obtiene el estado de la última sincronización
 */
export async function getLastSyncStatus(organizationId: string) {
  const supabase = createServiceClient()

  const { data: integration } = await supabase
    .from('integrations')
    .select('last_sync_at, status, error_message')
    .eq('organization_id', organizationId)
    .eq('provider', 'nuby')
    .single()

  const { data: lastLog } = await supabase
    .from('integration_sync_logs')
    .select('*')
    .eq('organization_id', organizationId)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  return {
    integration,
    lastLog
  }
}
