"use server"

import { getProductWithVariants } from "@/lib/commerce/getProductWithVariants"
import { listProductsWithVariants, type ProductListOrderBy } from "@/lib/commerce/listProductsWithVariants"
import { buildProductDetailViewModel } from "@/lib/commerce/productDetailViewModel"
import {
    mapLegacyProductRowToStorefrontProduct,
    mapProductListItemToStorefrontProduct,
    type StorefrontProduct,
} from "@/lib/commerce/storefrontProduct"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isRealEstateIndustry } from "@/lib/storefront-templates"
import {
    normalizeCategoryCounts,
    type StorefrontCategoryCount,
    type StorefrontFacetsRow,
} from "@/lib/storefront/facets-normalizer"
import type { ProductData } from "@/types/product"
import {
    getStorefrontCustomerSession,
    verifyStorefrontOrderAccessToken,
} from "@/lib/storefrontAccess"
// v1.14.2: helpers de enrichment movidos a un módulo separado para poder
// reutilizarlos desde server components (como [pageSlug]/page.tsx) sin
// chocar con la restricción "use server" de este archivo (que exige que
// todos los exports sean async server actions).
import {
    enrichOrganizationWithStorefrontContact,
    resolveOrganizationAgentIdentity,
    resolveOrganizationWhatsAppPhone,
    type StorefrontSupabaseClient,
} from "@/lib/storefront/organization-enrichment"

interface StorefrontBundleItem {
    product_id?: string | null
    quantity?: number | null
    variant?: string | null
    product_name?: string | null
    slug?: string | null
    price?: number | null
    image_url?: string | null
    images?: string[] | null
}

interface BundleProductRow {
    id: string
    name: string
    slug?: string | null
    price?: number | null
    image_url?: string | null
    images?: string[] | null
}

export interface ProactiveCouponOffer {
    code: string
    description: string | null
    type: "percentage" | "fixed" | "free_shipping"
    value: number
    validUntil: string | null
    minPurchaseAmount: number | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getOptionalString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value : null
}

function getOptionalNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null
}

function getOptionalStringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
        return null
    }

    const values = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    return values.length > 0 ? values : null
}

function normalizeStorefrontBundleItem(value: unknown): StorefrontBundleItem | null {
    if (!isRecord(value)) {
        return null
    }

    return {
        product_id: getOptionalString(value.product_id),
        quantity: getOptionalNumber(value.quantity),
        variant: getOptionalString(value.variant),
        product_name: getOptionalString(value.product_name),
        slug: getOptionalString(value.slug),
        price: getOptionalNumber(value.price),
        image_url: getOptionalString(value.image_url),
        images: getOptionalStringArray(value.images),
    }
}

async function enrichStorefrontBundleItems(params: {
    supabase: StorefrontSupabaseClient
    organizationId: string
    bundleItems: unknown
}): Promise<StorefrontBundleItem[]> {
    const items = Array.isArray(params.bundleItems)
        ? params.bundleItems.map(normalizeStorefrontBundleItem).filter((item): item is StorefrontBundleItem => item !== null)
        : []

    if (items.length === 0) {
        return []
    }

    const productIds = Array.from(new Set(items.map((item) => item.product_id).filter((id): id is string => Boolean(id))))
    if (productIds.length === 0) {
        return items
    }

    const { data: bundleProducts, error: bundleProductsError } = await params.supabase
        .from("products")
        .select("id, name, slug, price, image_url, images")
        .eq("organization_id", params.organizationId)
        .neq("is_active", false)
        .in("id", productIds)

    if (bundleProductsError) {
        console.error("[getProductDetails] Error fetching bundle products:", bundleProductsError)
        return items
    }

    const productsById = new Map<string, BundleProductRow>()
    ;(bundleProducts || []).forEach((product) => {
        productsById.set(product.id, product)
    })

    return items.map((item) => {
        const bundleProduct = item.product_id ? productsById.get(item.product_id) : null

        return {
            ...item,
            product_name: bundleProduct?.name ?? item.product_name ?? null,
            slug: bundleProduct?.slug ?? item.slug ?? null,
            price: bundleProduct?.price ?? item.price ?? null,
            image_url: bundleProduct?.image_url ?? item.image_url ?? null,
            images: bundleProduct?.images ?? item.images ?? null,
        }
    })
}

