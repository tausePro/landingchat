import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import Image from "next/image"

export default async function PropertiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div>No autorizado</div>
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .eq('organization_id', profile?.organization_id)
    .order('created_at', { ascending: false })

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const isValidImageUrl = (url?: string | null) =>
    Boolean(url && url.startsWith('http') && !url.includes('arrendasoft.coimg'))

  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Propiedades Sincronizadas ({properties?.length || 0})</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties?.map((property) => {
            const mainImage = property.images?.[0]?.url
            const price = property.price_sale || property.price_rent || 0
            const priceLabel = property.price_rent ? 'Arriendo' : 'Venta'
            
            return (
              <div key={property.id} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="aspect-video bg-gray-200 relative">
                  {isValidImageUrl(mainImage) ? (
                    <Image
                      src={mainImage}
                      alt={property.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      Sin imagen
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {property.property_type}
                  </span>
                  <h3 className="font-semibold mt-2 line-clamp-2">{property.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {property.neighborhood}, {property.city}
                  </p>
                  <p className="text-sm text-gray-500">
                    {property.bedrooms} hab • {property.bathrooms} baños • {property.area_m2} m²
                  </p>
                  <div className="mt-3">
                    <span className="text-xs text-gray-500">{priceLabel}</span>
                    <p className="text-lg font-bold text-blue-600">
                      {formatPrice(price)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {(!properties || properties.length === 0) && (
          <div className="text-center py-12 text-gray-500">
            No hay propiedades sincronizadas. Ve a Integraciones y sincroniza con Nuby.
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
