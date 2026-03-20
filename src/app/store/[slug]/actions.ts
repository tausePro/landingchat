"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { buildStorefrontViewModel } from "@/lib/storefront/buildStorefrontViewModel"
import { isRealEstateIndustry } from "@/lib/storefront-templates"
import { normalizeHeroSliderConfig, type StorefrontHeroSliderProduct, type StorefrontProperty } from "@/types/storefront"

export async function getStoreData(slug: string, limit?: number) {
    const supabase = await createClient()

    // 1. Fetch Organization by Slug
    const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, slug, logo_url, favicon_url, seo_title, seo_description, seo_keywords, storefront_config, storefront_template, primary_color, secondary_color, contact_email, industry, settings, tracking_config, custom_domain")
        .eq("slug", slug)
        .single()

    if (orgError || !org) {
        console.error("Error fetching organization:", orgError)
        return null
    }

    // 2. Get product configuration from organization settings
    const productConfig = org.settings?.storefront?.products
    const itemsToShow = limit || productConfig?.itemsToShow || 20 // Default to 20 if no config
    const orderBy = productConfig?.orderBy || "recent"
    const rawFeaturedProductIds = Array.isArray(org.settings?.storefront?.templateConfig?.complete?.featuredProductIds)
        ? org.settings.storefront.templateConfig.complete.featuredProductIds as unknown[]
        : []
    const featuredProductIds = Array.from(
        new Set(
            rawFeaturedProductIds.filter(
                (productId): productId is string => typeof productId === "string" && productId.length > 0
            )
        )
    ).slice(0, 3)

    // 3. Fetch Active Products with proper ordering
    let query = supabase
        .from("products")
        .select("*")
        .eq("organization_id", org.id)

    // Apply ordering based on configuration
    if (orderBy === "custom") {
        query = query.order("display_order", { ascending: true }).order("created_at", { ascending: false })
    } else if (orderBy === "price_asc") {
        query = query.order("price", { ascending: true })
    } else if (orderBy === "price_desc") {
        query = query.order("price", { ascending: false })
    } else {
        query = query.order("created_at", { ascending: false })
    }

    // Apply limit
    query = query.limit(itemsToShow)

    const { data: products, error: productsError } = await query

    if (productsError) {
        console.error("Error fetching products:", productsError)
    }

    let configuredFeaturedProducts: StorefrontHeroSliderProduct[] = []

    if (featuredProductIds.length > 0) {
        const { data: featuredBandProducts, error: featuredBandProductsError } = await supabase
            .from("products")
            .select("id, name, slug, price, sale_price, image_url, description")
            .eq("organization_id", org.id)
            .in("id", featuredProductIds)

        if (featuredBandProductsError) {
            console.error("Error fetching complete-v2 featured products:", featuredBandProductsError)
        } else {
            const featuredProductsData = (featuredBandProducts ?? []) as StorefrontHeroSliderProduct[]
            const featuredProductMap = new Map<string, StorefrontHeroSliderProduct>(
                featuredProductsData.map((product) => [product.id, product])
            )
            configuredFeaturedProducts = featuredProductIds.reduce<StorefrontHeroSliderProduct[]>((accumulator, productId) => {
                const product = featuredProductMap.get(productId)

                if (product) {
                    accumulator.push(product)
                }

                return accumulator
            }, [])
        }
    }

    const heroSliderConfig = normalizeHeroSliderConfig(org.settings?.storefront?.templateConfig?.complete?.heroSlider)
    const heroSliderProductIds = Array.from(
        new Set(
            heroSliderConfig.slides
                .map((slide) => slide.productId)
                .filter((productId): productId is string => productId.length > 0)
        )
    )
    let heroSliderProducts: StorefrontHeroSliderProduct[] = []

    if (heroSliderConfig.enabled && heroSliderProductIds.length > 0) {
        const { data: linkedProducts, error: linkedProductsError } = await supabase
            .from("products")
            .select("id, name, slug, price, sale_price, image_url, description")
            .eq("organization_id", org.id)
            .in("id", heroSliderProductIds)

        if (linkedProductsError) {
            console.error("Error fetching hero slider products:", linkedProductsError)
        } else {
            heroSliderProducts = linkedProducts || []
        }
    }

    // 4. Fetch Published Pages for footer/navigation
    const { data: pages } = await supabase
        .from("store_pages")
        .select("id, slug, title")
        .eq("organization_id", org.id)
        .eq("is_published", true)
        .order("title", { ascending: true })

    // 5. Fetch Properties for real estate organizations
    let properties: StorefrontProperty[] = []
    const isRealEstate = isRealEstateIndustry(org) || 
        org.storefront_template === 'real-estate' ||
        org.settings?.storefront?.template === 'real-estate'
    
    if (isRealEstate) {
        // Usar service client para evitar restricciones RLS en acceso público (subdominios)
        const serviceClient = createServiceClient()
        const { data: props } = await serviceClient
            .from('properties')
            .select('*')
            .eq('organization_id', org.id)
            .eq('status', 'active')
            .order('is_featured', { ascending: false })
            .order('created_at', { ascending: false })
        
        properties = (props ?? []) as StorefrontProperty[]
    }

    // 6. Fetch Badges for product cards
    const { data: badges } = await supabase
        .from("badges")
        .select("*")
        .eq("organization_id", org.id)

    // 7. Get WhatsApp phone from connected instance if not in settings
    let whatsappPhone = org.settings?.whatsapp?.phone || org.settings?.contact?.phone
    if (!whatsappPhone) {
        const { data: whatsappInstance } = await supabase
            .from("whatsapp_instances")
            .select("phone_number")
            .eq("organization_id", org.id)
            .eq("instance_type", "corporate")
            .eq("status", "connected")
            .single()

        if (whatsappInstance?.phone_number) {
            whatsappPhone = whatsappInstance.phone_number
        }
    }

    // Enrich organization with whatsapp phone
    const enrichedOrg = {
        ...org,
        settings: {
            ...org.settings,
            whatsapp: {
                ...org.settings?.whatsapp,
                phone: whatsappPhone
            }
        }
    }

    const storefrontViewModel = buildStorefrontViewModel({
        organization: enrichedOrg,
        pages: pages || [],
        products: products || [],
        configuredFeaturedProducts,
        heroSliderProducts,
        properties,
        badges: badges || []
    })

    return {
        organization: enrichedOrg,
        products: products || [],
        heroSliderProducts,
        storefrontViewModel,
        pages: pages || [],
        properties,
        badges: badges || []
    }
}