function resolveStorefrontProductOrder(value: unknown): ProductListOrderBy {
    return value === "custom" || value === "price_asc" || value === "price_desc"
        ? value
        : "recent"
}

function isCouponType(value: unknown): value is ProactiveCouponOffer["type"] {
    return value === "percentage" || value === "fixed" || value === "free_shipping"
}

function buildCouponDescription(params: {
    description?: string | null
    type: ProactiveCouponOffer["type"]
    value: number
}) {
    if (params.description && params.description.trim().length > 0) return params.description.trim()
    if (params.type === "percentage") return `${params.value}% de descuento`
    if (params.type === "fixed") return `$${params.value.toLocaleString("es-CO")} de descuento`
    return "Envío gratis"
}

function getProductCategoryValues(product: Record<string, unknown>): string[] {
    const categories = getOptionalStringArray(product.categories)
    const category = getOptionalString(product.category)
    return Array.from(new Set([...(categories || []), ...(category ? [category] : [])]))
}

function isCouponApplicableToProduct(coupon: Record<string, unknown>, product: Record<string, unknown>) {
    const appliesTo = getOptionalString(coupon.applies_to) || "all"
    if (appliesTo === "all") return true

    const targetIds = getOptionalStringArray(coupon.target_ids) || []
    if (targetIds.length === 0) return false

    if (appliesTo === "products") return targetIds.includes(String(product.id))
    if (appliesTo === "categories") {
        const productCategories = getProductCategoryValues(product)
        return productCategories.some((category) => targetIds.includes(category))
    }

    return false
}

async function getProactiveCouponOfferForProduct(params: {
    supabase: StorefrontSupabaseClient
    organizationId: string
    product: Record<string, unknown>
}): Promise<ProactiveCouponOffer | null> {
    const now = new Date().toISOString()
    const { data: coupons, error } = await params.supabase
        .from("coupons")
        .select("code, description, type, value, valid_until, min_purchase_amount, applies_to, target_ids")
        .eq("organization_id", params.organizationId)
        .eq("is_active", true)
        .or(`valid_from.is.null,valid_from.lte.${now}`)
        .or(`valid_until.is.null,valid_until.gte.${now}`)
        .order("valid_until", { ascending: true, nullsFirst: false })
        .limit(10)

    if (error || !coupons) {
        console.error("[getProactiveCouponOfferForProduct] Error fetching coupons:", error)
        return null
    }

    const coupon = coupons.find((item) => isCouponApplicableToProduct(item, params.product))
    if (!coupon || !isCouponType(coupon.type)) return null

    const value = Number(coupon.value)
    if (!Number.isFinite(value)) return null

    return {
        code: coupon.code,
        description: buildCouponDescription({
            description: coupon.description,
            type: coupon.type,
            value,
        }),
        type: coupon.type,
        value,
        validUntil: coupon.valid_until || null,
        minPurchaseAmount: coupon.min_purchase_amount ? Number(coupon.min_purchase_amount) : null,
    }
}

// v1.14.2: las funciones resolveOrganizationWhatsAppPhone,
// resolveOrganizationAgentIdentity y enrichOrganizationWithStorefrontContact
// viven ahora en `src/lib/storefront/organization-enrichment.ts`. Se importan
// en el top de este archivo. Movidas allá para poder reutilizarlas desde
// server components/pages sin chocar con la restricción de "use server"
// (todos los exports de un archivo "use server" deben ser async functions).

