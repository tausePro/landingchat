import type { NubyProperty } from './types'

/**
 * Convierte una propiedad de Nuby al formato de la BD local
 */
export function mapNubyPropertyToLocal(
  nubyProperty: NubyProperty,
  organizationId: string,
  baseUrl: string
) {
  // Parsear coordenadas "lat:lng" a formato text "lat,lng"
  const coordinatesRaw = nubyProperty.coordenadas || ''
  const [lat, lng] = coordinatesRaw.split(':').map(parseFloat)
  const coordinatesText = lat && lng ? `${lat},${lng}` : null
  
  // Extraer características numéricas
  const bedrooms = nubyProperty.caracteristicas.find(f => f.descripcion.toLowerCase().includes('habitaciones'))?.valor
  const bathrooms = nubyProperty.caracteristicas.find(f => f.descripcion.toLowerCase().includes('baños'))?.valor
  const floor = nubyProperty.caracteristicas.find(f => f.descripcion.toLowerCase().includes('piso'))?.valor
  const age = nubyProperty.caracteristicas.find(f => f.descripcion.toLowerCase().includes('antigüedad'))?.valor
  const parking = nubyProperty.caracteristicas.find(f => f.descripcion.toLowerCase().includes('garaje') || f.descripcion.toLowerCase().includes('parqueadero'))?.valor

  const rawStatus = String(nubyProperty.estado ?? '').trim().toLowerCase()
  // Activo por defecto — solo marcar inactivo si explícitamente dice inactivo/0/false
  const isInactive = rawStatus === '0' || rawStatus === 'false' || rawStatus === 'inactivo' || rawStatus === 'inactive' || rawStatus === 'deshabilitado'

  return {
    organization_id: organizationId,
    external_id: nubyProperty.codigo,
    external_code: nubyProperty.codigo,
    external_url: `https://${nubyProperty.codigo}.arrendasoft.co`, // Ajustar según URL real
    
    title: nubyProperty.titulo,
    description: nubyProperty.observaciones || '',
    property_type: nubyProperty.tipo_servicio_id,
    property_class: nubyProperty.clase_inmueble,
    status: isInactive ? 'inactive' : 'active',
    
    price_rent: parseFloat(nubyProperty.valor_arriendo1) || null,
    price_sale: parseFloat(nubyProperty.valor_venta1) || null,
    price_admin: parseFloat(nubyProperty.valor_administracion) || null,
    
    country: nubyProperty.pais,
    department: nubyProperty.departamento,
    city: nubyProperty.municipio,
    neighborhood: nubyProperty.barrio,
    address: nubyProperty.direccion,
    coordinates: coordinatesText,
    
    bedrooms: bedrooms ? parseInt(bedrooms) : null,
    bathrooms: bathrooms ? parseInt(bathrooms) : null,
    area_m2: parseFloat(nubyProperty.area) || null,
    floor_number: floor ? parseInt(floor) : null,
    parking_spots: parking ? parseInt(parking) : null,
    age_years: age ? parseInt(age) : null,
    stratum: nubyProperty.estrato_texto,
    
    features: nubyProperty.caracteristicas.map(f => ({
      id: f.id,
      description: f.descripcion,
      type: f.tipo_campo,
      group: f.grupo,
      value: f.valor,
      valueText: f.valor_texto
    })),
    
    images: nubyProperty.imagenes.map(img => {
      const rawUrl = img.imagen || ''
      let normalizedUrl = rawUrl

      if (rawUrl && !rawUrl.startsWith('http')) {
        normalizedUrl = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`
        normalizedUrl = `${baseUrl}${normalizedUrl}`
      }

      return {
        position: parseInt(img.posicion),
        url: normalizedUrl,
        size: img.size
      }
    }),
    
    videos: nubyProperty.videos.map(v => ({
      position: parseInt(v.posicion),
      url: v.url,
      type: v.tipo,
      description: v.descripcion
    })),
    
    owners: nubyProperty.propietarios.map(o => ({
      id: o.id,
      document: o.documento,
      name: `${o.nombres} ${o.apellidos}`.trim()
    })),
    
    is_featured: nubyProperty.propiedad_destacada === 'Si',
    external_data: nubyProperty,
    synced_at: new Date().toISOString()
  }
}

/**
 * Filtra propiedades por criterios de búsqueda
 */
export function filterProperties(properties: any[], filters: {
  property_type?: string
  city?: string
  neighborhood?: string
  min_price?: number
  max_price?: number
  bedrooms?: number
  bathrooms?: number
  min_area?: number
}) {
  return properties.filter(property => {
    if (filters.property_type && !property.property_type.includes(filters.property_type)) {
      return false
    }
    
    if (filters.city && property.city?.toLowerCase() !== filters.city.toLowerCase()) {
      return false
    }
    
    if (filters.neighborhood && property.neighborhood?.toLowerCase() !== filters.neighborhood.toLowerCase()) {
      return false
    }
    
    const price = property.property_type === 'arriendo' ? property.price_rent : property.price_sale
    
    if (filters.min_price && (!price || price < filters.min_price)) {
      return false
    }
    
    if (filters.max_price && (!price || price > filters.max_price)) {
      return false
    }
    
    if (filters.bedrooms && property.bedrooms !== filters.bedrooms) {
      return false
    }
    
    if (filters.bathrooms && property.bathrooms !== filters.bathrooms) {
      return false
    }
    
    if (filters.min_area && (!property.area_m2 || property.area_m2 < filters.min_area)) {
      return false
    }
    
    return true
  })
}

/**
 * Formatea precio en COP
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price)
}

/**
 * Genera descripción corta de características
 */
export function formatPropertyFeatures(property: any): string {
  const parts: string[] = []
  
  if (property.bedrooms) parts.push(`${property.bedrooms} hab`)
  if (property.bathrooms) parts.push(`${property.bathrooms} baños`)
  if (property.area_m2) parts.push(`${property.area_m2} m²`)
  if (property.parking_spots) parts.push(`${property.parking_spots} parq`)
  
  return parts.join(' • ')
}
