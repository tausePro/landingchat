import type { NubyCredentials, NubyProperty, NubyListPropertiesParams, NubyApiError } from './types'

export class NubyClient {
  private baseUrl: string
  private credentials: NubyCredentials

  constructor(credentials: NubyCredentials) {
    this.credentials = credentials
    this.baseUrl = `https://${credentials.instance}.arrendasoft.co/service/v2/public`
  }

  private getHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.credentials.token}`,
      'Content-Type': 'application/json',
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: NubyApiError = {
        message: `Nuby API error: ${response.status} ${response.statusText}`,
        code: response.status.toString(),
      }

      try {
        const errorData = await response.json()
        error.details = errorData
      } catch {
        // Ignore JSON parse errors
      }

      throw error
    }

    return response.json()
  }

  /**
   * Lista todas las propiedades con paginación y filtros
   */
  async listProperties(params?: NubyListPropertiesParams): Promise<NubyProperty[]> {
    const searchParams = new URLSearchParams()

    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.listing_start_date) searchParams.append('listing_start_date', params.listing_start_date)
    if (params?.listing_end_date) searchParams.append('listing_end_date', params.listing_end_date)
    if (params?.created_start_date) searchParams.append('created_start_date', params.created_start_date)
    if (params?.created_end_date) searchParams.append('created_end_date', params.created_end_date)
    if (params?.updated_start_date) searchParams.append('updated_start_date', params.updated_start_date)
    if (params?.updated_end_date) searchParams.append('updated_end_date', params.updated_end_date)

    const url = `${this.baseUrl}/properties${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        cache: 'no-store',
        next: { revalidate: 0 }
      })

      return this.handleResponse<NubyProperty[]>(response)
    } catch (error: any) {
      throw new Error(`Error conectando con Nuby API (${url}): ${error.message}`)
    }
  }

  /**
   * Obtiene una propiedad específica por su código
   */
  async getPropertyByCode(code: string): Promise<NubyProperty> {
    const url = `${this.baseUrl}/properties/${code}`

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    })

    return this.handleResponse<NubyProperty>(response)
  }

  /**
   * Sincroniza todas las propiedades activas
   * Útil para sincronización inicial o completa
   */
  async syncAllProperties(): Promise<NubyProperty[]> {
    const allProperties: NubyProperty[] = []
    let page = 1
    const limit = 50 // Máximo recomendado

    while (true) {
      const properties = await this.listProperties({ page, limit })
      
      if (properties.length === 0) break
      
      allProperties.push(...properties)
      
      if (properties.length < limit) break // Última página
      
      page++
    }

    return allProperties
  }

  /**
   * Obtiene propiedades actualizadas desde una fecha específica
   * Útil para sincronización incremental
   */
  async getUpdatedPropertiesSince(date: Date): Promise<NubyProperty[]> {
    const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
    
    return this.listProperties({
      updated_start_date: dateStr,
      limit: 100
    })
  }
}

/**
 * Factory function para crear cliente de Nuby desde credenciales encriptadas
 */
export function createNubyClient(credentials: NubyCredentials): NubyClient {
  return new NubyClient(credentials)
}