async function getLegacyStorefrontProducts(params: {
    supabase: StorefrontSupabaseClient
    organizationId: string
    itemsToShow: number
    orderBy: ProductListOrderBy
}): Promise<StorefrontProduct[]> {
    const { supabase, organizationId, itemsToShow, orderBy } = params

    let query = supabase
        .from("products")
        .select("*")
        .eq("organization_id", organizationId)
        .neq("is_active", false)

    if (orderBy === "custom") {
        query = query.order("display_order", { ascending: true }).order("created_at", { ascending: false })
    } else if (orderBy === "price_asc") {
        query = query.order("price", { ascending: true })
    } else if (orderBy === "price_desc") {
        query = query.order("price", { ascending: false })
    } else {
        query = query.order("created_at", { ascending: false })
    }

    const { data: products, error: productsError } = await query.limit(itemsToShow)

    if (productsError) {
        console.error("Error fetching products:", productsError)
        return []
    }

    return (products || [])
        .map((product) => mapLegacyProductRowToStorefrontProduct(product))
        .filter((product): product is StorefrontProduct => product != null)
}

export async function getStoreData(slug: string, limit?: number) {
    const supabase = await createClient()

    // 1. Fetch Organization by Slug
    // i18n Fase 1 (T1.3c): currency_code, locale, country_code se incluyen para
    // que el layout monte el TenantLocaleProvider con el locale correcto del
    // tenant. REQUIERE migración 20260519_organizations_locale_currency.sql aplicada.
    const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, slug, logo_url, favicon_url, seo_title, seo_description, seo_keywords, storefront_config, storefront_template, primary_color, secondary_color, contact_email, industry, settings, tracking_config, custom_domain, currency_code, locale, country_code")
        .eq("slug", slug)
        .single()

    if (orgError || !org) {
        console.error("Error fetching organization:", orgError)
        return null
    }

    // 2. Get product configuration from organization settings
    const productConfig = org.settings?.storefront?.products
    const itemsToShow = limit || productConfig?.itemsToShow || 20 // Default to 20 if no config
    const orderBy = resolveStorefrontProductOrder(productConfig?.orderBy)
    let products: StorefrontProduct[] = []

    try {
        const productList = await listProductsWithVariants({
            organizationId: org.id,
            client: supabase,
            limit: itemsToShow,
            orderBy,
        })

        products = productList.map((product) => mapProductListItemToStorefrontProduct(product))
    } catch (error) {
        console.error("[getStoreData] Error fetching variant-centric products:", error)
        products = await getLegacyStorefrontProducts({
            supabase,
            organizationId: org.id,
            itemsToShow,
            orderBy,
        })
    }

    // 4. Fetch Published Pages for footer/navigation
    const { data: pages } = await supabase
        .from("store_pages")
        .select("id, slug, title")
        .eq("organization_id", org.id)
        .eq("is_published", true)
        .order("title", { ascending: true })

    // 5. Fetch Properties for real estate organizations
    let properties: Array<Record<string, unknown>> = []
    const isRealEstate = isRealEstateIndustry(org) || 
        org.storefront_template === 'real-estate' ||
        org.settings?.storefront?.template === 'real-estate'
    
    if (isRealEstate) {
        // T0.5.1.1: Usa el cliente anon (createClient sin sesión).
        // La migración 20260521a_properties_public_read.sql asegura policy
        // `properties_public_read_active` que permite SELECT a anon cuando
        // status='active'. Filtro por organization_id explícito en la query.
        const { data: props } = await supabase
            .from('properties')
            .select('*')
            .eq('organization_id', org.id)
            .eq('status', 'active')
            .order('is_featured', { ascending: false })
            .order('created_at', { ascending: false })

        properties = props || []
    }

    // 6. Fetch Badges for product cards
    const { data: badges } = await supabase
        .from("badges")
        .select("*")
        .eq("organization_id", org.id)

    const whatsappPhone = await resolveOrganizationWhatsAppPhone(supabase, org.id, org.settings)
    const agentIdentity = await resolveOrganizationAgentIdentity(supabase, org.id, org.settings)
    const enrichedOrg = enrichOrganizationWithStorefrontContact(org, whatsappPhone, agentIdentity)

    return {
        organization: enrichedOrg,
        products: products || [],
        pages: pages || [],
        properties,
        badges: badges || []
    }
}

