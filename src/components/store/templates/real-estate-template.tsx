"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import Image from "next/image"
import { PropertyImage } from "@/components/store/PropertyImage"
import Link from "next/link"

// ─── Types ───────────────────────────────────────────────────────────
interface Property {
  id: string
  external_code: string
  title: string
  description: string
  property_type: string
  property_class: string
  price_rent: number | null
  price_sale: number | null
  price_admin: number | null
  city: string
  neighborhood: string
  address: string
  bedrooms: number | null
  bathrooms: number | null
  area_m2: number | null
  parking_spots: number | null
  stratum: string | null
  images: Array<{ url: string; position: number }>
  is_featured: boolean
}

interface RealEstateTemplateProps {
  organization: any
  properties: Property[]
  onStartChat?: (productId?: string) => void
}

// ─── Constants ───────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 24
const BEDROOM_OPTIONS = [1, 2, 3, 4, "5+"] as const

// ─── Helpers ─────────────────────────────────────────────────────────
const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price)

const formatPriceShort = (price: number) => {
  if (price >= 1_000_000_000) return `$${(price / 1_000_000_000).toFixed(price % 1_000_000_000 === 0 ? 0 : 1)}B`
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(price % 1_000_000 === 0 ? 0 : 1)}M`
  return formatPrice(price)
}

const isValidImageUrl = (url?: string | null) =>
  Boolean(url && url.startsWith("http") && !url.includes("arrendasoft.coimg"))

const shouldBypassOptimization = (url?: string | null) =>
  Boolean(url && url.includes("arrendasoft.co"))

// ─── Main Component ──────────────────────────────────────────────────
export function RealEstateTemplate({ organization, properties, onStartChat }: RealEstateTemplateProps) {
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => { setIsMounted(true) }, [])

  // Hero search bar filters
  const [heroService, setHeroService] = useState("")
  const [heroCode, setHeroCode] = useState("")
  const [heroClass, setHeroClass] = useState("")
  const [heroCity, setHeroCity] = useState("")
  const [heroNeighborhood, setHeroNeighborhood] = useState("")
  const [heroPriceMin, setHeroPriceMin] = useState("")
  const [heroPriceMax, setHeroPriceMax] = useState("")

  // Sidebar filters
  const [offerType, setOfferType] = useState<"all" | "arriendo" | "venta">("all")
  const [selectedBedrooms, setSelectedBedrooms] = useState<string>("")
  const [sortBy, setSortBy] = useState("recent")
  const [currentPage, setCurrentPage] = useState(1)

  // Applied filters (from hero search)
  const [appliedFilters, setAppliedFilters] = useState({
    service: "", code: "", propertyClass: "", city: "", neighborhood: "", priceMin: "", priceMax: ""
  })

  // ─── Derived options ─────────────────────────────────────────────
  const cities = useMemo(() => [...new Set(properties.map(p => p.city).filter(Boolean))].sort(), [properties])
  const propertyClasses = useMemo(() => [...new Set(properties.map(p => p.property_class).filter(Boolean))].sort(), [properties])

  const neighborhoods = useMemo(() => {
    const c = heroCity || appliedFilters.city
    const filtered = c ? properties.filter(p => p.city === c) : properties
    return [...new Set(filtered.map(p => p.neighborhood).filter(Boolean))].sort()
  }, [properties, heroCity, appliedFilters.city])

  const heroBackgroundImage = organization.settings?.storefront?.hero?.backgroundImage || ""

  // ─── Apply hero search ───────────────────────────────────────────
  const handleSearch = useCallback(() => {
    setAppliedFilters({
      service: heroService, code: heroCode, propertyClass: heroClass,
      city: heroCity, neighborhood: heroNeighborhood, priceMin: heroPriceMin, priceMax: heroPriceMax
    })
    setCurrentPage(1)
  }, [heroService, heroCode, heroClass, heroCity, heroNeighborhood, heroPriceMin, heroPriceMax])

  // ─── Filtering ───────────────────────────────────────────────────
  const filteredProperties = useMemo(() => {
    return properties.filter(property => {
      // Hero filters
      if (appliedFilters.service && !property.property_type?.toLowerCase().includes(appliedFilters.service.toLowerCase())) return false
      if (appliedFilters.code && !property.external_code?.toLowerCase().includes(appliedFilters.code.toLowerCase())) return false
      if (appliedFilters.propertyClass && property.property_class !== appliedFilters.propertyClass) return false
      if (appliedFilters.city && property.city !== appliedFilters.city) return false
      if (appliedFilters.neighborhood && property.neighborhood !== appliedFilters.neighborhood) return false

      const price = property.price_rent || property.price_sale || 0
      if (appliedFilters.priceMin && price < parseFloat(appliedFilters.priceMin)) return false
      if (appliedFilters.priceMax && price > parseFloat(appliedFilters.priceMax)) return false

      // Sidebar filters
      if (offerType === "arriendo" && !property.price_rent) return false
      if (offerType === "venta" && !property.price_sale) return false
      if (selectedBedrooms === "5+" && (property.bedrooms ?? 0) < 5) return false
      if (selectedBedrooms && selectedBedrooms !== "5+" && property.bedrooms !== parseInt(selectedBedrooms)) return false

      return true
    })
  }, [properties, appliedFilters, offerType, selectedBedrooms])

  // ─── Sorting ─────────────────────────────────────────────────────
  const sortedProperties = useMemo(() => {
    const sorted = [...filteredProperties]
    if (sortBy === "price_asc") sorted.sort((a, b) => (a.price_rent || a.price_sale || 0) - (b.price_rent || b.price_sale || 0))
    else if (sortBy === "price_desc") sorted.sort((a, b) => (b.price_rent || b.price_sale || 0) - (a.price_rent || a.price_sale || 0))
    return sorted
  }, [filteredProperties, sortBy])

  // ─── Pagination ──────────────────────────────────────────────────
  const totalPages = Math.ceil(sortedProperties.length / ITEMS_PER_PAGE)
  const paginatedProperties = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return sortedProperties.slice(start, start + ITEMS_PER_PAGE)
  }, [sortedProperties, currentPage])

  const featuredProperties = useMemo(() => properties.filter(p => p.is_featured), [properties])

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1) }, [offerType, selectedBedrooms, sortBy])

  const clearSidebarFilters = useCallback(() => {
    setOfferType("all")
    setSelectedBedrooms("")
  }, [])

  const clearAllFilters = useCallback(() => {
    setHeroService(""); setHeroCode(""); setHeroClass(""); setHeroCity("")
    setHeroNeighborhood(""); setHeroPriceMin(""); setHeroPriceMax("")
    setAppliedFilters({ service: "", code: "", propertyClass: "", city: "", neighborhood: "", priceMin: "", priceMax: "" })
    clearSidebarFilters()
    setCurrentPage(1)
  }, [clearSidebarFilters])

  const primaryColor = organization.settings?.branding?.primaryColor || "#1a3a3a"
  const forestGreen = "#2c4c4c"

  return (
    <div className="bg-[#f8f9fa] text-[#121317]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ═══════════════════ HERO SECTION ═══════════════════ */}
      <section className="relative w-full">
        <div
          className="flex min-h-[600px] flex-col gap-10 bg-cover bg-center bg-no-repeat items-center justify-center p-6"
          style={{
            backgroundImage: heroBackgroundImage
              ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url("${heroBackgroundImage}")`
              : `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url("https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1920&q=80")`
          }}
        >
          <div className="flex flex-col gap-3 text-center mb-4">
            <h1 className="text-white text-4xl md:text-6xl font-black leading-tight tracking-tight">
              {organization.settings?.storefront?.hero?.title || "Encuentra tu hogar ideal"}
            </h1>
            <p className="text-white/90 text-lg md:text-xl font-normal">
              {organization.settings?.storefront?.hero?.subtitle || "Venta y arriendo de propiedades con respaldo profesional"}
            </p>
          </div>

          {/* Hero Search Bar — 7 columns like Stitch */}
          <div className="w-full max-w-[1200px] flex flex-col items-center gap-8">
            {isMounted && (
              <div className="w-full grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 border-t border-b border-white/20">
                <select
                  value={heroService}
                  onChange={(e) => setHeroService(e.target.value)}
                  className="bg-transparent border border-white/40 text-white text-sm py-3 px-4 w-full focus:outline-none focus:border-white transition-colors appearance-none"
                >
                  <option value="" className="text-gray-900">- Servicio -</option>
                  <option value="venta" className="text-gray-900">Venta</option>
                  <option value="arriendo" className="text-gray-900">Arriendo</option>
                </select>
                <input
                  className="bg-transparent border border-white/40 text-white placeholder:text-white/70 text-sm py-3 px-4 w-full focus:outline-none focus:border-white transition-colors"
                  placeholder="Código"
                  value={heroCode}
                  onChange={(e) => setHeroCode(e.target.value)}
                />
                <select
                  value={heroClass}
                  onChange={(e) => setHeroClass(e.target.value)}
                  className="bg-transparent border border-white/40 text-white text-sm py-3 px-4 w-full focus:outline-none focus:border-white transition-colors appearance-none"
                >
                  <option value="" className="text-gray-900">- Tipo Inmueble -</option>
                  {propertyClasses.map(c => (
                    <option key={c} value={c} className="text-gray-900">{c}</option>
                  ))}
                </select>
                <select
                  value={heroCity}
                  onChange={(e) => { setHeroCity(e.target.value); setHeroNeighborhood("") }}
                  className="bg-transparent border border-white/40 text-white text-sm py-3 px-4 w-full focus:outline-none focus:border-white transition-colors appearance-none"
                >
                  <option value="" className="text-gray-900">- Municipio -</option>
                  {cities.map(c => (
                    <option key={c} value={c} className="text-gray-900">{c}</option>
                  ))}
                </select>
                <select
                  value={heroNeighborhood}
                  onChange={(e) => setHeroNeighborhood(e.target.value)}
                  className="bg-transparent border border-white/40 text-white text-sm py-3 px-4 w-full focus:outline-none focus:border-white transition-colors appearance-none"
                >
                  <option value="" className="text-gray-900">- Barrio -</option>
                  {neighborhoods.map(n => (
                    <option key={n} value={n} className="text-gray-900">{n}</option>
                  ))}
                </select>
                <input
                  className="bg-transparent border border-white/40 text-white placeholder:text-white/70 text-sm py-3 px-4 w-full focus:outline-none focus:border-white transition-colors"
                  placeholder="Precio Min"
                  type="number"
                  value={heroPriceMin}
                  onChange={(e) => setHeroPriceMin(e.target.value)}
                />
                <input
                  className="bg-transparent border border-white/40 text-white placeholder:text-white/70 text-sm py-3 px-4 w-full focus:outline-none focus:border-white transition-colors border-none"
                  placeholder="Precio Max"
                  type="number"
                  value={heroPriceMax}
                  onChange={(e) => setHeroPriceMax(e.target.value)}
                />
              </div>
            )}
            <button
              className="hover:brightness-90 text-white px-12 py-3 text-sm font-bold tracking-widest transition-all uppercase"
              style={{ backgroundColor: forestGreen }}
              onClick={handleSearch}
            >
              BUSCAR
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════ MAIN CONTENT: SIDEBAR + GRID ═══════════════════ */}
      <main className="max-w-[1280px] mx-auto px-4 md:px-10 lg:px-20 py-12 flex flex-col lg:flex-row gap-10">

        {/* ─── Sidebar: Filtros Avanzados ────────────────────────── */}
        <aside className="w-full lg:w-1/4 flex flex-col gap-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 sticky top-24">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Filtros Avanzados</h3>
              <button
                className="text-xs font-bold uppercase hover:underline"
                style={{ color: primaryColor }}
                onClick={clearSidebarFilters}
              >
                Limpiar
              </button>
            </div>

            {/* Tipo de Oferta — toggle */}
            <div className="mb-8">
              <p className="text-sm font-semibold mb-3">Tipo de Oferta</p>
              <div className="flex h-10 w-full items-center justify-center rounded-lg bg-[#f0f1f4] p-1">
                {(["arriendo", "venta"] as const).map((type) => (
                  <label key={type} className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 text-sm font-medium transition-all ${offerType === type ? "bg-white shadow-sm" : ""}`}>
                    <span className="capitalize">{type}</span>
                    <input
                      className="invisible w-0"
                      name="op_type"
                      type="radio"
                      value={type}
                      checked={offerType === type}
                      onChange={() => setOfferType(offerType === type ? "all" : type)}
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Habitaciones — grid buttons */}
            <div>
              <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-gray-400" style={{ fontSize: 20 }}>bed</span> Habitaciones
              </p>
              <div className="grid grid-cols-5 gap-2">
                {BEDROOM_OPTIONS.map((opt) => {
                  const val = String(opt)
                  const isSelected = selectedBedrooms === val
                  return (
                    <button
                      key={val}
                      className={`py-2 text-xs font-bold rounded-lg border transition-colors ${
                        isSelected
                          ? "text-white border-transparent"
                          : "border-gray-200 hover:border-gray-400"
                      }`}
                      style={isSelected ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                      onClick={() => setSelectedBedrooms(isSelected ? "" : val)}
                    >
                      {val}
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              className="mt-8 w-full py-3 text-white font-bold rounded-lg hover:brightness-90 transition-all uppercase tracking-wider text-sm"
              style={{ backgroundColor: primaryColor }}
              onClick={() => setCurrentPage(1)}
            >
              Aplicar Filtros
            </button>
          </div>
        </aside>

        {/* ─── Property Grid ─────────────────────────────────────── */}
        <section className="w-full lg:w-3/4">
          {/* Header + Sort */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold">Propiedades Disponibles</h2>
              <p className="text-gray-500 text-sm">
                Mostrando {paginatedProperties.length} resultados de {sortedProperties.length} encontrados
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-500 whitespace-nowrap">Ordenar por:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-sm border-gray-200 rounded-lg focus:ring-1 min-w-[180px] py-2 px-3 border"
                style={{ outlineColor: primaryColor }}
              >
                <option value="recent">Más recientes</option>
                <option value="price_asc">Precio: menor a mayor</option>
                <option value="price_desc">Precio: mayor a menor</option>
              </select>
            </div>
          </div>

          {/* Property Cards Grid */}
          {paginatedProperties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {paginatedProperties.map(property => (
                <PropertyCard key={property.id} property={property} slug={organization.slug} primaryColor={primaryColor} onStartChat={onStartChat} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <span className="material-symbols-outlined text-gray-300 mb-4" style={{ fontSize: 48 }}>home_work</span>
              <p className="text-lg font-medium text-gray-600">No se encontraron propiedades</p>
              <p className="mt-1 text-sm text-gray-400">Prueba ajustando los filtros de búsqueda</p>
              <button
                className="mt-4 px-6 py-2 text-sm font-bold rounded-lg border hover:bg-gray-50 transition-colors"
                onClick={clearAllFilters}
              >
                Limpiar todos los filtros
              </button>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="size-10 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-30"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              {getPaginationRange(currentPage, totalPages).map((page, i) =>
                page === "..." ? (
                  <span key={`dots-${i}`} className="px-2 text-gray-400">...</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page as number)}
                    className={`size-10 flex items-center justify-center rounded-lg font-bold text-sm transition-colors ${
                      currentPage === page ? "text-white" : "border border-gray-200 hover:bg-gray-50"
                    }`}
                    style={currentPage === page ? { backgroundColor: primaryColor } : {}}
                  >
                    {page}
                  </button>
                )
              )}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="size-10 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-30"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          )}
        </section>
      </main>

      {/* ═══════════════════ FEATURED SECTION ═══════════════════ */}
      {featuredProperties.length > 0 && (
        <section className="bg-[#f0f4f4] py-20 px-4 md:px-10 lg:px-40 mt-12">
          <div className="max-w-[1280px] mx-auto">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-3xl font-black" style={{ color: primaryColor }}>Propiedades Destacadas</h2>
                <p className="text-gray-600 mt-1">Nuestra selección exclusiva de la semana</p>
              </div>
            </div>
            <div className="flex overflow-x-auto gap-6 hide-scrollbar pb-6" style={{ scrollbarWidth: "none" }}>
              {featuredProperties.map(property => (
                <FeaturedCard key={property.id} property={property} slug={organization.slug} primaryColor={primaryColor} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="bg-gray-950 text-white py-16 px-4 md:px-10 lg:px-40">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1">
            <div className="flex items-center gap-3 text-white mb-6">
              {organization.logo_url && (
                <Image src={organization.logo_url} alt={organization.name} width={32} height={32} className="rounded" />
              )}
              <h2 className="text-xl font-bold">{organization.name}</h2>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              {organization.settings?.storefront?.footer?.description || "Expertos en gestión inmobiliaria con respaldo profesional."}
            </p>
          </div>
          <div>
            <h5 className="font-bold mb-6">Propiedades</h5>
            <ul className="space-y-4 text-gray-400 text-sm">
              <li><Link href="#" className="hover:text-white transition-colors">Venta de Casas</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Arriendo Apartamentos</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Locales Comerciales</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold mb-6">Servicios</h5>
            <ul className="space-y-4 text-gray-400 text-sm">
              <li><Link href="#" className="hover:text-white transition-colors">Asesoría Inmobiliaria</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Avalúos</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Administración</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold mb-6">Contacto</h5>
            <ul className="space-y-4 text-gray-400 text-sm">
              {organization.settings?.contact?.phone && (
                <li className="flex items-center gap-3">
                  <span className="material-symbols-outlined" style={{ color: primaryColor, fontSize: 20 }}>call</span>
                  {organization.settings.contact.phone}
                </li>
              )}
              {organization.settings?.contact?.address && (
                <li className="flex items-center gap-3">
                  <span className="material-symbols-outlined" style={{ color: primaryColor, fontSize: 20 }}>location_on</span>
                  {organization.settings.contact.address}
                </li>
              )}
              {organization.settings?.contact?.email && (
                <li className="flex items-center gap-3">
                  <span className="material-symbols-outlined" style={{ color: primaryColor, fontSize: 20 }}>mail</span>
                  {organization.settings.contact.email}
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="max-w-[1280px] mx-auto border-t border-white/10 mt-16 pt-8 text-gray-500 text-xs text-center">
          <p>&copy; {new Date().getFullYear()} {organization.name}. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}

// ─── Property Card (Stitch design) ──────────────────────────────────
function PropertyCard({
  property,
  slug,
  primaryColor,
  onStartChat
}: {
  property: Property
  slug: string
  primaryColor: string
  onStartChat?: (productId?: string) => void
}) {
  const images = property.images || []
  const sortedImages = [...images].sort((a, b) => a.position - b.position)
  const mainImage = sortedImages[0]
  const price = property.price_rent || property.price_sale || 0
  const isRent = !!property.price_rent
  const priceLabel = isRent ? "Arriendo" : "Venta"
  const badgeBg = isRent ? "bg-blue-600" : ""

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 group hover:shadow-xl transition-all duration-300 flex flex-col h-full">
      {/* Image */}
      <div className="relative h-56">
        {isValidImageUrl(mainImage?.url) ? (
          <PropertyImage
            src={mainImage!.url}
            alt={property.title}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            unoptimized={shouldBypassOptimization(mainImage?.url)}
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
            <span className="material-symbols-outlined" style={{ fontSize: 48 }}>home</span>
          </div>
        )}
        {/* Badges top-left */}
        <div className="absolute top-3 left-3 flex gap-2">
          <span
            className={`text-white text-[10px] font-black px-2 py-1 rounded uppercase ${badgeBg}`}
            style={!isRent ? { backgroundColor: primaryColor } : {}}
          >
            {priceLabel}
          </span>
          <span className="bg-black/50 text-white text-[10px] font-bold px-2 py-1 rounded">
            ID: {property.external_code}
          </span>
        </div>
        {/* Price pill bottom-right */}
        <div className="absolute bottom-3 right-3 bg-white/90 px-3 py-1 rounded-full text-xs font-bold" style={{ color: primaryColor }}>
          {formatPrice(price)}{isRent && " / mes"}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col">
        <div className="mb-4">
          <h3 className="font-bold text-base group-hover:transition-colors mb-1 line-clamp-1" style={{ color: "inherit" }}>
            {property.title}
          </h3>
          <p className="text-gray-500 text-xs flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>location_on</span>
            {[property.neighborhood, property.city].filter(Boolean).join(", ")}
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-2 gap-y-3 mb-6">
          {property.bedrooms != null && property.bedrooms > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="material-symbols-outlined text-gray-400" style={{ fontSize: 20 }}>bed</span>
              <span className="font-semibold">{property.bedrooms} Hab</span>
            </div>
          )}
          {property.bathrooms != null && property.bathrooms > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="material-symbols-outlined text-gray-400" style={{ fontSize: 20 }}>bathtub</span>
              <span className="font-semibold">{property.bathrooms} Baños</span>
            </div>
          )}
          {property.area_m2 != null && property.area_m2 > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="material-symbols-outlined text-gray-400" style={{ fontSize: 20 }}>straighten</span>
              <span className="font-semibold">{property.area_m2} m²</span>
            </div>
          )}
          {property.parking_spots != null && property.parking_spots > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="material-symbols-outlined text-gray-400" style={{ fontSize: 20 }}>directions_car</span>
              <span className="font-semibold">{property.parking_spots} Parq</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-auto grid grid-cols-2 gap-3">
          <Link
            href={`/store/${slug}/property/${property.external_code}`}
            className="py-2 text-sm font-bold border rounded-lg hover:bg-opacity-5 transition-colors text-center"
            style={{ borderColor: primaryColor, color: primaryColor }}
          >
            Detalles
          </Link>
          <button
            onClick={(e) => { e.preventDefault(); onStartChat?.(property.external_code) }}
            className="py-2 text-sm font-bold bg-[#10b981] text-white rounded-lg hover:bg-[#059669] transition-colors flex items-center justify-center gap-1"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>event</span> Cita
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Featured Card (horizontal scroll, Stitch design) ───────────────
function FeaturedCard({
  property,
  slug,
  primaryColor
}: {
  property: Property
  slug: string
  primaryColor: string
}) {
  const images = property.images || []
  const sortedImages = [...images].sort((a, b) => a.position - b.position)
  const mainImage = sortedImages[0]
  const price = property.price_rent || property.price_sale || 0

  return (
    <Link
      href={`/store/${slug}/property/${property.external_code}`}
      className="min-w-[300px] md:min-w-[400px] bg-white rounded-xl overflow-hidden shadow-md flex flex-col md:flex-row border hover:shadow-lg transition-all"
      style={{ borderColor: `${primaryColor}15` }}
    >
      <div className="w-full md:w-2/5 h-48 md:h-auto overflow-hidden relative">
        {isValidImageUrl(mainImage?.url) ? (
          <PropertyImage
            src={mainImage!.url}
            alt={property.title}
            className="object-cover hover:scale-105 transition-transform duration-500"
            sizes="200px"
            unoptimized={shouldBypassOptimization(mainImage?.url)}
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <span className="material-symbols-outlined text-gray-400" style={{ fontSize: 48 }}>home</span>
          </div>
        )}
      </div>
      <div className="p-6 md:w-3/5">
        <span
          className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full mb-3 uppercase tracking-widest"
          style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
        >
          Destacado
        </span>
        <h4 className="text-xl font-bold mb-2 line-clamp-1">{property.title}</h4>
        <p className="text-2xl font-black mb-4" style={{ color: primaryColor }}>
          {formatPriceShort(price)}
        </p>
        <span
          className="block w-full py-2 text-white font-bold rounded-lg hover:shadow-lg transition-all text-sm uppercase text-center"
          style={{ backgroundColor: primaryColor }}
        >
          Ver Propiedad
        </span>
      </div>
    </Link>
  )
}

// ─── Pagination Helper ─────────────────────────────────────────────
function getPaginationRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "...")[] = [1]
  if (current > 3) pages.push("...")
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 2) pages.push("...")
  pages.push(total)
  return pages
}
