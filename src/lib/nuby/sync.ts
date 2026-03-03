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

    // 2. Obtener credenciales (intentar desencriptar token, si falla usar directo)
    let token = integration.credentials.token || ''
    try {
      // Si el token parece encriptado (formato hex:hex:hex), desencriptar
      if (token.includes(':') && token.split(':').length === 3) {
        token = decrypt(token)
      }
    } catch (e) {
      console.warn('No se pudo desencriptar token, usando valor directo')
      token = integration.credentials.token || ''
    }

    const credentials: NubyCredentials = {
      instance: integration.credentials.instance,
      clientId: integration.credentials.clientId,
      secretKey: integration.credentials.secretKey,
      token
    }

    console.log('Nuby sync credentials:', {
      instance: credentials.instance,
      clientId: credentials.clientId ? '***' : 'EMPTY',
      secretKey: credentials.secretKey ? '***' : 'EMPTY',
      token: token ? `${token.substring(0, 10)}...` : 'EMPTY',
      tokenLength: token.length
    })

    // 3. Crear cliente de Nuby
    const nubyClient = new NubyClient(credentials)
    const baseUrl = `https://${credentials.instance}.arrendasoft.co`

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
    console.log('Iniciando obtención de propiedades desde Nuby...')
    let nubyProperties
    
    try {
      if (syncType === 'full') {
        console.log('Sincronización full...')
        nubyProperties = await nubyClient.syncAllProperties()
      } else {
        // Sincronización incremental: solo propiedades actualizadas en las últimas 24h
        console.log('Sincronización incremental...')
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        nubyProperties = await nubyClient.getUpdatedPropertiesSince(yesterday)
      }
      
      console.log(`Propiedades obtenidas: ${nubyProperties.length}`)
      result.itemsProcessed = nubyProperties.length
    } catch (fetchError: any) {
      console.error('Error al obtener propiedades de Nuby:', fetchError)
      throw new Error(`Error al conectar con Nuby: ${fetchError.message}`)
    }

    // 5.1 Filtrar: solo propiedades para arriendo o venta
    const ALLOWED_TYPES = ['arriendo', 'venta', 'arriendo y venta']
    const filteredProperties = nubyProperties.filter((p: any) => {
      const tipo = (p.tipo_servicio || '').toLowerCase().trim()
      return ALLOWED_TYPES.some(t => tipo.includes(t))
    })
    console.log(`Propiedades filtradas (solo arriendo/venta): ${filteredProperties.length} de ${nubyProperties.length}`)

    // 5.2 Separar: arrendadas/vendidas (estado 0 o 3) → eliminar de LandingChat
    const toDelete = filteredProperties.filter((p: any) => {
      const estado = String(p.estado ?? '').trim()
      return estado === '0' || estado === '3' // 0=Arrendada, 3=Vendida
    })
    const toSync = filteredProperties.filter((p: any) => {
      const estado = String(p.estado ?? '').trim()
      return estado !== '0' && estado !== '3'
    })
    console.log(`Para sincronizar: ${toSync.length} | Para eliminar (arrendadas/vendidas): ${toDelete.length}`)

    // 5.3 Eliminar propiedades arrendadas/vendidas de la BD
    if (toDelete.length > 0) {
      const codesToDelete = toDelete.map((p: any) => p.codigo)
      const { data: deleted, error: deleteError } = await supabase
        .from('properties')
        .delete()
        .eq('organization_id', organizationId)
        .in('external_id', codesToDelete)
        .select('id')

      if (deleteError) {
        console.error('Error eliminando propiedades arrendadas/vendidas:', deleteError.message)
        result.errors.push(`Error eliminando arrendadas/vendidas: ${deleteError.message}`)
      } else {
        console.log(`Eliminadas ${deleted?.length || 0} propiedades arrendadas/vendidas`)
      }
    }

    // 6. Procesar propiedades activas en chunks pequeños
    const CHUNK_SIZE = 50
    const CHUNK_DELAY_MS = 500

    const mappedProperties = toSync.map((nubyProperty: any) =>
      mapNubyPropertyToLocal(nubyProperty, organizationId, baseUrl)
    )

    if (mappedProperties.length > 0) {
      const totalChunks = Math.ceil(mappedProperties.length / CHUNK_SIZE)
      console.log(`Procesando ${mappedProperties.length} propiedades en ${totalChunks} chunks de ${CHUNK_SIZE}`)

      for (let i = 0; i < mappedProperties.length; i += CHUNK_SIZE) {
        const chunk = mappedProperties.slice(i, i + CHUNK_SIZE)
        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1

        const { data: upserted, error: upsertError } = await supabase
          .from('properties')
          .upsert(chunk, {
            onConflict: 'organization_id,external_id',
            ignoreDuplicates: false
          })
          .select('id')

        if (upsertError) {
          result.itemsFailed += chunk.length
          result.errors.push(`Chunk ${chunkIndex}/${totalChunks} error: ${upsertError.message}`)
          console.error(`Chunk ${chunkIndex}/${totalChunks} failed:`, upsertError.message)
        } else {
          result.itemsUpdated += upserted?.length || chunk.length
          console.log(`Chunk ${chunkIndex}/${totalChunks} OK: ${upserted?.length || chunk.length} propiedades`)
        }

        // Delay entre chunks para no saturar la BD (noisy neighbor prevention)
        if (i + CHUNK_SIZE < mappedProperties.length) {
          await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS))
        }
      }
    }

    // 7. Eliminar propiedades que ya no existen en Nuby (solo en sync full)
    if (syncType === 'full' && mappedProperties.length > 0) {
      const syncedExternalIds = mappedProperties.map((p: any) => p.external_id)
      const { data: removed, error: removeError } = await supabase
        .from('properties')
        .delete()
        .eq('organization_id', organizationId)
        .not('external_id', 'in', `(${syncedExternalIds.join(',')})`)
        .select('id')

      if (removeError) {
        console.error('Cleanup error:', removeError.message)
        result.errors.push(`Cleanup error: ${removeError.message}`)
      } else if (removed && removed.length > 0) {
        console.log(`Cleanup: ${removed.length} propiedades eliminadas (ya no existen en Nuby)`)
      }
    }

    // 8. Actualizar integración
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
    const errorMessage = error.message || 'Error desconocido'
    const errorDetails = {
      message: errorMessage,
      stack: error.stack,
      cause: error.cause?.message
    }
    
    result.errors.push(errorMessage)
    
    console.error('Nuby sync error:', errorDetails)
    
    // Actualizar integración con error
    await supabase
      .from('integrations')
      .update({
        status: 'error',
        error_message: errorMessage
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
