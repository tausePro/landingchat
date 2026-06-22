import { logger } from "@/lib/logger"
import {
    PRODUCT_WITH_VARIANTS_VARIANT_SELECT,
    normalizeVariantRow,
} from "@/lib/commerce/getProductWithVariants"
import {
    findVariantBySelectedOptions,
    selectDefaultVariant,
} from "@/lib/commerce/productWithVariants"
import { getVariantPriceRange, findApplicableTier } from "@/lib/commerce/variantPricing"
import type { PriceTier } from "@/types/product"
import { calculateCouponDiscount, type CouponMetadata, type CartItemForCoupon } from "@/lib/utils/coupon"
import { getShippingAvailability } from "@/lib/utils/shipping"
import {
    ApplyDiscountSchema,
    CreatePaymentLinkSchema,
    GetShippingOptionsSchema,
    RenderCheckoutSummarySchema,
} from "@/lib/ai/tools"
import type { ToolHandler } from "./types"
import type { ProductVariantRow } from "@/types/product"
import {
    appendStorefrontAccessParam,
    createStorefrontOrderAccessToken,
} from "@/lib/storefrontAccess"
import { getProviderInfo } from "@/lib/payments/registry"
import { paymentService } from "@/lib/payments/payment-service"

const log = logger("ai/tool-executor")

interface ProductSearchRow {
    id: string
    name: string
    description: string | null
    price: number
    sale_price: number | null
    image_url: string | null
    images: string[]
    stock: number
    categories: string[]
    variants: unknown[]
}

interface AiCartLineItem {
    id: string
    product_id: string
    variant_id: string | null
    variant_title: string | null
    name: string
    product_name: string
    price: number
    unit_price: number
    compare_at_price: number | null
    image_url: string | null
    quantity: number
    categories?: string[]
}

interface AgentVariantSummary {
    variant_id: string
    title: string
    sku: string | null
    price: number
    compare_at_price: number | null
    stock: number
    available: boolean
    option_values: ProductVariantRow["option_values"]
}

interface AgentVariantOptionSummary {
    name: string
    values: string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null
    }

    return value as Record<string, unknown>
}

function parseFiniteNumber(value: unknown): number | null {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null
    }

    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
    }

    return null
}

function parseStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return []
    }

    return value.filter((item): item is string => typeof item === "string")
}

function normalizeProductSearchRow(value: unknown): ProductSearchRow | null {
    const record = asRecord(value)

    if (!record) {
        return null
    }

    const id = typeof record.id === "string" ? record.id : null
    const name = typeof record.name === "string" ? record.name : null
    const price = parseFiniteNumber(record.price)
    const stock = parseFiniteNumber(record.stock)

    if (!id || !name || price == null || stock == null) {
        return null
    }

    return {
        id,
        name,
        description: typeof record.description === "string" ? record.description : null,
        price,
        sale_price: parseFiniteNumber(record.sale_price),
        image_url: typeof record.image_url === "string" ? record.image_url : null,
        images: parseStringArray(record.images),
        stock,
        categories: parseStringArray(record.categories),
        variants: Array.isArray(record.variants) ? record.variants : [],
    }
}

function groupVariantsByProductId(variants: ProductVariantRow[]): Map<string, ProductVariantRow[]> {
    return variants.reduce((groups, variant) => {
        const productVariants = groups.get(variant.product_id) ?? []
        productVariants.push(variant)
        groups.set(variant.product_id, productVariants)
        return groups
    }, new Map<string, ProductVariantRow[]>())
}

function buildAgentAvailableVariants(variants: ProductVariantRow[]): AgentVariantSummary[] {
    return variants.map((variant) => ({
        variant_id: variant.id,
        title: variant.title,
        sku: variant.sku,
        price: variant.price,
        compare_at_price: variant.compare_at_price,
        stock: Math.max(0, variant.stock_quantity),
        available: variant.stock_quantity > 0,
        option_values: variant.option_values,
    }))
}

function buildAgentVariantOptions(variants: ProductVariantRow[]): AgentVariantOptionSummary[] {
    const optionValues = new Map<string, Set<string>>()

    for (const variant of variants) {
        for (const optionValue of variant.option_values) {
            const values = optionValues.get(optionValue.option_name) ?? new Set<string>()
            values.add(optionValue.value)
            optionValues.set(optionValue.option_name, values)
        }
    }

    if (optionValues.size === 0) {
        const titles = variants
            .map((variant) => variant.title.trim())
            .filter((title) => title.length > 0 && removeAccents(title) !== "default")

        if (titles.length === 0) {
            return []
        }

        return [{ name: "Variante", values: Array.from(new Set(titles)) }]
    }

    return Array.from(optionValues.entries()).map(([name, values]) => ({
        name,
        values: Array.from(values),
    }))
}

async function getSellableVariantsForProducts(
    supabase: Parameters<ToolHandler>[0],
    organizationId: string,
    productIds: string[],
): Promise<Map<string, ProductVariantRow[]>> {
    if (productIds.length === 0) {
        return new Map()
    }

    const { data, error } = await supabase
        .from("product_variants")
        .select(PRODUCT_WITH_VARIANTS_VARIANT_SELECT)
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .in("product_id", productIds)

    if (error) {
        log.warn("Error fetching product variants for search", { organizationId, error: error.message })
        return new Map()
    }

    return groupVariantsByProductId(
        (data || []).map((variant) => normalizeVariantRow(variant)).filter((variant) => variant.is_active),
    )
}

export function resolveAgentSearchProduct(product: ProductSearchRow, variants: ProductVariantRow[]) {
    const defaultVariant = selectDefaultVariant(variants)
    const priceRange = getVariantPriceRange(variants)
    const unitPrice = defaultVariant?.price ?? product.sale_price ?? product.price
    const compareAtPrice = defaultVariant?.compare_at_price ?? (product.sale_price ? product.price : null)
    const stock = variants.length > 0
        ? variants.reduce((sum, variant) => sum + Math.max(0, variant.stock_quantity), 0)
        : product.stock

    return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: unitPrice,
        originalPrice: compareAtPrice && compareAtPrice > unitPrice ? compareAtPrice : undefined,
        onSale: Boolean(compareAtPrice && compareAtPrice > unitPrice),
        price_range: priceRange,
        image_url: defaultVariant?.image_url || product.image_url || product.images[0],
        stock,
        available: stock > 0,
        hasVariants: variants.length > 1 || product.variants.length > 0,
        default_variant_id: defaultVariant?.id ?? null,
        default_variant_title: defaultVariant?.title ?? null,
        variant_options: buildAgentVariantOptions(variants),
        available_variants: buildAgentAvailableVariants(variants),
    }
}