export async function getProductDetails(slug: string, slugOrId: string) {
    const supabase = await createClient()

    // 1. Fetch Organization
    const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, slug, industry, storefront_config, storefront_template, settings, tracking_config, custom_domain, logo_url")
        .eq("slug", slug)
        .single()

    if (orgError || !org) return null

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
        .neq("id", product.id)
        .limit(4)

    // Try to get products from the same category first
    if (product.category) {
        relatedProductsQuery = relatedProductsQuery.eq("category", product.category)
    }

    const { data: relatedProducts } = await relatedProductsQuery

    return {
        organization: org,
        product,
        badges: badges || [],
        promotions: promotions || [],
        relatedProducts: relatedProducts || []
    }
}

export async function getOrderDetails(slug: string, orderId: string) {
    const supabase = createServiceClient()

    // 1. Fetch Organization
    const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, slug, logo_url, settings, primary_color, secondary_color, contact_email")
        .eq("slug", slug)
        .single()

    if (orgError || !org) {
        console.error("[getOrderDetails] Organization error:", orgError)
        return null
    }

    // 2. Fetch Order
    const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("organization_id", org.id)
        .single()

    if (orderError || !order) {
        console.error("[getOrderDetails] Order error:", orderError)
        return null
    }

    // 3. (Optional) Fetch Items details if needed, but they are stored in JSONB 'items' column usually.
    // The current schema stores items in the JSONB column, so we might not need a join.

    return {
        organization: org,
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
        .select("free_shipping_enabled, free_shipping_min_amount, free_shipping_zones, default_shipping_rate")
        .eq("organization_id", org.id)
        .single()

    if (shippingError) {
        // Si no hay configuración específica, devolver valores por defecto
        return {
            free_shipping_enabled: false,
            free_shipping_min_amount: null,
            free_shipping_zones: null,
            default_shipping_rate: 0
        }
    }

    return {
        free_shipping_enabled: shippingSettings.free_shipping_enabled || false,
        free_shipping_min_amount: shippingSettings.free_shipping_min_amount,
        free_shipping_zones: shippingSettings.free_shipping_zones || null,
        default_shipping_rate: shippingSettings.default_shipping_rate ?? 0
    }
}