/**
 * v1.14.5: lectura de catalogo del storefront /productos con filtros
 * (search, categorias, rango precio) y facets para el panel de filtros.
 *
 * Llama por separado a `listProductsWithVariants` (que internamente usa la RPC
 * `search_products` cuando hay search) y a la RPC `storefront_facets`. Las
 * dos consultas se ejecutan en paralelo.
 */
export interface StorefrontCatalogFilters {
    search?: string | null
    categories?: string[] | null
    minPrice?: number | null
    maxPrice?: number | null
    limit?: number
}

// StorefrontCategoryCount NO se re-exporta aqui: este archivo es "use server"
// y Turbopack rechaza re-exports de tipos. Consumidores deben importar
// directamente desde "@/lib/storefront/facets-normalizer".

export interface StorefrontCatalogFacets {
    categories: string[]
    categoryCounts: StorefrontCategoryCount[]
    minPrice: number | null
    maxPrice: number | null
    productCount: number
}

export interface StorefrontCatalogResult {
    products: StorefrontProduct[]
    facets: StorefrontCatalogFacets
}

export async function getStorefrontProductsCatalog(
    slug: string,
    filters: StorefrontCatalogFilters,
): Promise<StorefrontCatalogResult | null> {
    const supabase = await createClient()

    const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, settings")
        .eq("slug", slug)
        .single()

    if (orgError || !org) {
        return null
    }

    const productConfig = org.settings?.storefront?.products
    const orderBy = resolveStorefrontProductOrder(productConfig?.orderBy)
    const sanitizedLimit = filters.limit && Number.isFinite(filters.limit) && filters.limit > 0
        ? Math.min(Math.trunc(filters.limit), 100)
        : 100

    // v1.15.1: facets PRIMERO para normalizar casing de filters.categories.
    //
    // Bug: el header del storefront genera URLs con `cat.toLowerCase()` desde
    // el dashboard (header-editor.tsx, commit 2b015dc del 2026-02-10) y el
    // panel de filtros tambien forzaba lowercase (commit 5994b17). Pero la
    // columna products.categories preserva el casing original de la DB y el
    // operador `&&` (overlaps) de Postgres es case-sensitive, asi que filtrar
    // por "cuidado corporal" contra ["Cuidado Corporal"] devolvia 0.
    //
    // Fix: cruzar filters.categories contra facets.categories (que son las
    // categorias REALES del catalogo) y reemplazar cada filtro con su
    // version del casing canonico antes de mandar al overlaps. URLs legacy
    // lowercase de tenants existentes siguen funcionando sin migracion.
    //
    // Tradeoff: secuencializa facets -> products (~50-100ms extra). Es
    // aceptable por correctitud y porque facets ya esta optimizada (RPC
    // agregada con SECURITY DEFINER).
    const facetsRow = await supabase
        .rpc("storefront_facets", { p_organization_id: org.id })
        .then(({ data, error }) => {
            if (error) {
                console.error("[getStorefrontProductsCatalog] storefront_facets RPC failed:", error)
                return null
            }
            const row = (Array.isArray(data) ? data[0] : data) as StorefrontFacetsRow | null
            return row
        })

    const realCategories: string[] = Array.isArray(facetsRow?.categories)
        ? facetsRow.categories
        : []

    const normalizedCategories = filters.categories
        ? filters.categories.map((filtered) => {
              const match = realCategories.find(
                  (real) => real.toLowerCase() === filtered.toLowerCase(),
              )
              return match ?? filtered
          })
        : null

    const productList = await listProductsWithVariants({
        organizationId: org.id,
        client: supabase,
        search: filters.search ?? null,
        limit: sanitizedLimit,
        orderBy,
        minPrice: filters.minPrice ?? null,
        maxPrice: filters.maxPrice ?? null,
        categories: normalizedCategories,
    }).catch((error) => {
        console.error("[getStorefrontProductsCatalog] listProductsWithVariants failed:", error)
        return [] as Awaited<ReturnType<typeof listProductsWithVariants>>
    })

    const products = productList.map((product) => mapProductListItemToStorefrontProduct(product))

    const facets: StorefrontCatalogFacets = {
        categories: Array.isArray(facetsRow?.categories) ? facetsRow.categories : [],
        categoryCounts: normalizeCategoryCounts(facetsRow?.category_counts),
        minPrice: typeof facetsRow?.min_price === "number" ? facetsRow.min_price : null,
        maxPrice: typeof facetsRow?.max_price === "number" ? facetsRow.max_price : null,
        productCount: typeof facetsRow?.product_count === "number" ? facetsRow.product_count : 0,
    }

    return { products, facets }
}