export function normalizeAiCartLineItem(value: unknown): AiCartLineItem | null {
    const record = asRecord(value)

    if (!record) {
        return null
    }

    const productId = typeof record.product_id === "string"
        ? record.product_id
        : typeof record.id === "string"
            ? record.id
            : null
    const name = typeof record.product_name === "string"
        ? record.product_name
        : typeof record.name === "string"
            ? record.name
            : null
    const unitPrice = parseFiniteNumber(record.unit_price) ?? parseFiniteNumber(record.price)
    const quantity = parseFiniteNumber(record.quantity)

    if (!productId || !name || unitPrice == null || quantity == null) {
        return null
    }

    const variantId = typeof record.variant_id === "string" ? record.variant_id : null
    const id = variantId ?? (typeof record.id === "string" ? record.id : productId)

    return {
        id,
        product_id: productId,
        variant_id: variantId,
        variant_title: typeof record.variant_title === "string" ? record.variant_title : null,
        name,
        product_name: name,
        price: unitPrice,
        unit_price: unitPrice,
        compare_at_price: parseFiniteNumber(record.compare_at_price),
        image_url: typeof record.image_url === "string" ? record.image_url : null,
        quantity: Math.max(1, Math.trunc(quantity)),
        categories: parseStringArray(record.categories),
    }
}

function normalizeAiCartLineItems(value: unknown): AiCartLineItem[] {
    if (!Array.isArray(value)) {
        return []
    }

    return value.flatMap((item) => {
        const normalizedItem = normalizeAiCartLineItem(item)
        return normalizedItem ? [normalizedItem] : []
    })
}

function calculateCartSubtotal(items: AiCartLineItem[]): number {
    return items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0)
}

function calculateCartQuantity(items: AiCartLineItem[]): number {
    return items.reduce((sum, item) => sum + item.quantity, 0)
}

