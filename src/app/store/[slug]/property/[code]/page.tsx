import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export default async function PropertyDetailPage({ 
  params 
}: { 
  params: Promise<{ slug: string; code: string }> 
}) {
  const { slug, code } = await params
  const supabase = await createClient()

  // Obtener organización
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_url, settings, primary_color")
    .eq("slug", slug)
    .single()

  if (!org) return notFound()

  // Obtener propiedad
  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("organization_id", org.id)
    .eq("external_code", code)
    .single()

  if (!property) return notFound()

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const price = property.price_sale || property.price_rent || 0
  const priceLabel = property.price_rent ? 'Arriendo' : 'Venta'
  const images = property.images || []
  const features = property.features || []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/store/${slug}`} className="flex items-center gap-2">
            {org.logo_url && (
              <Image src={org.logo_url} alt={org.name} width={40} height={40} className="rounded" />
            )}
            <span className="font-semibold">{org.name}</span>
          </Link>
          <Link href={`/chat/${slug}?property=${code}`}>
            <Button>Consultar esta propiedad</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Galería de imágenes */}
          <div className="lg:col-span-2">
            {images.length > 0 ? (
              <div className="space-y-4">
                {/* Imagen principal */}
                <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-200">
                  <Image
                    src={images[0]?.url}
                    alt={property.title}
                    fill
                    className="object-cover"
                  />
                </div>
                {/* Miniaturas */}
                {images.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {images.slice(1, 5).map((img: any, idx: number) => (
                      <div key={idx} className="relative aspect-video rounded overflow-hidden bg-gray-200">
                        <Image
                          src={img.url}
                          alt={`${property.title} - ${idx + 2}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                    {images.length > 5 && (
                      <div className="relative aspect-video rounded overflow-hidden bg-gray-800 flex items-center justify-center text-white">
                        +{images.length - 5} fotos
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center text-gray-400">
                Sin imágenes
              </div>
            )}

            {/* Descripción */}
            <Card className="mt-6">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">Observaciones</h2>
                <p className="text-gray-700 whitespace-pre-line">
                  {property.description || 'Sin descripción disponible'}
                </p>
              </CardContent>
            </Card>

            {/* Características */}
            {features.length > 0 && (
              <Card className="mt-6">
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Comodidades del inmueble</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {features.map((feature: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <span className="text-sm">
                          {feature.descripcion}: {feature.valor}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar con info */}
          <div className="space-y-6">
            {/* Info del asesor */}
            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-20 h-20 mx-auto bg-gray-200 rounded-full flex items-center justify-center mb-4">
                  <span className="text-4xl text-gray-400">👤</span>
                </div>
                <h3 className="font-semibold">Asesor: {org.name}</h3>
                {org.settings?.contact?.phone && (
                  <p className="text-sm text-gray-600 mt-2">
                    📞 {org.settings.contact.phone}
                  </p>
                )}
                {org.settings?.contact?.email && (
                  <p className="text-sm text-gray-600">
                    ✉️ {org.settings.contact.email}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Detalles de la propiedad */}
            <Card>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Código:</span>
                    <span className="font-semibold">{property.external_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Área:</span>
                    <span className="font-semibold">{property.area_m2} M²</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tipo:</span>
                    <span className="font-semibold">{property.property_class}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Servicio:</span>
                    <span className="font-semibold">{priceLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Valor {priceLabel}:</span>
                    <span className="font-semibold text-blue-600">{formatPrice(price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Departamento:</span>
                    <span className="font-semibold">{property.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Municipio:</span>
                    <span className="font-semibold">{property.city}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Barrio:</span>
                    <span className="font-semibold">{property.neighborhood}</span>
                  </div>
                  {property.stratum && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Estrato:</span>
                      <span className="font-semibold">{property.stratum}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Características rápidas */}
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  {property.bedrooms && (
                    <div>
                      <p className="text-2xl font-bold">{property.bedrooms}</p>
                      <p className="text-xs text-gray-500">Habitaciones</p>
                    </div>
                  )}
                  {property.bathrooms && (
                    <div>
                      <p className="text-2xl font-bold">{property.bathrooms}</p>
                      <p className="text-xs text-gray-500">Baños</p>
                    </div>
                  )}
                  {property.parking_spots && (
                    <div>
                      <p className="text-2xl font-bold">{property.parking_spots}</p>
                      <p className="text-xs text-gray-500">Parqueaderos</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <Link href={`/chat/${slug}?property=${code}`} className="block">
              <Button className="w-full" size="lg">
                💬 Chatear sobre esta propiedad
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
