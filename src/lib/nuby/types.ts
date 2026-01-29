// Tipos para la API de Nuby (Arrendasoft)

export interface NubyCredentials {
  instance: string // ej: "casainmobiliariajuridica"
  clientId: string
  secretKey: string
  token: string
}

export interface NubyProperty {
  codigo: string
  titulo: string
  clase_id: string
  clase_inmueble: string
  tipo_servicio_id: string
  tipo_servicio: string
  estrato: string
  estrato_texto: string
  fecha_consignacion: string
  asesor_id: string
  asesor: string
  pais_id: string
  pais: string
  departamento_id: string
  departamento: string
  municipio_id: string
  municipio: string
  barrio_id: string
  barrio: string
  direccion: string
  coordenadas: string // "lat:lng"
  valor_arriendo1: string
  valor_arriendo2: string
  valor_venta1: string
  valor_venta2: string
  valor_administracion: string
  avaluo_catastral: string
  impuesto_predial: string
  area: string
  observaciones: string | null
  propiedad_destacada: string
  llaves_en: string
  llaves_otro: string | null
  paga_cuota_sost: string | null
  folio_matricula: string | null
  referencia_catastral: string | null
  edificio_unidad: string
  estado: string
  estado_texto: string
  cantidad_images: string
  cantidad_videos: string
  caracteristicas: NubyFeature[]
  propietarios: NubyOwner[]
  imagenes: NubyImage[]
  videos: NubyVideo[]
}

export interface NubyFeature {
  id: string
  descripcion: string
  tipo_campo: 'numeric' | 'checkbox' | 'select' | 'text'
  orden: string
  grupo: string
  valor: string
  valor_texto?: string
}

export interface NubyOwner {
  id: string
  documento: string
  nombres: string
  apellidos: string
}

export interface NubyImage {
  posicion: string
  size: string
  imagen: string // URL
}

export interface NubyVideo {
  url: string // YouTube ID
  tipo: 'youtube'
  descripcion: string | null
  posicion: string
}

export interface NubyListPropertiesParams {
  page?: number
  limit?: number
  listing_start_date?: string // YYYY-MM-DD
  listing_end_date?: string
  created_start_date?: string
  created_end_date?: string
  updated_start_date?: string
  updated_end_date?: string
}

export interface NubyApiError {
  message: string
  code?: string
  details?: any
}