export async function getProductDetails(slug: string, slugOrId: string) {
    const supabase = await createClient()

    // 1. Fetch Organization
    const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, slug, industry, storefront_config, storefront_template, settings, tracking_config, custom_domain, logo_url, currency_code, locale, country_code")
        .eq("slug", slug)
        .single()

    if (orgError || !org) return null

    const whatsappPhone = await resolveOrganizationWhatsAppPhone(supabase, org.id, org.settings)
    const agentIdentity = await resolveOrganizationAgentIdentity(supabase, org.id, org.settings)
    const enrichedOrg = enrichOrganizationWithStorefrontContact(org, whatsappPhone, agentIdentity)

    // 2. Fetch Product - support both UUID and slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId)

    let productQuery = supabase
        .from("products")
        .select("*")
        .eq("organization_id", org.id)

    if (isUUID) {
        // Legacy support: lookup by UUID
        productQuery = productQuery.eq("id", slugOrId)
    } else {
        // New: lookup by slug
        productQuery = productQuery.eq("slug", slugOrId)
    }

    const { data: product, error: productError } = await productQuery.single()

    if (productError || !product) return null

    const productForDetail = product.is_bundle
        ? {
            ...product,
            bundle_items: await enrichStorefrontBundleItems({
                supabase,
                organizationId: org.id,
                bundleItems: product.bundle_items,
            }),
        }
        : product

    let productWithVariants = null

    try {
        productWithVariants = await getProductWithVariants({
            productId: productForDetail.id,
            organizationId: org.id,
            client: supabase,
        })
    } catch (error) {
        console.error("[getProductDetails] Error fetching productWithVariants:", error)
    }

    // 3. Fetch Active Badges
    const { data: badges } = await supabase
        .from("badges")
        .select("*")
        .eq("organization_id", org.id)

    // 4. Fetch Active Promotions
    const now = new Date().toISOString()
    const { data: promotions } = await supabase
        .from("promotions")
        .select("*")
        .eq("organization_id", org.id)
        .eq("is_active", true)
        .or(`start_date.is.null,start_date.lte.${now}`)
        .or(`end_date.is.null,end_date.gte.${now}`)

    // 5. Fetch Related Products (same category or random)
    let relatedProductsQuery = supabase
        .from("products")
        .select("id, name, slug, price, image_url, images")
        .eq("organization_id", org.id)
        .eq("is_active", true)
        .neq("id", productForDetail.id)
        .limit(4)

    // Try to get products from the same category first
    if (productForDetail.category) {
        relatedProductsQuery = relatedProductsQuery.eq("category", productForDetail.category)
    }

    const { data: relatedProducts } = await relatedProductsQuery
    const proactiveCouponOffer = await getProactiveCouponOfferForProduct({
        supabase,
        organizationId: org.id,
        product: productForDetail,
    })
    const viewModel = buildProductDetailViewModel({
        product: productForDetail as ProductData,
        productWithVariants,
        promotions: promotions || [],
    })

    return {
        organization: enrichedOrg,
        product: productForDetail,
        productWithVariants,
        viewModel,
        badges: badges || [],
        promotions: promotions || [],
        relatedProducts: relatedProducts || [],
        proactiveCouponOffer,
    }
}

