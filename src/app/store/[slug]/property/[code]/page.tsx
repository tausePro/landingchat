import { createServiceClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { headers } from "next/headers"
import { BookingPanel } from "./booking-panel"
import { PhotoGallery } from "./photo-gallery"
import { StoreLayoutClient } from "../../store-layout-client"
import { getStoreData } from "../../actions"
import { isSubdomain, getStoreLink, getChatUrl } from "@/lib/utils/store-urls"

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price)

const isValidImageUrl = (url?: string | null) =>
  Boolean(url && url.startsWith("http") && !url.includes("arrendasoft.coimg"))

const shouldBypassOptimization = (url?: string | null) =>
  Boolean(url && url.includes("arrendasoft.co"))

export default async function PropertyDetailPage({
  params
}: {
  params: Promise<{ slug: string; code: string }>
}) {
  const { slug, code } = await params

  const headersList = await headers()
  const host = headersList.get("host") || ""
  const initialIsSubdomain = isSubdomain(host)

  // Obtener datos completos de la org (mismo patrón que el home)
  const storeData = await getStoreData(slug)
  if (!storeData) return notFound()

  const { organization, products, pages, properties: allProperties, badges } = storeData

  // Obtener la propiedad específica (por external_code o por UUID)
  const serviceClient = createServiceClient()
  let property = null

  // 1. Buscar por external_code
  const { data: byCode } = await serviceClient
    .from("properties")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("external_code", code)
    .eq("status", "active")
    .single()

  if (byCode) {
    property = byCode
  } else {
    // 2. Fallback: buscar por UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code)
    if (isUUID) {
      const { data: byId } = await serviceClient
        .from("properties")
        .select("*")
        .eq("organization_id", organization.id)
        .eq("id", code)
        .eq("status", "active")
        .single()
      if (byId) property = byId
    }
  }

  if (!property) return notFound()

  const price = property.price_sale || property.price_rent || 0
  const isRent = !!property.price_rent
  const priceLabel = isRent ? "Arriendo" : "Venta"
  const images = (property.images || []).sort((a: any, b: any) => a.position - b.position)
  const features = property.features || []
  const primaryColor = organization.settings?.branding?.primaryColor || "#1a3a3a"

  // URLs subdomain-aware
  const homeUrl = getStoreLink("/", initialIsSubdomain, slug)
  const chatUrl = getChatUrl(initialIsSubdomain, slug, true) + `?property=${code}`

  return (
    <StoreLayoutClient
      slug={slug}
      organization={organization}
      products={products}
      pages={pages}
      properties={allProperties}
      badges={badges}
      hideHeaderOnMobile={false}
      initialIsSubdomain={initialIsSubdomain}
      defaultChatProductId={code}
    >
      <div className="bg-[#f8fafc]" style={{ fontFamily: "'Inter', sans-serif" }}>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ═══════════════════ BREADCRUMBS ═══════════════════ */}
        <nav aria-label="Breadcrumb" className="flex text-sm text-slate-500 mb-6">
          <ol className="flex items-center space-x-2">
            <li><Link href={homeUrl} className="hover:text-slate-900">Inicio</Link></li>
            <li className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-sm">chevron_right</span>
              <span className="capitalize">{priceLabel}</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-sm">chevron_right</span>
              <span className="text-slate-900 font-medium line-clamp-1">{property.title}</span>
            </li>
          </ol>
        </nav>

        {/* ═══════════════════ EDITORIAL GALLERY GRID ═══════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-3 h-[500px] mb-8 overflow-hidden rounded-xl">
          {/* Main image — 2x2 */}
          <div className="md:col-span-2 md:row-span-2 relative group">
            <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-all z-10" />
            {isValidImageUrl(images[0]?.url) ? (
              <Image
                src={images[0].url}
                alt={property.title}
                fill
                className="object-cover"
                priority
                unoptimized={shouldBypassOptimization(images[0]?.url)}
              />
            ) : (
              <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 64 }}>home</span>
              </div>
            )}
          </div>
          {/* Secondary images — 4 slots */}
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="md:col-span-1 md:row-span-1 relative">
              {isValidImageUrl(images[idx]?.url) ? (
                <Image
                  src={images[idx].url}
                  alt={`${property.title} - ${idx + 1}`}
                  fill
                  className="object-cover"
                  unoptimized={shouldBypassOptimization(images[idx]?.url)}
                />
              ) : (
                <div className="w-full h-full bg-slate-100" />
              )}
            </div>
          ))}
          {/* Last slot with "Ver X fotos" button */}
          <div className="md:col-span-1 md:row-span-1 relative">
            {isValidImageUrl(images[4]?.url) ? (
              <Image
                src={images[4].url}
                alt={`${property.title} - 5`}
                fill
                className="object-cover"
                unoptimized={shouldBypassOptimization(images[4]?.url)}
              />
            ) : (
              <div className="w-full h-full bg-slate-100" />
            )}
            <PhotoGallery images={images} title={property.title} primaryColor={primaryColor} />
          </div>
        </div>

        {/* ═══════════════════ MAIN PROPERTY LAYOUT ═══════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
          {/* ─── Left Column: Details (2/3) ──────────────────────── */}
          <div className="lg:col-span-2 space-y-10">
            {/* Title Section */}
            <div className="border-b border-slate-200 pb-8">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase"
                  style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                >
                  {isRent ? "En Arriendo" : "En Venta"}
                </span>
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-medium">
                  Código: {property.external_code}
                </span>
              </div>
              <h1 className="text-4xl font-extrabold text-slate-900 mb-2 leading-tight">{property.title}</h1>
              <div className="flex items-center text-slate-500 gap-1 mb-6">
                <span className="material-symbols-outlined text-lg">location_on</span>
                <span className="text-base">
                  {[property.address, property.neighborhood, property.city].filter(Boolean).join(", ")}
                </span>
              </div>
              <div className="text-4xl font-black" style={{ color: primaryColor }}>
                {formatPrice(price)}
                {isRent && <span className="text-sm font-normal text-slate-500"> / mes</span>}
                {!isRent && <span className="text-sm font-normal text-slate-500"> COP</span>}
              </div>
              {property.price_admin && (
                <p className="text-sm text-slate-500 mt-1">Administración: {formatPrice(property.price_admin)}</p>
              )}
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-6 bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
              {property.bedrooms != null && property.bedrooms > 0 && (
                <div className="flex flex-col gap-1 items-center text-center">
                  <span className="material-symbols-outlined text-3xl" style={{ color: primaryColor }}>bed</span>
                  <span className="text-slate-900 font-bold">{property.bedrooms} Habitaciones</span>
                </div>
              )}
              {property.bathrooms != null && property.bathrooms > 0 && (
                <div className="flex flex-col gap-1 items-center text-center">
                  <span className="material-symbols-outlined text-3xl" style={{ color: primaryColor }}>bathtub</span>
                  <span className="text-slate-900 font-bold">{property.bathrooms} Baños</span>
                </div>
              )}
              {property.area_m2 != null && property.area_m2 > 0 && (
                <div className="flex flex-col gap-1 items-center text-center">
                  <span className="material-symbols-outlined text-3xl" style={{ color: primaryColor }}>square_foot</span>
                  <span className="text-slate-900 font-bold">{property.area_m2} m²</span>
                  <span className="text-xs text-slate-500">Área construida</span>
                </div>
              )}
              {property.parking_spots != null && property.parking_spots > 0 && (
                <div className="flex flex-col gap-1 items-center text-center">
                  <span className="material-symbols-outlined text-3xl" style={{ color: primaryColor }}>directions_car</span>
                  <span className="text-slate-900 font-bold">{property.parking_spots} Garajes</span>
                </div>
              )}
              {property.stratum && (
                <div className="flex flex-col gap-1 items-center text-center">
                  <span className="material-symbols-outlined text-3xl" style={{ color: primaryColor }}>apartment</span>
                  <span className="text-slate-900 font-bold">Estrato {property.stratum}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {property.description && (
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Descripción</h3>
                <div className="text-slate-600 leading-relaxed text-lg whitespace-pre-line">
                  {property.description}
                </div>
              </div>
            )}

            {/* Features / Amenities */}
            {features.length > 0 && (
              <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200">
                <h3 className="text-xl font-bold text-slate-900 mb-4">Comodidades del Inmueble</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {features.map((feature: any, idx: number) => (
                    <div key={idx} className="flex gap-3 text-slate-600">
                      <span className="material-symbols-outlined text-[#10b981] font-bold">check_circle</span>
                      <span>{feature.description || feature.descripcion}: {feature.valueText || feature.valor_texto || feature.value || feature.valor}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Property Details Table */}
            <div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Detalles del Inmueble</h3>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                  <div className="divide-y divide-slate-100">
                    <DetailRow label="Código" value={property.external_code} />
                    <DetailRow label="Tipo Inmueble" value={property.property_class} />
                    <DetailRow label="Servicio" value={priceLabel} />
                    <DetailRow label="Departamento" value={property.department} />
                    <DetailRow label="Municipio" value={property.city} />
                  </div>
                  <div className="divide-y divide-slate-100">
                    <DetailRow label="Barrio" value={property.neighborhood} />
                    <DetailRow label="Dirección" value={property.address} />
                    {property.stratum && <DetailRow label="Estrato" value={property.stratum} />}
                    {property.age_years && <DetailRow label="Antigüedad" value={`${property.age_years} años`} />}
                    {property.floor_number && <DetailRow label="Piso" value={String(property.floor_number)} />}
                  </div>
                </div>
              </div>
            </div>

            {/* Location */}
            <div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Ubicación</h3>
              <div className="rounded-2xl overflow-hidden h-72 w-full shadow-inner border border-slate-200 relative bg-slate-100">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="inline-flex p-4 rounded-full border animate-pulse mb-2" style={{ backgroundColor: `${primaryColor}20`, borderColor: `${primaryColor}40` }}>
                      <div className="size-4 rounded-full" style={{ backgroundColor: primaryColor }} />
                    </div>
                    <p className="text-sm text-slate-500">
                      {[property.neighborhood, property.city].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Right Column: Booking Panel (1/3) ───────────────── */}
          <div className="lg:col-span-1">
            <BookingPanel
              slug={slug}
              propertyCode={code}
              propertyTitle={property.title}
              primaryColor={primaryColor}
              orgName={organization.name}
              organizationId={organization.id}
              chatUrl={chatUrl}
            />
          </div>
        </div>
      </main>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="bg-white border-t border-slate-200 mt-20 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-6">
            {organization.logo_url && (
              <Image src={organization.logo_url} alt={organization.name} width={32} height={32} className="rounded" />
            )}
            <span className="text-lg font-bold tracking-tight text-slate-900">{organization.name}</span>
          </div>
          <div className="pt-8 border-t border-slate-100 text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} {organization.name}. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
    </StoreLayoutClient>
  )
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between px-6 py-3">
      <span className="text-slate-500 text-sm">{label}</span>
      <span className="text-slate-900 font-semibold text-sm">{value}</span>
    </div>
  )
}
