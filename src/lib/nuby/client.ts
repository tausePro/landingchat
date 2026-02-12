import https from 'https'
import type { NubyCredentials, NubyProperty, NubyListPropertiesParams, NubyApiError } from './types'

// Función para hacer request con https nativo (evita 400 de Next.js fetch)
function httpsRequest(url: string, token: string, method: string = 'GET', body?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const normalizedToken = token.trim()
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Authorization': `Bearer ${normalizedToken}`,
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body).toString() } : {})
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          console.error('Nuby API error response:', {
            status: res.statusCode,
            url,
            body: data.substring(0, 500)
          })
          reject({ message: `Nuby API error: ${res.statusCode}`, code: String(res.statusCode), body: data })
          return
        }
        try {
          const sanitized = data
            .replace(/^\uFEFF/, '')
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
          resolve(JSON.parse(sanitized))
        } catch (e) {
          reject(new Error(`Invalid JSON: ${data.substring(0, 200)}`))
        }
      })
    })

    req.on('error', (e) => reject(e))
    if (body) req.write(body)
    req.end()
  })
}

// Login en Nuby para obtener token JWT fresco
function nubyLogin(baseUrl: string, username: string, password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `${baseUrl}/auth/login`
    const urlObj = new URL(url)
    const body = JSON.stringify({ username, password })
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body).toString()
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (parsed.token) {
            resolve(parsed.token)
          } else {
            reject(new Error(`Login fallido: ${data.substring(0, 200)}`))
          }
        } catch (e) {
          reject(new Error(`Login response inválido: ${data.substring(0, 200)}`))
        }
      })
    })

    req.on('error', (e) => reject(e))
    req.write(body)
    req.end()
  })
}

export class NubyClient {
  private baseUrl: string
  private credentials: NubyCredentials
  private currentToken: string | null = null

  constructor(credentials: NubyCredentials) {
    this.credentials = credentials
    // Limpiar instancia: quitar protocolo, dominio y espacios si el usuario los incluyó
    let instance = credentials.instance.trim().toLowerCase()
    instance = instance.replace(/^https?:\/\//, '')
    instance = instance.replace(/\.arrendasoft\.co.*$/, '')
    this.baseUrl = `https://${instance}.arrendasoft.co/service/v2/public`
  }

  /**
   * Obtiene un token válido para la API de Nuby.
   * Primero intenta usar el token de API directo (permanente).
   * Si no hay token, intenta login con username/password.
   */
  private async ensureToken(): Promise<string> {
    if (this.currentToken) return this.currentToken

    // Si hay un token de API directo, usarlo
    if (this.credentials.token) {
      console.log('Nuby: usando token de API directo')
      this.currentToken = this.credentials.token
      return this.currentToken
    }

    // Fallback: intentar login con clientId/secretKey como username/password
    console.log('Nuby: intentando login con credenciales...')
    try {
      this.currentToken = await nubyLogin(
        this.baseUrl,
        this.credentials.clientId,
        this.credentials.secretKey
      )
      console.log('Nuby: token obtenido via login')
      return this.currentToken
    } catch (error: any) {
      throw new Error(`No se pudo autenticar con Nuby: ${error.message}`)
    }
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
      const token = await this.ensureToken()
      console.log('Nuby API request:', url)
      return await httpsRequest(url, token)
    } catch (error: any) {
      throw new Error(`Error conectando con Nuby API (${url}): ${error.message}`)
    }
  }

  /**
   * Obtiene una propiedad específica por su código
   */
  async getPropertyByCode(code: string): Promise<NubyProperty> {
    const url = `${this.baseUrl}/properties/${code}`
    const token = await this.ensureToken()
    return httpsRequest(url, token)
  }

  /**
   * Sincroniza todas las propiedades activas
   * Útil para sincronización inicial o completa
   */
  async syncAllProperties(): Promise<NubyProperty[]> {
    const allProperties: NubyProperty[] = []
    let page = 1
    const limit = 50 // Máximo recomendado
    const maxPages = 2

    while (true) {
      const properties = await this.listProperties({ page, limit })
      
      if (properties.length === 0) break
      
      allProperties.push(...properties)
      
      if (properties.length < limit) break // Última página
      
      page++
      if (page > maxPages) break
    }

    return allProperties
  }

  /**
   * Obtiene propiedades actualizadas (sin filtro de fecha por compatibilidad con API Nuby)
   * La API de Nuby devuelve 400 con parámetros de fecha, así que traemos todas
   */
  async getUpdatedPropertiesSince(_date: Date): Promise<NubyProperty[]> {
    const allProperties: NubyProperty[] = []
    const seenCodes = new Set<string>()
    let page = 1
    const limit = 50
    const maxPages = 2

    while (true) {
      let properties: NubyProperty[] = []

      try {
        properties = await this.listProperties({ page, limit })
      } catch (error: any) {
        if (error.message?.includes('Invalid JSON')) {
          console.warn(`Nuby: JSON inválido en página ${page}, reintentando con limit=10`)
          properties = await this.listProperties({ page, limit: 10 })
        } else {
          throw error
        }
      }

      if (properties.length === 0) break

      for (const property of properties) {
        if (!seenCodes.has(property.codigo)) {
          seenCodes.add(property.codigo)
          allProperties.push(property)
        }
      }

      if (properties.length < limit) break

      page++
      if (page > maxPages) break
    }

    return allProperties
  }
}

/**
 * Factory function para crear cliente de Nuby desde credenciales encriptadas
 */
export function createNubyClient(credentials: NubyCredentials): NubyClient {
  return new NubyClient(credentials)
}
