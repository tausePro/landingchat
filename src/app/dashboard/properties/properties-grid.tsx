"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { syncNubyProperties } from "@/lib/nuby/sync"
import { formatBogotaDateTime } from "@/lib/utils/date"

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
  organizationId: string
  hasNuby: boolean
  lastSyncAt: string | null
}

const isValidImageUrl = (url?: string | null) =>
  Boolean(url && url.startsWith("http") && !url.includes("arrendasoft.coimg"))

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0
  }).format(price)

export function PropertiesGrid({ properties, organizationId, hasNuby, lastSyncAt }: PropertiesGridProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleSync = () => {
    setSyncMessage(null)
    startTransition(async () => {
      try {
        const result = await syncNubyProperties(organizationId, 'full')
        if (result.success) {
          setSyncMessage(`Sincronización exitosa: ${result.itemsUpdated} propiedades actualizadas`)
        } else {
          setSyncMessage(`Error: ${result.errors[0] || 'Error desconocido'}`)
        }
        router.refresh()
      } catch (err: any) {
        setSyncMessage(`Error: ${err.message}`)
      }
    })
  }

  if (!isMounted) {
    return null
  }

  return (
    <>
    {/* Header */}
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold">Propiedades ({properties.length})</h1>
        {lastSyncAt && (
          <p className="text-sm text-muted-foreground mt-1">
            Última sincronización: {formatBogotaDateTime(lastSyncAt)}
          </p>
        )}
      </div>
      {hasNuby && (
        <button
          onClick={handleSync}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-base">sync</span>
              Actualizar desde Nuby
            </>
          )}
        </button>
      )}
    </div>
    {syncMessage && (
      <div className={`mb-4 p-3 rounded-lg text-sm ${syncMessage.startsWith('Error') ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400' : 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'}`}>
        {syncMessage}
      </div>
    )}
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
    </>
  )
}