function removeAccents(str: string): string {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

async function getSellableVariants(
    supabase: Parameters<ToolHandler>[0],
    organizationId: string,
    productId: string,
): Promise<ProductVariantRow[]> {
    const { data, error } = await supabase
        .from("product_variants")
        .select(PRODUCT_WITH_VARIANTS_VARIANT_SELECT)
        .eq("product_id", productId)
        .eq("organization_id", organizationId)

    if (error) {
        log.warn("Error fetching product variants", { productId, organizationId, error: error.message })
        return []
    }

    return (data || []).map((variant) => normalizeVariantRow(variant)).filter((variant) => variant.is_active)
}

function findVariantByHint(
    variants: ProductVariantRow[],
    variantHint?: string,
): ProductVariantRow | null {
    if (!variantHint) {
        return selectDefaultVariant(variants)
    }

    const normalizedHint = removeAccents(variantHint).trim()

    if (!normalizedHint) {
        return selectDefaultVariant(variants)
    }

    const exactTitleMatch = variants.find((variant) => removeAccents(variant.title) === normalizedHint)

    if (exactTitleMatch) {
        return exactTitleMatch
    }

    const exactValueMatches = variants.filter((variant) => {
        return variant.option_values.some((optionValue) => removeAccents(optionValue.value) === normalizedHint)
    })

    if (exactValueMatches.length === 1) {
        return exactValueMatches[0]
    }

    const partialTitleMatch = variants.find((variant) => {
        const normalizedTitle = removeAccents(variant.title)
        return normalizedTitle.includes(normalizedHint) || normalizedHint.includes(normalizedTitle)
    })

    if (partialTitleMatch) {
        return partialTitleMatch
    }

    return null
}

function resolveVariantFromInput(
    variants: ProductVariantRow[],
    variantInput: unknown,
): ProductVariantRow | null {
    if (typeof variantInput === "string") {
        return findVariantByHint(variants, variantInput)
    }

    if (variantInput && typeof variantInput === "object" && !Array.isArray(variantInput)) {
        const selectedOptions = Object.fromEntries(
            Object.entries(variantInput).filter((entry): entry is [string, string] => {
                return typeof entry[0] === "string" && typeof entry[1] === "string"
            }),
        )

        return findVariantBySelectedOptions(variants, selectedOptions)
    }

    return selectDefaultVariant(variants)
}

function resolveLegacyVariantImage(
    legacyVariants: unknown,
    selectedVariant: ProductVariantRow | null,
    variantInput: unknown,
): string | null {
    if (!Array.isArray(legacyVariants)) {
        return null
    }

    const candidateValues = new Set<string>()

    if (selectedVariant) {
        candidateValues.add(selectedVariant.title)
        for (const optionValue of selectedVariant.option_values) {
            candidateValues.add(optionValue.value)
        }
    }

    if (typeof variantInput === "string") {
        candidateValues.add(variantInput)
    } else {
        const variantInputRecord = asRecord(variantInput)
        if (variantInputRecord) {
            for (const value of Object.values(variantInputRecord)) {
                if (typeof value === "string") {
                    candidateValues.add(value)
                }
            }
        }
    }

    const normalizedCandidateValues = Array.from(candidateValues).map((value) => removeAccents(value))

    for (const legacyVariant of legacyVariants) {
        const variantRecord = asRecord(legacyVariant)
        const imagesRecord = asRecord(variantRecord?.images)

        if (!imagesRecord) {
            continue
        }

        for (const [value, imageValue] of Object.entries(imagesRecord)) {
            if (!normalizedCandidateValues.includes(removeAccents(value))) {
                continue
            }

            if (typeof imageValue === "string" && imageValue.length > 0) {
                return imageValue
            }

            if (Array.isArray(imageValue)) {
                const firstImage = imageValue.find((item): item is string => typeof item === "string" && item.length > 0)
                if (firstImage) {
                    return firstImage
                }
            }
        }
    }

    return null
}

function resolveCatalogPricing(input: {
    price: number
    sale_price: number | null
    defaultVariant?: ProductVariantRow | null
}): { price: number; sale_price: number | null } {
    const { price, sale_price, defaultVariant } = input

    if (
        defaultVariant?.compare_at_price != null
        && defaultVariant.compare_at_price > defaultVariant.price
    ) {
        return {
            price: defaultVariant.compare_at_price,
            sale_price: defaultVariant.price,
        }
    }

    if (defaultVariant) {
        return {
            price: defaultVariant.price,
            sale_price: null,
        }
    }

    if (sale_price != null && sale_price < price) {
        return {
            price,
            sale_price,
        }
    }

    return {
        price: sale_price ?? price,
        sale_price: null,
    }
}

interface SearchProductsRpcRow {
    product_id: string
    rank: number | null
    similarity: number | null
}

// ─── Precios por cantidad (fix 2026-06-12, reporte Goldcaps) ─────────
// El agente cotizaba 20 unidades al precio detal porque ni los tools ni el
// carrito conocían los price_tiers (solo el contexto de PDP los tenía).

interface QuantityPricingInfo {
    tiers: PriceTier[]
    minimum_quantity: number | null
    note: string
}

/** Normaliza price_tiers del JSONB y arma la nota instructiva para el modelo. */
function getQuantityPricing(product: {
    has_quantity_pricing?: unknown
    price_tiers?: unknown
    minimum_quantity?: unknown
}): QuantityPricingInfo | null {
    if (!product.has_quantity_pricing || !Array.isArray(product.price_tiers)) return null

    const tiers = product.price_tiers.flatMap((raw): PriceTier[] => {
        const record = asRecord(raw)
        if (!record) return []
        const minQuantity = parseFiniteNumber(record.min_quantity)
        const unitPrice = parseFiniteNumber(record.unit_price)
        if (minQuantity == null || unitPrice == null) return []
        return [{
            min_quantity: minQuantity,
            max_quantity: parseFiniteNumber(record.max_quantity),
            unit_price: unitPrice,
            label: typeof record.label === "string" ? record.label : undefined,
        } as PriceTier]
    })
    if (tiers.length === 0) return null

    const minimumQuantity = parseFiniteNumber(product.minimum_quantity)
    const ranges = tiers
        .map((tier) => `${tier.min_quantity}${tier.max_quantity ? `-${tier.max_quantity}` : "+"} unidades: $${tier.unit_price.toLocaleString("es-CO")}/u${tier.label ? ` (${tier.label})` : ""}`)
        .join("; ")

    return {
        tiers,
        minimum_quantity: minimumQuantity && minimumQuantity > 1 ? minimumQuantity : null,
        note: `PRECIO POR CANTIDAD: ${ranges}. SIEMPRE pregunta la cantidad antes de cotizar y usa el precio unitario del rango correspondiente.`,
    }
}

/** Precio unitario tier-aware: precio explícito de variante > tier por cantidad > sale/base. */
function resolveTierAwareUnitPrice(params: {
    variantPrice: number | null | undefined
    quantityPricing: QuantityPricingInfo | null
    quantity: number
    salePrice: number | null
    basePrice: number
}): number {
    if (params.variantPrice != null) return params.variantPrice
    if (params.quantityPricing) {
        const tier = findApplicableTier(params.quantityPricing.tiers, params.quantity)
        if (tier) return tier.unit_price
    }
    return params.salePrice || params.basePrice
}

const searchProducts: ToolHandler = async (supabase, input, context) => {
    const { query, category, max_price, limit = 15 } = input
    const maxPrice = parseFiniteNumber(max_price)
    const trimmedQuery = typeof query === "string" ? query.trim() : ""

    // Cuando hay query textual delegamos en el RPC `search_products`, que ya
    // resuelve accent + case-insensitive (f_unaccent + websearch_to_tsquery
    // 'spanish') con fallback fuzzy via pg_trgm. Antes el executor usaba
    // `ilike '%word%'` con removeAccents() solo sobre el query, lo que dejaba
    // productos acentuados (ej. "RENOVACIÓN") sin matchear. Es el mismo path
    // que usa el storefront via listProductsBySearch (lib/commerce/
    // listProductsWithVariants.ts).
    let candidateIds: string[] | null = null

    if (trimmedQuery.length >= 1) {
        const { data: rpcData, error: rpcError } = await supabase.rpc("search_products", {
            p_organization_id: context.organizationId,
            p_query: trimmedQuery,
            p_min_price: null,
            p_max_price: null,
            p_categories: category ? [category] : null,
            p_limit: limit,
        })

        if (rpcError) {
            return { success: false, error: rpcError.message }
        }

        const rpcRows = Array.isArray(rpcData) ? (rpcData as SearchProductsRpcRow[]) : []
        candidateIds = rpcRows
            .map((row) => (typeof row.product_id === "string" ? row.product_id : null))
            .filter((id): id is string => id !== null)

        if (candidateIds.length === 0) {
            return {
                success: true,
                data: { products: [], totalFound: 0 },
            }
        }
    }

    let dbQuery = supabase
        .from("products")
        .select("id, name, description, price, sale_price, image_url, images, stock, categories, variants, has_quantity_pricing, price_tiers, minimum_quantity")
        .eq("organization_id", context.organizationId)
        .eq("is_active", true)

    if (candidateIds) {
        dbQuery = dbQuery.in("id", candidateIds)
    } else {
        // Modo browse (sin texto): orden por stock como antes.
        dbQuery = dbQuery.order("stock", { ascending: false })
    }

    if (category) {
        dbQuery = dbQuery.contains("categories", [category])
    }

    const { data: products, error } = await dbQuery.limit(limit)

    if (error) {
        return { success: false, error: error.message }
    }

    // Preservar el orden de relevancia que retorna el RPC. El `select().in(...)`
    // no garantiza orden, así que reordenamos manualmente.
    const relevanceIndex = candidateIds
        ? new Map(candidateIds.map((id, idx) => [id, idx]))
        : null

    const productRows = (products || []).flatMap((product) => {
        const normalizedProduct = normalizeProductSearchRow(product)
        return normalizedProduct ? [normalizedProduct] : []
    })

    if (relevanceIndex) {
        productRows.sort((a, b) => {
            const ai = relevanceIndex.get(a.id) ?? Number.POSITIVE_INFINITY
            const bi = relevanceIndex.get(b.id) ?? Number.POSITIVE_INFINITY
            return ai - bi
        })
    }

    // Tiers por producto (fix Goldcaps): el agente debe verlos en el resultado
    const quantityPricingById = new Map<string, QuantityPricingInfo>()
    for (const raw of products || []) {
        const record = asRecord(raw)
        const rawId = record && typeof record.id === "string" ? record.id : null
        const pricing = record ? getQuantityPricing(record) : null
        if (rawId && pricing) quantityPricingById.set(rawId, pricing)
    }

    const variantsByProductId = await getSellableVariantsForProducts(
        supabase,
        context.organizationId,
        productRows.map((product) => product.id),
    )
    const resolvedProducts = productRows
        .map((product) => ({
            ...resolveAgentSearchProduct(product, variantsByProductId.get(product.id) ?? []),
            quantity_pricing: quantityPricingById.get(product.id) ?? null,
        }))
        .filter((product) => {
            if (maxPrice == null) {
                return true
            }

            if (product.price_range.has_range) {
                return product.price_range.min_price <= maxPrice
            }

            return product.price <= maxPrice
        })

    return {
        success: true,
        data: {
            products: resolvedProducts,
            totalFound: resolvedProducts.length
        }
    }
}

const showProduct: ToolHandler = async (supabase, input, context) => {
    const { product_id } = input

    const { data: product, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", product_id)
        .eq("organization_id", context.organizationId)
        .single()

    if (error || !product) {
        return { success: false, error: "Producto no encontrado" }
    }

    const variants = await getSellableVariants(supabase, context.organizationId, product.id)
    const defaultVariant = selectDefaultVariant(variants)
    const resolvedStock = variants.length > 0
        ? variants.reduce((sum, variant) => sum + Math.max(0, variant.stock_quantity), 0)
        : product.stock
    const pricing = resolveCatalogPricing({
        price: product.price,
        sale_price: product.sale_price,
        defaultVariant,
    })

    return {
        success: true,
        data: {
            product: {
                id: product.id,
                name: product.name,
                description: product.description,
                price: pricing.price,
                sale_price: pricing.sale_price,
                image_url: defaultVariant?.image_url || product.image_url || product.images?.[0] || "",
                images: product.images || [],
                stock: resolvedStock,
                available: resolvedStock > 0,
                categories: product.categories || [],
                variants: variants,
                default_variant_id: defaultVariant?.id ?? null,
                default_variant_title: defaultVariant?.title ?? null,
                default_variant_compare_at_price: defaultVariant?.compare_at_price ?? null,
                default_variant_stock: defaultVariant?.stock_quantity ?? null,
                variant_options: buildAgentVariantOptions(variants),
                available_variants: buildAgentAvailableVariants(variants),
                quantity_pricing: getQuantityPricing(product),
            }
        }
    }
}

const getProductAvailability: ToolHandler = async (supabase, input, context) => {
    const { product_id } = input

    const { data: product, error } = await supabase
        .from("products")
        .select("name, stock, variants")
        .eq("id", product_id)
        .eq("organization_id", context.organizationId)
        .single()

    if (error || !product) {
        return { success: false, error: "Producto no encontrado" }
    }

    const variants = await getSellableVariants(supabase, context.organizationId, product_id)

    if (variants.length > 0) {
        const quantity = variants.reduce((sum, variant) => sum + Math.max(0, variant.stock_quantity), 0)

        return {
            success: true,
            data: {
                available: quantity > 0,
                quantity,
                productName: product.name,
                variants: variants.map((variant) => ({
                    variant_id: variant.id,
                    title: variant.title,
                    sku: variant.sku,
                    quantity: Math.max(0, variant.stock_quantity),
                    available: variant.stock_quantity > 0,
                    option_values: variant.option_values,
                    price: variant.price,
                    compare_at_price: variant.compare_at_price,
                })),
                variant_options: buildAgentVariantOptions(variants),
                available_variants: buildAgentAvailableVariants(variants),
                note: "Este producto tiene inventario por variante. Verifica disponibilidad de la variante específica antes de agregar al carrito."
            }
        }
    }

    return {
        success: true,
        data: {
            available: product.stock > 0,
            quantity: product.stock,
            productName: product.name,
        }
    }
}

const addToCart: ToolHandler = async (supabase, input, context) => {
    const { product_id, quantity = 1, variant } = input

    const { data: product, error: productError } = await supabase
        .from("products")
        .select("id, name, price, sale_price, image_url, stock, variants, has_quantity_pricing, price_tiers, minimum_quantity")
        .eq("id", product_id)
        .eq("organization_id", context.organizationId)
        .single()

    if (productError || !product) {
        return { success: false, error: "Producto no encontrado" }
    }

    const sellableVariants = await getSellableVariants(supabase, context.organizationId, product.id)
    const selectedVariant = resolveVariantFromInput(sellableVariants, variant)

    if (sellableVariants.length > 0 && variant && !selectedVariant) {
        return {
            success: false,
            error: `No encontré una variante válida para ${product.name}.`
        }
    }

    if (selectedVariant && selectedVariant.stock_quantity < quantity) {
        return {
            success: false,
            error: selectedVariant.stock_quantity === 0
                ? `${product.name} en la variante "${selectedVariant.title}" está agotado.`
                : `Solo hay ${selectedVariant.stock_quantity} unidades de ${product.name} en la variante "${selectedVariant.title}".`
        }
    }

    if (sellableVariants.length === 0 && variant && product.variants && Array.isArray(product.variants)) {
        for (const v of product.variants) {
            if (v.hasStockByVariant && v.stockByVariant) {
                const variantValue = typeof variant === "string" ? variant : variant[v.type]
                if (variantValue && variantValue in v.stockByVariant) {
                    const available = v.stockByVariant[variantValue] as number
                    if (available < quantity) {
                        return {
                            success: false,
                            error: available === 0
                                ? `${product.name} en ${v.type} "${variantValue}" está agotado.`
                                : `Solo hay ${available} unidades de ${product.name} en ${v.type} "${variantValue}".`
                        }
                    }
                }
            }
        }
    }

    if (sellableVariants.length === 0 && product.stock < quantity) {
        return {
            success: false,
            error: `Solo hay ${product.stock} unidades disponibles de ${product.name}`
        }
    }

    let { data: cart } = await supabase
        .from("carts")
        .select("*")
        .eq("chat_id", context.chatId)
        .eq("status", "active")
        .single()

    if (!cart) {
        const { data: newCart, error: cartError } = await supabase
            .from("carts")
            .insert({
                organization_id: context.organizationId,
                chat_id: context.chatId,
                customer_id: context.customerId || null,
                items: [],
                status: "active"
            })
            .select()
            .single()

        if (cartError) {
            return { success: false, error: "Error creando carrito" }
        }
        cart = newCart
    }

    const items = normalizeAiCartLineItems(cart.items)
    const lineId = selectedVariant?.id ?? product.id
    const existingIndex = items.findIndex((item) => item.id === lineId)

    // Precio tier-aware (fix Goldcaps): el unitario se resuelve con la
    // cantidad TOTAL del line item (existente + nueva) — agregar 8 y luego
    // 12 debe cruzar al precio por mayor, no quedarse en el detal
    const totalQuantity = existingIndex >= 0 ? items[existingIndex].quantity + quantity : quantity
    const quantityPricing = getQuantityPricing(product)

    if (quantityPricing?.minimum_quantity && totalQuantity < quantityPricing.minimum_quantity) {
        return {
            success: false,
            error: `Este producto tiene una cantidad mínima de pedido de ${quantityPricing.minimum_quantity} unidades. Informa al cliente y ajusta la cantidad.`,
        }
    }

    const unitPrice = resolveTierAwareUnitPrice({
        variantPrice: selectedVariant?.price,
        quantityPricing,
        quantity: totalQuantity,
        salePrice: product.sale_price,
        basePrice: product.price,
    })
    const compareAtPrice = selectedVariant?.compare_at_price ?? (product.sale_price ? product.price : null)
    const imageUrl = resolveLegacyVariantImage(product.variants, selectedVariant, variant) || selectedVariant?.image_url || product.image_url

    if (existingIndex >= 0) {
        const currentItem = items[existingIndex]
        items[existingIndex] = {
            ...currentItem,
            id: lineId,
            product_id: product.id,
            product_name: product.name,
            name: product.name,
            variant_id: selectedVariant?.id ?? null,
            variant_title: selectedVariant?.title ?? null,
            price: unitPrice,
            unit_price: unitPrice,
            compare_at_price: compareAtPrice,
            image_url: imageUrl,
            quantity: currentItem.quantity + quantity,
        }
    } else {
        items.push({
            id: lineId,
            product_id: product.id,
            product_name: product.name,
            variant_id: selectedVariant?.id ?? null,
            variant_title: selectedVariant?.title ?? null,
            name: product.name,
            price: unitPrice,
            unit_price: unitPrice,
            compare_at_price: compareAtPrice,
            image_url: imageUrl,
            quantity,
        })
    }

    const { error: updateError } = await supabase
        .from("carts")
        .update({
            items,
            updated_at: new Date().toISOString()
        })
        .eq("id", cart.id)

    if (updateError) {
        return { success: false, error: "Error actualizando carrito" }
    }

    const total = calculateCartSubtotal(items)

    return {
        success: true,
        data: {
            added: {
                product_id: product.id,
                variant_id: selectedVariant?.id ?? null,
                variant_title: selectedVariant?.title ?? null,
                name: product.name,
                quantity,
                price: unitPrice,
                compare_at_price: compareAtPrice,
                image_url: imageUrl,
                onSale: compareAtPrice != null && compareAtPrice > unitPrice
            },
            cart: {
                itemCount: items.length,
                totalItems: calculateCartQuantity(items),
                total
            }
        }
    }
}

const getCart: ToolHandler = async (supabase, _input, context) => {
    const { data: cart } = await supabase
        .from("carts")
        .select("*")
        .eq("chat_id", context.chatId)
        .eq("status", "active")
        .single()

    const items = normalizeAiCartLineItems(cart?.items)

    if (!cart || items.length === 0) {
        return {
            success: true,
            data: {
                isEmpty: true,
                items: [],
                total: 0
            }
        }
    }

    const total = calculateCartSubtotal(items)

    return {
        success: true,
        data: {
            isEmpty: false,
            items,
            itemCount: items.length,
            totalItems: calculateCartQuantity(items),
            total
        }
    }
}

const removeFromCart: ToolHandler = async (supabase, input, context) => {
    const { product_id } = input

    const { data: cart } = await supabase
        .from("carts")
        .select("*")
        .eq("chat_id", context.chatId)
        .eq("status", "active")
        .single()

    if (!cart) {
        return { success: false, error: "No hay carrito activo" }
    }

    const currentItems = normalizeAiCartLineItems(cart.items)
    const items = currentItems.filter((item) => item.product_id !== product_id)
    const removedItem = currentItems.find((item) => item.product_id === product_id)

    await supabase
        .from("carts")
        .update({ items, updated_at: new Date().toISOString() })
        .eq("id", cart.id)

    return {
        success: true,
        data: {
            removed: removedItem?.name || "Producto",
            remainingItems: items.length
        }
    }
}

const updateCartQuantity: ToolHandler = async (supabase, input, context) => {
    const { product_id, quantity } = input

    const { data: cart } = await supabase
        .from("carts")
        .select("*")
        .eq("chat_id", context.chatId)
        .eq("status", "active")
        .single()

    if (!cart) {
        return { success: false, error: "No hay carrito activo" }
    }

    // Tier-aware (fix Goldcaps): al cambiar la cantidad el unitario debe
    // recalcularse (8 → 20 unidades cruza al precio por mayor). Solo aplica
    // a líneas cuya variante NO tiene precio explícito propio.
    let tierUnitPrice: number | null = null
    let variantsWithOwnPrice = new Set<string>()
    if (typeof quantity === "number" && quantity > 0) {
        const { data: product } = await supabase
            .from("products")
            .select("price, sale_price, variants, has_quantity_pricing, price_tiers")
            .eq("id", product_id)
            .eq("organization_id", context.organizationId)
            .single()

        const quantityPricing = product ? getQuantityPricing(product) : null
        if (product && quantityPricing) {
            tierUnitPrice = resolveTierAwareUnitPrice({
                variantPrice: null,
                quantityPricing,
                quantity,
                salePrice: product.sale_price,
                basePrice: product.price,
            })
            variantsWithOwnPrice = new Set(
                (Array.isArray(product.variants) ? product.variants : []).flatMap((raw) => {
                    const record = asRecord(raw)
                    const variantId = record && typeof record.id === "string" ? record.id : null
                    return variantId && parseFiniteNumber(record?.price) != null ? [variantId] : []
                })
            )
        }
    }

    const items = normalizeAiCartLineItems(cart.items).map((item) => {
        if (item.product_id === product_id) {
            const keepsVariantPrice = item.variant_id != null && variantsWithOwnPrice.has(item.variant_id)
            const nextPrice = tierUnitPrice != null && !keepsVariantPrice ? tierUnitPrice : item.price
            return { ...item, quantity, price: nextPrice, unit_price: nextPrice }
        }
        return item
    }).filter((item) => item.quantity > 0)

    await supabase
        .from("carts")
        .update({ items, updated_at: new Date().toISOString() })
        .eq("id", cart.id)

    const total = calculateCartSubtotal(items)

    return {
        success: true,
        data: {
            cart: { items, total }
        }
    }
}

const startCheckout: ToolHandler = async (supabase, _input, context) => {
    const { data: cart } = await supabase
        .from("carts")
        .select("*")
        .eq("chat_id", context.chatId)
        .eq("status", "active")
        .single()

    const items = normalizeAiCartLineItems(cart?.items)

    if (!cart || items.length === 0) {
        return {
            success: false,
            error: "El carrito está vacío"
        }
    }

    const subtotal = calculateCartSubtotal(items)

    return {
        success: true,
        data: {
            readyForCheckout: true,
            summary: {
                items,
                subtotal,
                shipping: "Por calcular",
                total: subtotal
            },
            nextStep: "El cliente debe proporcionar dirección de envío y método de pago"
        }
    }
}

const getShippingOptions: ToolHandler = async (supabase, input, context) => {
    const { city } = GetShippingOptionsSchema.parse(input)

    const { data: shippingSettings } = await supabase
        .from("shipping_settings")
        .select("*")
        .eq("organization_id", context.organizationId)
        .single()

    const defaultRate = Number(shippingSettings?.default_shipping_rate) || 0
    const freeShippingEnabled = shippingSettings?.free_shipping_enabled || false
    const freeShippingMinAmount = Number(shippingSettings?.free_shipping_min_amount) || 0
    const freeShippingZones: string[] = shippingSettings?.free_shipping_zones || []
    const estimatedDays = shippingSettings?.estimated_delivery_days || 3

    const options: Array<{ id: string; name: string; price: number; days: string }> = []

    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    const cityNorm = normalize(city || "")
    const hasZones = freeShippingZones.length > 0
    const cityMatchesZone = !hasZones || freeShippingZones.some((zone: string) =>
        cityNorm.includes(normalize(zone))
    )

    const { data: cart } = await supabase
        .from("carts")
        .select("items")
        .eq("chat_id", context.chatId)
        .eq("status", "active")
        .single()
    const subtotal = calculateCartSubtotal(normalizeAiCartLineItems(cart?.items))
    const meetsFreeShippingMinimum = !freeShippingMinAmount || subtotal >= freeShippingMinAmount
    const remainingForFreeShipping = meetsFreeShippingMinimum ? 0 : freeShippingMinAmount - subtotal

    if (hasZones && !cityMatchesZone && defaultRate === 0) {
        return {
            success: true,
            data: {
                available: false,
                options: [],
                city,
                message: `Por el momento solo realizamos envíos a ${freeShippingZones.join(", ")}. Pronto llegaremos a más ciudades.`,
                availableZones: freeShippingZones
            }
        }
    }

    if (freeShippingEnabled && cityMatchesZone && meetsFreeShippingMinimum) {
        options.push({
            id: "free",
            name: "Envío Gratis",
            price: 0,
            days: `${estimatedDays}-${estimatedDays + 2} días hábiles`
        })
    }

    if (defaultRate > 0 && (!cityMatchesZone || !freeShippingEnabled || !meetsFreeShippingMinimum)) {
        options.push({
            id: "standard",
            name: "Envío Estándar",
            price: defaultRate,
            days: `${estimatedDays}-${estimatedDays + 2} días hábiles`
        })
    }

    if (options.length === 0) {
        options.push({
            id: "standard",
            name: "Envío Estándar",
            price: 0,
            days: `${estimatedDays}-${estimatedDays + 2} días hábiles`
        })
    }

    return {
        success: true,
        data: {
            available: true,
            options,
            city,
            subtotal,
            freeShippingEnabled,
            freeShippingMinAmount,
            meetsFreeShippingMinimum,
            remainingForFreeShipping,
            freeShippingZones
        }
    }
}

const applyDiscount: ToolHandler = async (supabase, input, context) => {
    const { code } = ApplyDiscountSchema.parse(input)

    const { data: coupon, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("organization_id", context.organizationId)
        .eq("code", code.toUpperCase())
        .eq("is_active", true)
        .single()

    if (error || !coupon) {
        return { success: false, error: "Código de descuento inválido o expirado" }
    }

    const now = new Date()

    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
        return { success: false, error: "Este código aún no está vigente" }
    }

    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
        return { success: false, error: "Este código ha expirado" }
    }

    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
        return { success: false, error: "Este código ya alcanzó su límite de usos" }
    }

    const { data: cart } = await supabase
        .from("carts")
        .select("items")
        .eq("chat_id", context.chatId)
        .eq("status", "active")
        .single()

    const items = normalizeAiCartLineItems(cart?.items)

    if (items.length === 0) {
        return { success: false, error: "El carrito está vacío. Agrega productos antes de aplicar un cupón." }
    }

    const subtotal = calculateCartSubtotal(items)

    if (coupon.min_purchase_amount && subtotal < Number(coupon.min_purchase_amount)) {
        return {
            success: false,
            error: `Este código requiere una compra mínima de $${Number(coupon.min_purchase_amount).toLocaleString()}`
        }
    }

    let cartItems: CartItemForCoupon[] = items.map((item) => ({
        id: item.product_id,
        price: item.unit_price,
        quantity: item.quantity,
        categories: item.categories ?? []
    }))

    if (coupon.applies_to === "categories" && coupon.target_ids?.length) {
        const productIds = cartItems.map((i: CartItemForCoupon) => i.id)
        const { data: products } = await supabase
            .from("products")
            .select("id, categories")
            .in("id", productIds)

        if (products) {
            const catMap = new Map<string, string[]>(
                products.flatMap((product) => {
                    const record = asRecord(product)

                    if (!record || typeof record.id !== "string") {
                        return []
                    }

                    return [[record.id, parseStringArray(record.categories)]]
                }),
            )
            cartItems = cartItems.map((item: CartItemForCoupon) => ({
                ...item,
                categories: catMap.get(item.id) || []
            }))
        }
    }

    const couponMeta: CouponMetadata = {
        code: coupon.code,
        type: coupon.type,
        value: Number(coupon.value),
        maxDiscountAmount: coupon.max_discount_amount ? Number(coupon.max_discount_amount) : null,
        freeShipping: coupon.type === "free_shipping",
        appliesTo: coupon.applies_to || "all",
        targetIds: coupon.target_ids || null
    }

    if (coupon.type === "free_shipping") {
        return {
            success: true,
            data: {
                code: coupon.code,
                type: "free_shipping",
                value: 0,
                discountAmount: 0,
                maxDiscountAmount: null,
                freeShipping: true,
                message: `¡Cupón ${coupon.code} aplicado! Envío gratis en tu compra.`,
                newTotal: subtotal
            }
        }
    }

    const discountAmount = calculateCouponDiscount(couponMeta, subtotal, cartItems)

    if (discountAmount === 0 && coupon.applies_to !== "all") {
        return {
            success: false,
            error: `Este cupón aplica solo a ${coupon.applies_to === "products" ? "productos" : "categorías"} específicos que no están en tu carrito.`
        }
    }

    return {
        success: true,
        data: {
            code: coupon.code,
            type: coupon.type,
            value: Number(coupon.value),
            discountAmount,
            maxDiscountAmount: coupon.max_discount_amount ? Number(coupon.max_discount_amount) : null,
            freeShipping: false,
            appliesTo: coupon.applies_to || "all",
            message: `¡Cupón ${coupon.code} aplicado! Descuento de $${discountAmount.toLocaleString()}`,
            newTotal: subtotal - discountAmount
        }
    }
}