async function getStorefrontOrganizationForOrder(slug: string) {
    const supabase = createServiceClient()

    // i18n Fase 1 (T1.3b'): incluir currency_code, locale, country_code en el
    // select para que getTenantLocale(organization) en las order pages pueda
    // derivar el contexto del tenant. REQUIERE que la migración
    // 20260519_organizations_locale_currency.sql esté aplicada en este entorno.
    const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, slug, logo_url, settings, primary_color, secondary_color, contact_email, custom_domain, tracking_config, currency_code, locale, country_code")
        .eq("slug", slug)
        .single()

    if (orgError || !org) {
        console.error("[getStorefrontOrganizationForOrder] Organization error:", orgError)
        return null
    }

    return {
        supabase,
        organization: org,
    }
}

export async function getOrderDetails(slug: string, orderId: string, accessToken?: string | null) {
    const result = await getStorefrontOrganizationForOrder(slug)

    if (!result) {
        return null
    }

    const { supabase, organization } = result

    const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("organization_id", organization.id)
        .single()

    if (orderError || !order) {
        console.error("[getOrderDetails] Order error:", orderError)
        return null
    }

    const customerSession = await getStorefrontCustomerSession(slug)
    const hasCustomerSessionAccess = Boolean(
        customerSession &&
        customerSession.organizationId === organization.id &&
        customerSession.customerId === order.customer_id
    )

    const hasSignedOrderAccess = Boolean(
        accessToken &&
        verifyStorefrontOrderAccessToken(accessToken, {
            slug,
            organizationId: organization.id,
            orderId: order.id,
            customerId: order.customer_id ?? null,
        })
    )

    if (!hasCustomerSessionAccess && !hasSignedOrderAccess) {
        return null
    }

    return {
        organization,
        order
    }
}

export async function getStoreSettings(slug: string) {
    const supabase = await createClient()

    const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("settings")
        .eq("slug", slug)
        .single()

    if (orgError || !org) return null

    return org.settings
}

export async function getShippingConfig(slug: string) {
    const supabase = await createClient()

    // 1. Obtener la organización
    const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .single()

    if (orgError || !org) return null

    // 2. Obtener configuración de envío de la tabla shipping_settings
    const { data: shippingSettings, error: shippingError } = await supabase
        .from("shipping_settings")
        .select("free_shipping_enabled, free_shipping_min_amount, free_shipping_zones, default_shipping_rate, estimated_delivery_days, express_delivery_days")
        .eq("organization_id", org.id)
        .single()

    if (shippingError) {
        // Si no hay configuración específica, devolver valores por defecto
        return {
            free_shipping_enabled: false,
            free_shipping_min_amount: null,
            free_shipping_zones: null,
            default_shipping_rate: 0,
            estimated_delivery_days: null,
            express_delivery_days: null,
        }
    }

    return {
        free_shipping_enabled: shippingSettings.free_shipping_enabled || false,
        free_shipping_min_amount: shippingSettings.free_shipping_min_amount,
        free_shipping_zones: shippingSettings.free_shipping_zones || null,
        default_shipping_rate: shippingSettings.default_shipping_rate ?? 0,
        estimated_delivery_days: shippingSettings.estimated_delivery_days ?? null,
        express_delivery_days: shippingSettings.express_delivery_days ?? null,
    }
}
