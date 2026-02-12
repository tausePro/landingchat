"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

interface Property {
  id: string
  title: string
  property_type: string
  neighborhood?: string | null
  city?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  area_m2?: number | null
  price_sale?: number | null
  price_rent?: number | null
  images?: Array<{ url?: string | null }>
}

interface PropertiesGridProps {
  properties: Property[]
}

const isValidImageUrl = (url?: string | null) =>
  Boolean(url && url.startsWith("http") && !url.includes("arrendasoft.coimg"))

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0
  }).format(price)

export function PropertiesGrid({ properties }: PropertiesGridProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {properties.map((property) => {
        const mainImage = property.images?.[0]?.url || null
        const price = property.price_sale || property.price_rent || 0
        const priceLabel = property.price_rent ? "Arriendo" : "Venta"

        return (
          <div key={property.id} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="aspect-video bg-gray-200 relative">
              {isValidImageUrl(mainImage) ? (
                <Image
                  src={mainImage!}
                  alt={property.title}
                  fill
                  className="object-cover"
                  unoptimized
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
  )
}