const renderCheckoutSummary: ToolHandler = async (supabase, input, context) => {
    const { message } = RenderCheckoutSummarySchema.parse(input)

    const { data: cart } = await supabase
        .from("carts")
        .select("*")
        .eq("chat_id", context.chatId)
        .eq("status", "active")
        .single()

    const items = normalizeAiCartLineItems(cart?.items)

    if (!cart || items.length === 0) {
        return {
            success: true,
            data: {
                isEmpty: true,
                ui_component: "checkout_summary",
                message: "Tu carrito está vacío. ¿Te ayudo a encontrar algo?"
            }
        }
    }

    const subtotal = calculateCartSubtotal(items)
    const itemCount = calculateCartQuantity(items)

    const { data: shippingSettings } = await supabase
        .from("shipping_settings")
        .select("*")
        .eq("organization_id", context.organizationId)
        .single()

    const freeShippingThreshold = shippingSettings?.free_shipping_min_amount || 0
    // Estimado PRE-ciudad vía el helper canónico (sin ciudad). Si hay zonas de envío
    // gratis, el helper cobra la tarifa default hasta confirmar la ciudad en
    // create_payment_link → evita prometer gratis y luego cobrar. Sin zonas, gratis por monto.
    const estimatedShipping = getShippingAvailability(shippingSettings, subtotal, undefined).cost
    const qualifiesForFreeShipping = estimatedShipping === 0

    return {
        success: true,
        data: {
            ui_component: "checkout_summary",
            message: message || "¡Excelente elección! Aquí tienes el resumen de tu pedido:",
            cart: {
                items: items.map((item) => ({
                    id: item.id,
                    product_id: item.product_id,
                    variant_id: item.variant_id,
                    variant_title: item.variant_title,
                    name: item.name,
                    price: item.unit_price,
                    compare_at_price: item.compare_at_price,
                    quantity: item.quantity,
                    image_url: item.image_url,
                    subtotal: item.unit_price * item.quantity
                })),
                itemCount,
                subtotal,
                estimatedShipping,
                freeShippingThreshold,
                qualifiesForFreeShipping,
                total: subtotal + estimatedShipping
            },
            nextStep: "shipping_form",
            instructions: "Para continuar, necesito tus datos de envío. ¿Me los puedes proporcionar?"
        }
    }
}

