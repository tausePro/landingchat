import { logger } from "@/lib/logger"
import { calculateCouponDiscount, type CouponMetadata, type CartItemForCoupon } from "@/lib/utils/coupon"
import {
    ApplyDiscountSchema,
    CreatePaymentLinkSchema,
    GetShippingOptionsSchema,
    RenderCheckoutSummarySchema,
} from "@/lib/ai/tools"
import type { ToolHandler } from "./types"

const log = logger("ai/tool-executor")

function removeAccents(str: string): string {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

const searchProducts: ToolHandler = async (supabase, input, context) => {
    const { query, category, max_price, limit = 15 } = input

    let dbQuery = supabase
        .from("products")
        .select("id, name, description, price, sale_price, image_url, images, stock, categories, variants")
        .eq("organization_id", context.organizationId)
        .eq("is_active", true)
        .order("stock", { ascending: false })

    if (max_price) {
        dbQuery = dbQuery.lte("price", max_price)
    }

    if (query) {
        const words = removeAccents(query)
            .split(/\s+/)
            .filter((w: string) => w.length >= 2)

        for (const word of words) {
            dbQuery = dbQuery.or(`name.ilike.%${word}%,description.ilike.%${word}%`)
        }
    }

    if (category) {
        dbQuery = dbQuery.contains("categories", [category])
    }

    const { data: products, error } = await dbQuery.limit(limit)

    if (error) {
        return { success: false, error: error.message }
    }

    return {
        success: true,
        data: {
            products: products.map((p: any) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                price: p.sale_price || p.price,
                originalPrice: p.sale_price ? p.price : undefined,
                onSale: !!p.sale_price,
                image_url: p.image_url || p.images?.[0],
                stock: p.stock,
                available: p.stock > 0,
                hasVariants: p.variants?.length > 0
            })),
            totalFound: products.length
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

    return {
        success: true,
        data: {
            product: {
                id: product.id,
                name: product.name,
                description: product.description,
                price: product.sale_price || product.price,
                originalPrice: product.sale_price ? product.price : undefined,
                onSale: !!product.sale_price,
                image_url: product.image_url,
                images: product.images || [],
                stock: product.stock,
                available: product.stock > 0,
                sku: product.sku,
                categories: product.categories || [],
                variants: product.variants || []
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

    const variantStock: Record<string, Record<string, number>> = {}
    let hasVariantStock = false

    if (product.variants && Array.isArray(product.variants)) {
        for (const v of product.variants) {
            if (v.hasStockByVariant && v.stockByVariant) {
                hasVariantStock = true
                variantStock[v.type] = {}
                for (const [val, qty] of Object.entries(v.stockByVariant)) {
                    variantStock[v.type][val] = qty as number
                }
            }
        }
    }

    return {
        success: true,
        data: {
            available: product.stock > 0,
            quantity: product.stock,
            productName: product.name,
            ...(hasVariantStock && {
                stockByVariant: variantStock,
                note: "Este producto tiene inventario por variante. Verifica disponibilidad de la variante específica antes de agregar al carrito."
            })
        }
    }
}

const addToCart: ToolHandler = async (supabase, input, context) => {
    const { product_id, quantity = 1, variant } = input

    const { data: product, error: productError } = await supabase
        .from("products")
        .select("id, name, price, sale_price, image_url, stock, variants")
        .eq("id", product_id)
        .eq("organization_id", context.organizationId)
        .single()

    if (productError || !product) {
        return { success: false, error: "Producto no encontrado" }
    }

    if (variant && product.variants && Array.isArray(product.variants)) {
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

    if (product.stock < quantity) {
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

    const items = cart.items || []
    const existingIndex = items.findIndex((i: any) => i.product_id === product_id)

    if (existingIndex >= 0) {
        items[existingIndex].quantity += quantity
    } else {
        items.push({
            product_id: product.id,
            name: product.name,
            price: product.sale_price || product.price,
            original_price: product.sale_price ? product.price : undefined,
            image_url: product.image_url,
            quantity,
            variant: variant || null
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

    const total = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)

    return {
        success: true,
        data: {
            added: {
                name: product.name,
                quantity,
                price: product.sale_price || product.price,
                onSale: !!product.sale_price
            },
            cart: {
                itemCount: items.length,
                totalItems: items.reduce((sum: number, i: any) => sum + i.quantity, 0),
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

    if (!cart || !cart.items?.length) {
        return {
            success: true,
            data: {
                isEmpty: true,
                items: [],
                total: 0
            }
        }
    }

    const total = cart.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)

    return {
        success: true,
        data: {
            isEmpty: false,
            items: cart.items,
            itemCount: cart.items.length,
            totalItems: cart.items.reduce((sum: number, i: any) => sum + i.quantity, 0),
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

    const items = cart.items.filter((i: any) => i.product_id !== product_id)
    const removedItem = cart.items.find((i: any) => i.product_id === product_id)

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

    const items = cart.items.map((i: any) => {
        if (i.product_id === product_id) {
            return { ...i, quantity }
        }
        return i
    }).filter((i: any) => i.quantity > 0)

    await supabase
        .from("carts")
        .update({ items, updated_at: new Date().toISOString() })
        .eq("id", cart.id)

    const total = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)

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

    if (!cart || !cart.items?.length) {
        return { success: false, error: "El carrito está vacío" }
    }

    const subtotal = cart.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)

    return {
        success: true,
        data: {
            readyForCheckout: true,
            summary: {
                items: cart.items,
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

    if (freeShippingEnabled && cityMatchesZone) {
        options.push({
            id: "free",
            name: freeShippingMinAmount
                ? `Envío Gratis (compras desde $${freeShippingMinAmount.toLocaleString()})`
                : "Envío Gratis",
            price: 0,
            days: `${estimatedDays}-${estimatedDays + 2} días hábiles`
        })
    }

    if (defaultRate > 0 && (!cityMatchesZone || !freeShippingEnabled)) {
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
            freeShippingEnabled,
            freeShippingMinAmount,
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

    if (!cart?.items?.length) {
        return { success: false, error: "El carrito está vacío. Agrega productos antes de aplicar un cupón." }
    }

    const subtotal = cart.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)

    if (coupon.min_purchase_amount && subtotal < Number(coupon.min_purchase_amount)) {
        return {
            success: false,
            error: `Este código requiere una compra mínima de $${Number(coupon.min_purchase_amount).toLocaleString()}`
        }
    }

    let cartItems: CartItemForCoupon[] = cart.items.map((item: any) => ({
        id: item.product_id,
        price: item.price,
        quantity: item.quantity,
        categories: [] as string[]
    }))

    if (coupon.applies_to === "categories" && coupon.target_ids?.length) {
        const productIds = cartItems.map((i: CartItemForCoupon) => i.id)
        const { data: products } = await supabase
            .from("products")
            .select("id, categories")
            .in("id", productIds)

        if (products) {
            const catMap = new Map<string, string[]>(products.map((p: any) => [p.id, p.categories || []]))
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

    if (!cart || !cart.items?.length) {
        return {
            success: true,
            data: {
                isEmpty: true,
                ui_component: "checkout_summary",
                message: "Tu carrito está vacío. ¿Te ayudo a encontrar algo?"
            }
        }
    }

    const subtotal = cart.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)
    const itemCount = cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0)

    const { data: shippingSettings } = await supabase
        .from("shipping_settings")
        .select("*")
        .eq("organization_id", context.organizationId)
        .single()

    const freeShippingEnabled = shippingSettings?.free_shipping_enabled || false
    const freeShippingThreshold = shippingSettings?.free_shipping_min_amount || 0
    const defaultShipping = shippingSettings?.default_shipping_rate ?? 0
    const qualifiesForFreeShipping = freeShippingEnabled && (!freeShippingThreshold || subtotal >= freeShippingThreshold)

    return {
        success: true,
        data: {
            ui_component: "checkout_summary",
            message: message || "¡Excelente elección! Aquí tienes el resumen de tu pedido:",
            cart: {
                items: cart.items.map((item: any) => ({
                    id: item.product_id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    image_url: item.image_url,
                    subtotal: item.price * item.quantity
                })),
                itemCount,
                subtotal,
                estimatedShipping: qualifiesForFreeShipping ? 0 : defaultShipping,
                freeShippingThreshold,
                qualifiesForFreeShipping,
                total: subtotal + (qualifiesForFreeShipping ? 0 : defaultShipping)
            },
            nextStep: "shipping_form",
            instructions: "Para continuar, necesito tus datos de envío. ¿Me los puedes proporcionar?"
        }
    }
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

    if (!cart || !cart.items?.length) {
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

    const subtotal = cart.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)

    const { data: shippingSettings } = await supabase
        .from("shipping_settings")
        .select("*")
        .eq("organization_id", context.organizationId)
        .single()

    const freeShippingEnabled = shippingSettings?.free_shipping_enabled || false
    const freeShippingThreshold = shippingSettings?.free_shipping_min_amount || 0
    const qualifiesFreeShipping = freeShippingEnabled && (!freeShippingThreshold || subtotal >= freeShippingThreshold)
    const shippingCost = qualifiesFreeShipping ? 0 : (shippingSettings?.default_shipping_rate ?? 0)
    const total = subtotal + shippingCost

    const { data: organization } = await supabase
        .from("organizations")
        .select("id, slug, name, custom_domain")
        .eq("id", context.organizationId)
        .single()

    const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`

    const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
            organization_id: context.organizationId,
            customer_id: chat?.customer_id || null,
            chat_id: context.chatId,
            order_number: orderNumber,
            items: cart.items.map((item: any) => ({
                product_id: item.product_id,
                product_name: item.name,
                name: item.name,
                unit_price: item.price,
                total_price: item.price * item.quantity,
                price: item.price,
                quantity: item.quantity,
                image_url: item.image_url
            })),
            source_channel: chat?.channel || "web",
            subtotal,
            shipping_cost: shippingCost,
            total,
            status: "pending",
            payment_status: "pending",
            payment_method: payment_method || "epayco",
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

    let paymentUrl: string
    let paymentInstructions: string

    if (payment_method === "manual" || payment_method === "contraentrega") {
        paymentUrl = `${storeBaseUrl}/order/${order.id}`
        paymentInstructions = "Tu pedido ha sido registrado. Puedes pagar contra entrega o por transferencia."
    } else {
        paymentUrl = `${storeBaseUrl}/checkout/epayco/${order.id}`
        paymentInstructions = "Haz clic en el enlace para completar tu pago de forma segura."
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
                itemCount: cart.items.length
            },
            paymentMethod: payment_method || "epayco",
            paymentUrl,
            message: customer_message || "¡Gracias por tu compra!",
            instructions: paymentInstructions
        }
    }
}

export const ecommerceToolHandlers: Record<string, ToolHandler> = {
    search_products: searchProducts,
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
