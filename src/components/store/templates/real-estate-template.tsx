"use client"

import { useState, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Property {
  id: string
  external_code: string
  title: string
  description: string
  property_type: string
  price_rent: number | null
  price_sale: number | null
  city: string
  neighborhood: string
  address: string
  bedrooms: number | null
  bathrooms: number | null
  area_m2: number | null
  parking_spots: number | null
  images: Array<{ url: string; position: number }>
  is_featured: boolean
}

interface RealEstateTemplateProps {
  organization: any
  properties: Property[]
}

export function RealEstateTemplate({ organization, properties }: RealEstateTemplateProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [propertyType, setPropertyType] = useState<string>("all")
  const [city, setCity] = useState<string>("all")
  const [minPrice, setMinPrice] = useState<string>("")
  const [maxPrice, setMaxPrice] = useState<string>("")

  const cities = useMemo(() => {
    const uniqueCities = [...new Set(properties.map(p => p.city).filter(Boolean))]
    return uniqueCities.sort()
  }, [properties])

  const propertyTypes = useMemo(() => {
    const uniqueTypes = [...new Set(properties.map(p => p.property_type).filter(Boolean))]
    return uniqueTypes
  }, [properties])

  const filteredProperties = useMemo(() => {
    return properties.filter(property => {
      const matchesSearch = !searchTerm || 
        property.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.neighborhood?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.address?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesType = propertyType === "all" || property.property_type === propertyType
      const matchesCity = city === "all" || property.city === city

      const price = property.price_rent || property.price_sale || 0
      const matchesMinPrice = !minPrice || price >= parseFloat(minPrice)
      const matchesMaxPrice = !maxPrice || price <= parseFloat(maxPrice)

      return matchesSearch && matchesType && matchesCity && matchesMinPrice && matchesMaxPrice
    })
  }, [properties, searchTerm, propertyType, city, minPrice, maxPrice])

  const featuredProperties = filteredProperties.filter(p => p.is_featured)
  const regularProperties = filteredProperties.filter(p => !p.is_featured)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price)
  }

  const formatFeatures = (property: Property) => {
    const features = []
    if (property.bedrooms) features.push(`${property.bedrooms} hab`)
    if (property.bathrooms) features.push(`${property.bathrooms} baños`)
    if (property.area_m2) features.push(`${property.area_m2} m²`)
    if (property.parking_spots) features.push(`${property.parking_spots} parq`)
    return features.join(' • ')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {organization.name}
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-8">
              Encuentra tu propiedad ideal
            </p>
            
            {/* Quick Search */}
            <div className="bg-white rounded-lg shadow-xl p-4 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input
                  placeholder="Buscar por ubicación..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="md:col-span-2"
                />
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {propertyTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ciudad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {cities.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap gap-4 items-center">
            <span className="text-sm font-medium text-gray-700">Filtrar por precio:</span>
            <Input
              type="number"
              placeholder="Mínimo"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-32"
            />
            <span className="text-gray-500">-</span>
            <Input
              type="number"
              placeholder="Máximo"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-32"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("")
                setPropertyType("all")
                setCity("all")
                setMinPrice("")
                setMaxPrice("")
              }}
            >
              Limpiar filtros
            </Button>
            <span className="ml-auto text-sm text-gray-600">
              {filteredProperties.length} propiedades encontradas
            </span>
          </div>
        </div>
      </div>

      {/* Featured Properties */}
      {featuredProperties.length > 0 && (
        <div className="container mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold mb-6">Propiedades Destacadas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProperties.map(property => (
              <PropertyCard
                key={property.id}
                property={property}
                formatPrice={formatPrice}
                formatFeatures={formatFeatures}
                organizationSlug={organization.slug}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Properties */}
      <div className="container mx-auto px-4 py-12">
        {featuredProperties.length > 0 && (
          <h2 className="text-2xl font-bold mb-6">Todas las Propiedades</h2>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {regularProperties.map(property => (
            <PropertyCard
              key={property.id}
              property={property}
              formatPrice={formatPrice}
              formatFeatures={formatFeatures}
              organizationSlug={organization.slug}
            />
          ))}
        </div>

        {filteredProperties.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No se encontraron propiedades con los filtros seleccionados</p>
          </div>
        )}
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 text-white">
        <div className="container mx-auto px-4 py-12 text-center">
          <h2 className="text-3xl font-bold mb-4">¿Necesitas ayuda?</h2>
          <p className="text-xl text-blue-100 mb-8">
            Chatea con nuestro asistente virtual para encontrar tu propiedad ideal
          </p>
          <Button size="lg" variant="secondary">
            Iniciar Chat
          </Button>
        </div>
      </div>
    </div>
  )
}

function PropertyCard({ 
  property, 
  formatPrice, 
  formatFeatures,
  organizationSlug 
}: { 
  property: Property
  formatPrice: (price: number) => string
  formatFeatures: (property: Property) => string
  organizationSlug: string
}) {
  const mainImage = property.images.find(img => img.position === 1) || property.images[0]
  const price = property.price_rent || property.price_sale || 0
  const priceLabel = property.price_rent ? 'Arriendo' : 'Venta'

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative aspect-[4/3] bg-gray-200">
        {mainImage ? (
          <Image
            src={mainImage.url}
            alt={property.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            Sin imagen
          </div>
        )}
        {property.is_featured && (
          <Badge className="absolute top-3 right-3 bg-yellow-500">
            Destacada
          </Badge>
        )}
      </div>
      <CardContent className="p-4">
        <div className="mb-2">
          <Badge variant="outline" className="text-xs">
            {property.property_type}
          </Badge>
        </div>
        <h3 className="font-semibold text-lg mb-2 line-clamp-2">
          {property.title}
        </h3>
        <p className="text-sm text-gray-600 mb-2">
          {property.neighborhood}, {property.city}
        </p>
        <p className="text-sm text-gray-500 mb-3">
          {formatFeatures(property)}
        </p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">{priceLabel}</p>
            <p className="text-xl font-bold text-blue-600">
              {formatPrice(price)}
            </p>
          </div>
          <Link href={`/chat/${organizationSlug}?property=${property.external_code}`}>
            <Button size="sm">
              Ver más
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