/**
 * Resuelve la pasarela online a usar para una org. Fuente de verdad: las
 * pasarelas configuradas + activas (payment_gateway_configs), NO el slug que
 * sugiera el agente. Usa la pedida solo si la org la tiene activa; si no, la
 * primera configurada. Devuelve null si no hay ninguna (→ ofrecer contraentrega).
 */
export function resolveOnlineGateway(configuredOnline: string[], requested: string): string | null {
    if (configuredOnline.length === 0) return null
    return configuredOnline.includes(requested) ? requested : configuredOnline[0]
}

const createPaymentLink: ToolHandler = async (supabase, input, context) => {
    const payLog = log.withContext({ chatId: context.chatId, orgId: context.organizationId })
    payLog.info("createPaymentLink starting")

    const { payment_method, customer_message } = CreatePaymentLinkSchema.parse(input)

    const { data: cart, error: cartError } = await supabase
        .from("carts")
        .select("*")
        .eq("chat_id", context.chatId)
        .eq("status", "active")
        .single()

    payLog.debug("Cart query result", { cartId: cart?.id, items: cart?.items?.length, error: cartError?.message })

    const items = normalizeAiCartLineItems(cart?.items)

    if (!cart || items.length === 0) {
        payLog.warn("No cart or empty items")
        return {
            success: false,
            error: "No hay productos en el carrito. Agrega productos antes de proceder al pago."
        }
    }

    const { data: chat } = await supabase
        .from("chats")
        .select("metadata, customer_id, channel")
        .eq("id", context.chatId)
        .single()

    payLog.debug("Chat metadata loaded", { hasShipping: !!chat?.metadata?.confirmed_shipping })

    const shippingInfo = chat?.metadata?.confirmed_shipping

    if (!shippingInfo) {
        payLog.warn("No confirmed_shipping in metadata")
        return {
            success: false,
            error: "No hay datos de envío confirmados. Usa confirm_shipping_details primero."
        }
    }

    const subtotal = calculateCartSubtotal(items)

    const { data: shippingSettings } = await supabase
        .from("shipping_settings")
        .select("*")
        .eq("organization_id", context.organizationId)
        .single()

    // Envío zone-aware vía el helper canónico (getShippingAvailability): gratis SOLO si
    // la ciudad está en zona gratis (cuando hay zonas) Y cumple el mínimo; si no, tarifa
    // default. Antes este flujo tenía una copia zone-blind que cobraba $0 fuera de zona
    // (caso real qp → Medellín). La ciudad viene de los datos de envío confirmados.
    const shippingCost = getShippingAvailability(shippingSettings, subtotal, shippingInfo.city).cost
    const total = subtotal + shippingCost

    const { data: organization } = await supabase
        .from("organizations")
        .select("id, slug, name, custom_domain")
        .eq("id", context.organizationId)
        .single()

    // Pasarelas online ACTIVAS de esta org = fuente de verdad. El agente puede
    // sugerir un slug, pero NO ofrecemos pasarelas que la org no tiene configuradas:
    // caso real (qp) — el agente generó un link de ePayco cuando qp solo tiene Wompi.
    const { data: activeGateways } = await supabase
        .from("payment_gateway_configs")
        .select("provider")
        .eq("organization_id", context.organizationId)
        .eq("is_active", true)
    const configuredOnline = (activeGateways ?? [])
        .map((g) => (g.provider ?? "").toLowerCase())
        .filter(Boolean)

    const requestedMethod = (payment_method ?? "").toLowerCase()
    const isManual = requestedMethod === "manual" || requestedMethod === "contraentrega" || requestedMethod === "cod"

    // Resolver la pasarela online real: usa la pedida SOLO si la org la tiene activa;
    // si no, la primera configurada. Sin pago en línea → guiar a contraentrega.
    let onlineProvider: string | null = null
    if (!isManual) {
        onlineProvider = resolveOnlineGateway(configuredOnline, requestedMethod)
        if (!onlineProvider) {
            payLog.warn("createPaymentLink: org sin pasarela online configurada", { requestedMethod })
            return {
                success: false,
                error: "Esta tienda no tiene pago en línea configurado. Ofrece al cliente pago contra entrega.",
            }
        }
    }
    const resolvedPaymentMethod = isManual ? "manual" : (onlineProvider as string)

    const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`

    const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
            organization_id: context.organizationId,
            customer_id: chat?.customer_id || null,
            chat_id: context.chatId,
            order_number: orderNumber,
            items: items.map((item) => ({
                product_id: item.product_id,
                product_name: item.product_name,
                name: item.name,
                unit_price: item.unit_price,
                total_price: item.unit_price * item.quantity,
                price: item.unit_price,
                quantity: item.quantity,
                variant_info: item.variant_title
                    ? {
                        variant_id: item.variant_id ?? null,
                        variant_title: item.variant_title,
                        compare_at_price: item.compare_at_price ?? null,
                    }
                    : null,
                image_url: item.image_url
            })),
            source_channel: chat?.channel || "web",
            subtotal,
            shipping_cost: shippingCost,
            total,
            status: "pending",
            payment_status: "pending",
            payment_method: resolvedPaymentMethod,
            customer_info: {
                name: shippingInfo.customer_name,
                email: shippingInfo.email || null,
                phone: shippingInfo.phone,
                address: shippingInfo.address,
                city: shippingInfo.city,
                state: shippingInfo.state || null,
                document_type: shippingInfo.document_type || "CC",
                document_number: shippingInfo.document_number,
                person_type: shippingInfo.person_type || "Natural",
                business_name: shippingInfo.business_name || null
            }
        })
        .select("id, order_number")
        .single()

    if (orderError) {
        payLog.error("Error creating order", { error: orderError.message })
        return {
            success: false,
            error: "Error al crear la orden. Por favor intenta de nuevo."
        }
    }

    if (!organization) {
        payLog.error("Organization not found for payment link", { organizationId: context.organizationId })
        return {
            success: false,
            error: "No pude resolver la tienda para generar el enlace de pago."
        }
    }

    await supabase
        .from("carts")
        .update({ status: "converted", converted_order_id: order.id })
        .eq("id", cart.id)

    const customDomain = organization?.custom_domain
    const storeBaseUrl = customDomain
        ? `https://${customDomain}`
        : `https://${organization.slug}.landingchat.co`

    const orderAccessToken = createStorefrontOrderAccessToken({
        slug: organization.slug,
        organizationId: context.organizationId,
        orderId: order.id,
        customerId: chat?.customer_id || null,
    })

    // Resolver provider de checkout según el PROVIDER_REGISTRY. Soportamos 3 modos:
    //   - "manual" / "contraentrega": muestra la página de orden con instrucciones offline.
    //   - embedded_widget (Wompi/ePayco): URL a página interna /checkout/{provider}/{orderId}
    //     que carga el widget JS del proveedor en el storefront.
    //   - hosted_redirect (Bold/Addi): paymentService.initiatePayment genera la sesión externa
    //     server-side y el cliente sale del storefront al sitio del gateway.
    let paymentUrl: string
    let paymentInstructions: string

    if (isManual) {
        paymentUrl = appendStorefrontAccessParam(`${storeBaseUrl}/order/${order.id}`, orderAccessToken)
        paymentInstructions = "Tu pedido ha sido registrado. Puedes pagar contra entrega o por transferencia."
    } else {
        const providerInfo = getProviderInfo(onlineProvider as string)

        if (!providerInfo || !providerInfo.enabled) {
            payLog.warn("Payment provider not available in registry", {
                requested: onlineProvider,
                exists: !!providerInfo,
                enabled: providerInfo?.enabled ?? false,
            })
            return {
                success: false,
                error: `El método de pago "${onlineProvider}" no está disponible. Pide al cliente que elija otro.`,
            }
        }

        if (providerInfo.checkoutMode === "embedded_widget") {
            // Wompi/ePayco: el cliente abre página interna que carga el widget JS embebido.
            paymentUrl = appendStorefrontAccessParam(
                `${storeBaseUrl}/checkout/${providerInfo.id}/${order.id}`,
                orderAccessToken,
            )
            paymentInstructions = "Haz clic en el enlace para completar tu pago de forma segura."
        } else {
            // Bold/Addi: hosted_redirect. Generamos la sesión externa server-side y
            // devolvemos la URL del proveedor para que el cliente la abra.
            const returnUrl = appendStorefrontAccessParam(
                `${storeBaseUrl}/order/${order.id}`,
                orderAccessToken,
            )

            const paymentResult = await paymentService.initiatePayment({
                orderId: order.id,
                organizationId: context.organizationId,
                amount: Math.round(total * 100),
                currency: "COP",
                customerEmail: shippingInfo.email || "",
                customerName: shippingInfo.customer_name || "",
                customerDocument: shippingInfo.document_number || "",
                customerDocumentType: shippingInfo.document_type || "CC",
                customerPhone: shippingInfo.phone,
                returnUrl,
                paymentMethod: providerInfo.id,
            })

            if (!paymentResult.success || !paymentResult.paymentUrl) {
                payLog.error("hosted_redirect initiatePayment failed", {
                    provider: providerInfo.id,
                    error: paymentResult.error,
                })
                return {
                    success: false,
                    error: paymentResult.error || `Error al generar enlace con ${providerInfo.displayName}.`,
                }
            }

            // Gap C: persistir store_transactions pending para hosted_redirect (Bold/Addi),
            // con el provider_transaction_id (p.ej. LNK_xxx de Bold) necesario para reconciliar
            // por id. Error no bloqueante: el cliente igual puede pagar y el webhook/reconcile
            // recrea la fila si falta.
            const { error: txError } = await supabase
                .from("store_transactions")
                .insert({
                    organization_id: context.organizationId,
                    order_id: order.id,
                    customer_id: chat?.customer_id ?? null,
                    amount: Math.round(total * 100),
                    currency: "COP",
                    status: "pending",
                    provider: providerInfo.id,
                    provider_transaction_id: paymentResult.transactionId ?? null,
                    provider_reference: order.id,
                    provider_response: { paymentUrl: paymentResult.paymentUrl },
                    payment_method: null,
                })

            if (txError) {
                payLog.warn("hosted_redirect: store_transactions pending insert failed (no bloqueante)", {
                    provider: providerInfo.id,
                    orderId: order.id,
                    error: txError.message,
                })
            }

            paymentUrl = paymentResult.paymentUrl
            paymentInstructions = `Te dirigimos a ${providerInfo.displayName} para completar tu pago de forma segura.`
        }
    }

    return {
        success: true,
        data: {
            ui_component: "payment_link",
            order: {
                id: order.id,
                orderNumber: order.order_number,
                total,
                subtotal,
                shippingCost,
                itemCount: items.length
            },
            paymentMethod: resolvedPaymentMethod,
            paymentUrl,
            message: customer_message || "¡Gracias por tu compra!",
            instructions: paymentInstructions
        }
    }
}

/**
 * Asesor guiado (artifact `recommendation`): arma una selección de N productos
 * según la intención del cliente. Reúsa `searchProducts` (RPC + normalización +
 * variantes) y re-envuelve con `ui_component: "recommendation"` para que el chat
 * lo renderice como una tarjeta con "agregar todo al carrito". Zero-config: el
 * agente razona sobre el catálogo, sin que el merchant configure nada.
 */
const recommendProducts: ToolHandler = async (supabase, input, context) => {
    const intent = typeof input.intent === "string" ? input.intent.trim() : ""
    const requestedLimit = parseFiniteNumber(input.limit)
    const limit = Math.min(Math.max(requestedLimit ?? 3, 1), 5)
    const excludeIds: string[] = Array.isArray(input.exclude_product_ids)
        ? input.exclude_product_ids.filter((id: unknown): id is string => typeof id === "string")
        : []

    if (intent.length === 0) {
        return { success: false, error: "Falta la intención del cliente para recomendar." }
    }

    // Reúsa el motor de búsqueda; pedimos de más para poder excluir lo que ya
    // tiene y aún así llenar el límite con productos relevantes.
    const searchResult = await searchProducts(
        supabase,
        { query: intent, limit: limit + excludeIds.length + 4 },
        context,
    )
    if (!searchResult.success) {
        return searchResult
    }

    const allProducts: Array<Record<string, unknown>> = Array.isArray(searchResult.data?.products)
        ? (searchResult.data.products as Array<Record<string, unknown>>)
        : []

    // Fallback robusto: el 'intent' suele ser una frase NL larga y el FTS de
    // searchProducts matchea poco/nada. Si no llena el límite, completamos con
    // browse (top productos por stock) para que el asesor guiado SIEMPRE devuelva
    // una selección no vacía cuando el catálogo tiene productos.
    if (allProducts.length < limit) {
        const browseResult = await searchProducts(supabase, { limit: limit + excludeIds.length + 6 }, context)
        const browseProducts: Array<Record<string, unknown>> = browseResult.success && Array.isArray(browseResult.data?.products)
            ? (browseResult.data.products as Array<Record<string, unknown>>)
            : []
        const seen = new Set(
            allProducts
                .map((product) => (typeof product.id === "string" ? product.id : null))
                .filter((id): id is string => id !== null),
        )
        for (const product of browseProducts) {
            const id = typeof product.id === "string" ? product.id : null
            if (id && !seen.has(id)) {
                allProducts.push(product)
                seen.add(id)
            }
        }
    }

    const products = allProducts
        .filter((product) => {
            const id = typeof product.id === "string" ? product.id : null
            return id === null || !excludeIds.includes(id)
        })
        .slice(0, limit)

    return {
        success: true,
        data: {
            ui_component: "recommendation",
            products,
            intent,
            reasoning: `Selección para: ${intent}`,
        },
    }
}

export const ecommerceToolHandlers: Record<string, ToolHandler> = {
    search_products: searchProducts,
    recommend_products: recommendProducts,
    show_product: showProduct,
    get_product_availability: getProductAvailability,
    add_to_cart: addToCart,
    get_cart: getCart,
    remove_from_cart: removeFromCart,
    update_cart_quantity: updateCartQuantity,
    start_checkout: startCheckout,
    get_shipping_options: getShippingOptions,
    apply_discount: applyDiscount,
    render_checkout_summary: renderCheckoutSummary,
    create_payment_link: createPaymentLink,
}
