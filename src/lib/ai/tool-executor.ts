import { createServiceClient } from "@/lib/supabase/server"
import {
    IdentifyCustomerSchema,
    SearchProductsSchema,
    ShowProductSchema,
    GetProductAvailabilitySchema,
    AddToCartSchema,
    GetCartSchema,
    RemoveFromCartSchema,
    UpdateCartQuantitySchema,
    StartCheckoutSchema,
    GetShippingOptionsSchema,
    ApplyDiscountSchema,
    RenderCheckoutSummarySchema,
    GetStoreInfoSchema,
    GetOrderStatusSchema,
    GetCustomerHistorySchema,
    ConfirmShippingDetailsSchema,
    CreatePaymentLinkSchema,
    EscalateToHumanSchema,
    ScheduleAppointmentSchema,
    SearchPropertiesSchema,
    ShowPropertySchema
} from "./tools"

interface ToolContext {
    chatId: string
    organizationId: string
    customerId?: string
}

interface ToolResult {
    success: boolean
    data?: any
    error?: string
}

export async function executeTool(
    toolName: string,
    input: any,
    context: ToolContext
): Promise<ToolResult> {
    console.log(`[Tool] Executing: ${toolName}`, input)

    const supabase = createServiceClient()

    try {
        switch (toolName) {
            case "identify_customer":
                return await identifyCustomer(supabase, input, context)

            case "search_products":
                return await searchProducts(supabase, input, context)

            case "show_product":
                return await showProduct(supabase, input, context)

            case "get_product_availability":
                return await getProductAvailability(supabase, input, context)

            case "add_to_cart":
                return await addToCart(supabase, input, context)

            case "get_cart":
                return await getCart(supabase, context)

            case "remove_from_cart":
                return await removeFromCart(supabase, input, context)

            case "update_cart_quantity":
                return await updateCartQuantity(supabase, input, context)

            case "start_checkout":
                return await startCheckout(supabase, input, context)

            case "get_shipping_options":
                return await getShippingOptions(supabase, input, context)

            case "apply_discount":
                return await applyDiscount(supabase, input, context)

            case "render_checkout_summary":
                return await renderCheckoutSummary(supabase, input, context)

            case "get_store_info":
                return await getStoreInfo(supabase, input, context)

            case "get_order_status":
                return await getOrderStatus(supabase, input, context)

            case "get_customer_history":
                return await getCustomerHistory(supabase, context)

            case "confirm_shipping_details":
                return await confirmShippingDetails(supabase, input, context)

            case "create_payment_link":
                return await createPaymentLink(supabase, input, context)

            case "escalate_to_human":
                return await escalateToHuman(supabase, input, context)

            case "schedule_appointment":
                return await scheduleAppointment(supabase, input, context)

            case "search_properties":
                return await searchProperties(supabase, input, context)

            case "show_property":
                return await showProperty(supabase, input, context)

            default:
                return { success: false, error: `Unknown tool: ${toolName}` }
        }
    } catch (error: any) {
        console.error(`[Tool] Error in ${toolName}:`, error)
        return { success: false, error: error.message }
    }
}

// ==================== TOOL IMPLEMENTATIONS ====================

async function identifyCustomer(supabase: any, input: any, context: ToolContext): Promise<ToolResult> {
    const { name, email, phone } = IdentifyCustomerSchema.parse(input)

    if (!email && !phone) {
        return {
            success: false,
            error: "Se necesita al menos email o teléfono para identificar al cliente"
        }
    }

    // Buscar cliente existente
    let query = supabase
        .from("customers")
        .select("*, orders(id, total, status, created_at)")
        .eq("organization_id", context.organizationId)

    if (email) {
        query = query.eq("email", email)
    } else if (phone) {
        query = query.eq("phone", phone)
    }

    const { data: existingCustomer } = await query.single()

    if (existingCustomer) {
        // Actualizar chat con customer_id
        await supabase
            .from("chats")
            .update({ customer_id: existingCustomer.id })
            .eq("id", context.chatId)

        // Actualizar última interacción
        await supabase
            .from("customers")
            .update({ last_interaction_at: new Date().toISOString() })
            .eq("id", existingCustomer.id)

        const lastOrder = existingCustomer.orders?.[0]

        return {
            success: true,
            data: {
                isReturning: true,
                customer: {
                    id: existingCustomer.id,
                    name: existingCustomer.full_name,
                    email: existingCustomer.email,
                    phone: existingCustomer.phone
                },
                stats: {
                    totalOrders: existingCustomer.total_orders || 0,
                    totalSpent: existingCustomer.total_spent || 0
                },
                lastOrder: lastOrder ? {
                    date: lastOrder.created_at,
                    total: lastOrder.total,
                    status: lastOrder.status
                } : null,
                preferences: existingCustomer.metadata || {}
            }
        }
    }

    // Crear nuevo cliente
    const { data: newCustomer, error } = await supabase
        .from("customers")
        .insert({
            organization_id: context.organizationId,
            full_name: name,
            email: email || null,
            phone: phone || null,
            last_interaction_at: new Date().toISOString()
        })
        .select()
        .single()

    if (error) {
        return { success: false, error: `Error creando cliente: ${error.message}` }
    }

    // Vincular al chat
    await supabase
        .from("chats")
        .update({ customer_id: newCustomer.id })
        .eq("id", context.chatId)

    return {
        success: true,
        data: {
            isReturning: false,
            customer: {
                id: newCustomer.id,
                name: newCustomer.full_name,
                email: newCustomer.email,
                phone: newCustomer.phone
            }
        }
    }
}

async function searchProducts(supabase: any, input: any, context: ToolContext): Promise<ToolResult> {
    const { query, category, max_price, limit = 5 } = input

    let dbQuery = supabase
        .from("products")
        .select("id, name, description, price, image_url, images, stock, categories, variants")
        .eq("organization_id", context.organizationId)
        .eq("is_active", true)
        .gt("stock", 0)

    if (max_price) {
        dbQuery = dbQuery.lte("price", max_price)
    }

    // Búsqueda por texto en nombre y descripción
    if (query) {
        dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`)
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
                price: p.price,
                image_url: p.image_url || p.images?.[0],
                stock: p.stock,
                hasVariants: p.variants?.length > 0
            })),
            totalFound: products.length
        }
    }
}

async function showProduct(supabase: any, input: any, context: ToolContext): Promise<ToolResult> {
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
                price: product.price,
                image_url: product.image_url,
                images: product.images || [],
                stock: product.stock,
                sku: product.sku,
                categories: product.categories || [],
                variants: product.variants || []
            }
        }
    }
}

async function getProductAvailability(supabase: any, input: any, context: ToolContext): Promise<ToolResult> {
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

    return {
        success: true,
        data: {
            available: product.stock > 0,
            quantity: product.stock,
            productName: product.name
        }
    }
}

async function addToCart(supabase: any, input: any, context: ToolContext): Promise<ToolResult> {
    const { product_id, quantity = 1, variant } = input

    // Obtener producto
    const { data: product, error: productError } = await supabase
        .from("products")
        .select("id, name, price, image_url, stock")
        .eq("id", product_id)
        .eq("organization_id", context.organizationId)
        .single()

    if (productError || !product) {
        return { success: false, error: "Producto no encontrado" }
    }

    if (product.stock < quantity) {
        return {
            success: false,
            error: `Solo hay ${product.stock} unidades disponibles de ${product.name}`
        }
    }

    // Obtener o crear carrito
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

    // Actualizar items del carrito
    const items = cart.items || []
    const existingIndex = items.findIndex((i: any) => i.product_id === product_id)

    if (existingIndex >= 0) {
        items[existingIndex].quantity += quantity
    } else {
        items.push({
            product_id: product.id,
            name: product.name,
            price: product.price,
            image_url: product.image_url,
            quantity: quantity,
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
                quantity: quantity,
                price: product.price
            },
            cart: {
                itemCount: items.length,
                totalItems: items.reduce((sum: number, i: any) => sum + i.quantity, 0),
                total
            }
        }
    }
}

async function getCart(supabase: any, context: ToolContext): Promise<ToolResult> {
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

async function removeFromCart(supabase: any, input: any, context: ToolContext): Promise<ToolResult> {
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

async function updateCartQuantity(supabase: any, input: any, context: ToolContext): Promise<ToolResult> {
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

async function startCheckout(supabase: any, input: any, context: ToolContext): Promise<ToolResult> {
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

async function getShippingOptions(supabase: any, input: any, context: ToolContext): Promise<ToolResult> {
    const { city } = GetShippingOptionsSchema.parse(input)

    // Leer configuración de envío de la organización
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

    // Verificar si la ciudad está en las zonas configuradas
    const cityLower = city?.toLowerCase() || ""
    const hasZones = freeShippingZones.length > 0
    const cityMatchesZone = !hasZones || freeShippingZones.some((zone: string) =>
        cityLower.includes(zone.toLowerCase())
    )

    // Si hay zonas, la ciudad no coincide, y default_rate es 0 → no envían a esa ciudad
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

    // Tarifa estándar si tiene una configurada (para ciudades fuera de zonas gratis)
    if (defaultRate > 0 && (!cityMatchesZone || !freeShippingEnabled)) {
        options.push({
            id: "standard",
            name: "Envío Estándar",
            price: defaultRate,
            days: `${estimatedDays}-${estimatedDays + 2} días hábiles`
        })
    }

    // Si no hay opciones configuradas
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

async function applyDiscount(supabase: any, input: any, context: ToolContext): Promise<ToolResult> {
    const { code } = ApplyDiscountSchema.parse(input)

    const { data: discount, error } = await supabase
        .from("discounts")
        .select("*")
        .eq("organization_id", context.organizationId)
        .eq("code", code.toUpperCase())
        .eq("is_active", true)
        .single()

    if (error || !discount) {
        return { success: false, error: "Código de descuento inválido o expirado" }
    }

    // Verificar vigencia
    const now = new Date()
    if (discount.valid_until && new Date(discount.valid_until) < now) {
        return { success: false, error: "Este código ha expirado" }
    }

    if (discount.max_uses && discount.used_count >= discount.max_uses) {
        return { success: false, error: "Este código ya alcanzó su límite de usos" }
    }

    // Obtener carrito para calcular descuento
    const { data: cart } = await supabase
        .from("carts")
        .select("items")
        .eq("chat_id", context.chatId)
        .eq("status", "active")
        .single()

    const subtotal = cart?.items?.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) || 0

    if (discount.min_purchase && subtotal < discount.min_purchase) {
        return {
            success: false,
            error: `Este código requiere una compra mínima de $${discount.min_purchase.toLocaleString()}`
        }
    }

    let discountAmount = 0
    if (discount.type === "percentage") {
        discountAmount = subtotal * (discount.value / 100)
    } else {
        discountAmount = discount.value
    }

    return {
        success: true,
        data: {
            code: discount.code,
            type: discount.type,
            value: discount.value,
            discountAmount,
            newTotal: subtotal - discountAmount
        }
    }
}

async function getStoreInfo(supabase: any, input: any, context: ToolContext): Promise<ToolResult> {
    const { topic } = GetStoreInfoSchema.parse(input)

    const { data: org } = await supabase
        .from("organizations")
        .select("name, settings, contact_email")
        .eq("id", context.organizationId)
        .single()

    const settings = org?.settings || {}

    const info: any = {
        storeName: org?.name,
        contactEmail: org?.contact_email
    }

    switch (topic) {
        case "shipping":
            info.shipping = settings.shipping || {
                description: "Envíos a toda Colombia. Tiempo estimado: 3-5 días hábiles.",
                freeShippingThreshold: 100000
            }
            break
        case "returns":
            info.returns = settings.returns || {
                description: "30 días para devoluciones. Producto sin usar y con etiquetas originales."
            }
            break
        case "payment_methods":
            info.paymentMethods = settings.paymentMethods || [
                "Tarjeta de crédito/débito",
                "PSE",
                "Efectivo contra entrega (algunas ciudades)"
            ]
            break
        case "hours":
            info.hours = settings.hours || {
                description: "Atención por chat: Lunes a Viernes 8am-6pm, Sábados 9am-1pm"
            }
            break
        default:
            info.general = {
                shipping: "Envíos a toda Colombia",
                returns: "30 días para devoluciones",
                paymentMethods: ["Tarjeta", "PSE", "Efectivo"]
            }
    }

    return { success: true, data: info }
}

async function getOrderStatus(supabase: any, input: any, context: ToolContext): Promise<ToolResult> {
    const { order_id, email } = GetOrderStatusSchema.parse(input)

    let query = supabase
        .from("orders")
        .select("id, status, total, items, created_at, shipping_cost, payment_method")
        .eq("organization_id", context.organizationId)

    if (order_id) {
        query = query.eq("id", order_id)
    } else if (email) {
        query = query.eq("customer_info->>email", email)
    } else if (context.customerId) {
        query = query.eq("customer_id", context.customerId).order("created_at", { ascending: false }).limit(1)
    } else {
        return { success: false, error: "Necesito el número de orden o el email usado en la compra" }
    }

    const { data: order, error } = await query.single()

    if (error || !order) {
        return { success: false, error: "No encontré esa orden. ¿Puedes verificar el número?" }
    }

    const statusMessages: Record<string, string> = {
        pending: "Pendiente de pago",
        paid: "Pago confirmado, preparando envío",
        shipped: "En camino",
        delivered: "Entregado",
        cancelled: "Cancelada"
    }

    return {
        success: true,
        data: {
            orderId: order.id,
            status: order.status,
            statusMessage: statusMessages[order.status] || order.status,
            total: order.total,
            itemCount: order.items?.length || 0,
            createdAt: order.created_at
        }
    }
}

async function getCustomerHistory(supabase: any, context: ToolContext): Promise<ToolResult> {
    if (!context.customerId) {
        return {
            success: true,
            data: {
                hasHistory: false,
                message: "Cliente no identificado aún"
            }
        }
    }

    const { data: customer } = await supabase
        .from("customers")
        .select("full_name, email, phone, metadata, total_orders, total_spent, document_type, document_number, person_type, business_name")
        .eq("id", context.customerId)
        .single()

    // Obtener órdenes recientes CON customer_info para reutilizar datos de envío
    const { data: orders } = await supabase
        .from("orders")
        .select("id, items, total, status, created_at, customer_info")
        .eq("customer_id", context.customerId)
        .order("created_at", { ascending: false })
        .limit(5)

    // Extraer productos comprados para recomendaciones
    const purchasedProducts = orders?.flatMap((o: any) => o.items?.map((i: any) => i.name)) || []
    const categories = [...new Set(purchasedProducts)]

    // Obtener última dirección de envío de la orden más reciente
    const lastOrder = orders?.[0]
    const lastShippingInfo = lastOrder?.customer_info ? {
        name: lastOrder.customer_info.name,
        email: lastOrder.customer_info.email,
        phone: lastOrder.customer_info.phone,
        address: lastOrder.customer_info.address,
        city: lastOrder.customer_info.city,
        state: lastOrder.customer_info.state,
        document_type: lastOrder.customer_info.document_type,
        document_number: lastOrder.customer_info.document_number,
        person_type: lastOrder.customer_info.person_type,
        business_name: lastOrder.customer_info.business_name
    } : null

    // También obtener de metadata del cliente (puede ser más reciente si se actualizó en checkout)
    const customerAddress = customer?.metadata ? {
        address: customer.metadata.address,
        city: customer.metadata.city,
        state: customer.metadata.state
    } : null

    return {
        success: true,
        data: {
            hasHistory: true,
            customer: {
                name: customer?.full_name,
                email: customer?.email,
                phone: customer?.phone,
                totalOrders: customer?.total_orders || 0,
                totalSpent: customer?.total_spent || 0,
                // Datos de facturación guardados
                documentType: customer?.document_type,
                documentNumber: customer?.document_number,
                personType: customer?.person_type,
                businessName: customer?.business_name
            },
            // ⭐ NUEVA DATA: Última información de envío para reutilizar
            lastShippingInfo: lastShippingInfo,
            savedAddress: customerAddress,
            recentOrders: orders?.map((o: any) => ({
                id: o.id,
                date: o.created_at,
                total: o.total,
                status: o.status,
                itemCount: o.items?.length || 0
            })) || [],
            preferences: customer?.metadata || {},
            purchasedCategories: categories.slice(0, 5)
        }
    }
}

async function confirmShippingDetails(supabase: any, input: any, context: ToolContext): Promise<ToolResult> {
    const validatedData = ConfirmShippingDetailsSchema.parse(input)

    // Formatear los datos para mostrar al usuario
    const confirmation = {
        customer: {
            name: validatedData.customer_name,
            email: validatedData.email,
            phone: validatedData.phone,
            documentType: validatedData.document_type,
            documentNumber: validatedData.document_number,
            personType: validatedData.person_type,
            businessName: validatedData.business_name
        },
        shipping: {
            address: validatedData.address,
            city: validatedData.city,
            state: validatedData.state
        }
    }

    // Guardar los datos en el chat para uso posterior en checkout (createPaymentLink)
    // Obtener metadata existente primero
    const { data: existingChat } = await supabase
        .from("chats")
        .select("metadata")
        .eq("id", context.chatId)
        .single()

    await supabase
        .from("chats")
        .update({
            metadata: {
                ...(existingChat?.metadata || {}),
                shippingDetails: confirmation,
                confirmed_shipping: {
                    customer_name: validatedData.customer_name,
                    email: validatedData.email,
                    phone: validatedData.phone,
                    address: validatedData.address,
                    city: validatedData.city,
                    state: validatedData.state,
                    document_type: validatedData.document_type || "CC",
                    document_number: validatedData.document_number,
                    person_type: validatedData.person_type || "Natural",
                    business_name: validatedData.business_name
                },
                confirmedAt: new Date().toISOString()
            }
        })
        .eq("id", context.chatId)

    return {
        success: true,
        data: {
            confirmed: true,
            details: confirmation,
            message: "Datos confirmados correctamente.",
            nextStep: "payment",
            instructions: "Ahora pregunta al cliente qué método de pago prefiere: Pago en línea (ePayco) o contra entrega. Luego usa 'create_payment_link' con el método elegido."
        }
    }
}

async function escalateToHuman(supabase: any, input: any, context: ToolContext): Promise<ToolResult> {
    const { reason, priority } = EscalateToHumanSchema.parse(input)

    // Actualizar chat status
    await supabase
        .from("chats")
        .update({
            status: "pending",
            // Podríamos agregar un campo para notas de escalamiento
        })
        .eq("id", context.chatId)

    // Buscar agentes humanos disponibles
    const { data: humanAgents } = await supabase
        .from("agents")
        .select("id, name")
        .eq("organization_id", context.organizationId)
        .eq("type", "human")
        .eq("status", "available")
        .limit(1)

    const assignedAgent = humanAgents?.[0]

    if (assignedAgent) {
        await supabase
            .from("chats")
            .update({ assigned_agent_id: assignedAgent.id })
            .eq("id", context.chatId)
    }

    return {
        success: true,
        data: {
            escalated: true,
            reason,
            priority,
            agentAssigned: assignedAgent?.name || null,
            message: assignedAgent
                ? `Te estoy transfiriendo con ${assignedAgent.name}. Un momento por favor.`
                : "He notificado a nuestro equipo. Te atenderán en breve."
        }
    }
}

// ==================== CHECKOUT CONVERSACIONAL ====================

async function renderCheckoutSummary(supabase: any, input: any, context: ToolContext): Promise<ToolResult> {
    const { message } = RenderCheckoutSummarySchema.parse(input)

    // Obtener carrito actual
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

    // Obtener configuración de envío de la organización
    const { data: shippingSettings } = await supabase
        .from("shipping_settings")
        .select("*")
        .eq("organization_id", context.organizationId)
        .single()

    const freeShippingEnabled = shippingSettings?.free_shipping_enabled || false
    const freeShippingThreshold = shippingSettings?.free_shipping_min_amount || 0
    const defaultShipping = shippingSettings?.default_shipping_rate ?? 0
    // null/0 min_amount = sin mínimo requerido (siempre gratis)
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

// ==================== CREACIÓN DE LINK DE PAGO ====================

async function createPaymentLink(supabase: any, input: any, context: ToolContext): Promise<ToolResult> {
    console.log("[createPaymentLink] Starting with input:", input)
    console.log("[createPaymentLink] Context:", { chatId: context.chatId, organizationId: context.organizationId })

    const { payment_method, customer_message } = CreatePaymentLinkSchema.parse(input)

    // Obtener el carrito actual
    const { data: cart, error: cartError } = await supabase
        .from("carts")
        .select("*")
        .eq("chat_id", context.chatId)
        .eq("status", "active")
        .single()

    console.log("[createPaymentLink] Cart query result:", { cart: cart?.id, items: cart?.items?.length, error: cartError })

    if (!cart || !cart.items?.length) {
        console.log("[createPaymentLink] ERROR: No cart or empty items")
        return {
            success: false,
            error: "No hay productos en el carrito. Agrega productos antes de proceder al pago."
        }
    }

    // Obtener datos de envío confirmados (del chat metadata o del último confirm_shipping)
    const { data: chat } = await supabase
        .from("chats")
        .select("metadata, customer_id, channel")
        .eq("id", context.chatId)
        .single()

    console.log("[createPaymentLink] Chat metadata:", chat?.metadata)
    console.log("[createPaymentLink] Confirmed shipping:", chat?.metadata?.confirmed_shipping)

    const shippingInfo = chat?.metadata?.confirmed_shipping

    if (!shippingInfo) {
        console.log("[createPaymentLink] ERROR: No confirmed_shipping in metadata")
        return {
            success: false,
            error: "No hay datos de envío confirmados. Usa confirm_shipping_details primero."
        }
    }

    // Calcular totales
    const subtotal = cart.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)

    // Obtener configuración de envío
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

    // Obtener organización para el slug
    const { data: organization } = await supabase
        .from("organizations")
        .select("id, slug, name, custom_domain")
        .eq("id", context.organizationId)
        .single()

    // Generar número de orden único
    const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`

    // Crear la orden
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
            source_channel: chat?.channel || 'web',
            subtotal: subtotal,
            shipping_cost: shippingCost,
            total: total,
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
        console.error("[createPaymentLink] Error creating order:", orderError)
        return {
            success: false,
            error: "Error al crear la orden. Por favor intenta de nuevo."
        }
    }

    // Marcar carrito como convertido
    await supabase
        .from("carts")
        .update({ status: "converted", converted_order_id: order.id })
        .eq("id", cart.id)

    // Generar link de pago usando custom_domain o subdominio (igual que la web)
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
        // ePayco o Wompi - redirigir a página de checkout
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
                total: total,
                subtotal: subtotal,
                shippingCost: shippingCost,
                itemCount: cart.items.length
            },
            paymentMethod: payment_method || "epayco",
            paymentUrl: paymentUrl,
            message: customer_message || "¡Gracias por tu compra!",
            instructions: paymentInstructions
        }
    }
}

// ==================== CITAS ====================

async function scheduleAppointment(supabase: any, input: any, context: ToolContext): Promise<ToolResult> {
    console.log("[scheduleAppointment] Raw input:", JSON.stringify(input))
    console.log("[scheduleAppointment] Context:", { chatId: context.chatId, orgId: context.organizationId, customerId: context.customerId })

    let validated
    try {
        validated = ScheduleAppointmentSchema.parse(input)
    } catch (zodError: any) {
        console.error("[scheduleAppointment] Zod validation error:", zodError.message)
        return { success: false, error: `Datos incompletos para agendar: ${zodError.message}. Necesito al menos: título, fecha/hora y nombre del cliente.` }
    }

    console.log("[scheduleAppointment] Validated:", validated)

    // Parsear y validar la fecha propuesta
    const proposedDate = new Date(validated.proposed_date)
    if (isNaN(proposedDate.getTime())) {
        console.error("[scheduleAppointment] Invalid date:", validated.proposed_date)
        return { success: false, error: "Fecha inválida. Usa formato ISO 8601 (ej: 2025-02-20T10:00:00)" }
    }

    // Validar que no sea más de 24h en el pasado (permitir citas de hoy)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    if (proposedDate < yesterday) {
        console.error("[scheduleAppointment] Date in the past:", proposedDate.toISOString())
        return { success: false, error: "No se puede agendar una cita en el pasado. Por favor sugiere una fecha futura." }
    }

    // Calcular fecha de fin
    const endDate = new Date(proposedDate.getTime() + (validated.duration_minutes * 60 * 1000))

    // Verificar si hay conflictos de horario
    const { data: conflicts } = await supabase
        .from("appointments")
        .select("id, title, proposed_date, proposed_end_date")
        .eq("organization_id", context.organizationId)
        .in("status", ["pending", "confirmed"])
        .lt("proposed_date", endDate.toISOString())
        .gt("proposed_end_date", proposedDate.toISOString())

    if (conflicts && conflicts.length > 0) {
        const conflictInfo = conflicts.map((c: any) => {
            const d = new Date(c.proposed_date)
            return `"${c.title}" el ${d.toLocaleDateString('es-CO')} a las ${d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
        }).join(", ")
        return {
            success: false,
            error: `Hay un conflicto de horario con: ${conflictInfo}. Por favor sugiere otra hora.`
        }
    }

    // Crear la cita
    const { data: appointment, error } = await supabase
        .from("appointments")
        .insert({
            organization_id: context.organizationId,
            customer_id: context.customerId || null,
            chat_id: context.chatId,
            title: validated.title,
            appointment_type: validated.appointment_type,
            status: "pending",
            proposed_date: proposedDate.toISOString(),
            proposed_end_date: endDate.toISOString(),
            duration_minutes: validated.duration_minutes,
            customer_name: validated.customer_name,
            customer_phone: validated.customer_phone || null,
            customer_email: validated.customer_email || null,
            location: validated.location || null,
            location_type: validated.location_type,
            notes: validated.notes || null,
            metadata: {}
        })
        .select()
        .single()

    if (error) {
        console.error("[scheduleAppointment] Error:", error)
        return { success: false, error: `Error agendando la cita: ${error.message}` }
    }

    // Formatear la respuesta
    const dateFormatted = proposedDate.toLocaleDateString('es-CO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
    const timeFormatted = proposedDate.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit'
    })

    const typeLabels: Record<string, string> = {
        visit: "Visita presencial",
        consultation: "Consulta",
        call: "Llamada",
        meeting: "Reunión"
    }

    return {
        success: true,
        data: {
            ui_component: "appointment_confirmation",
            appointment: {
                id: appointment.id,
                title: validated.title,
                type: typeLabels[validated.appointment_type] || validated.appointment_type,
                date: dateFormatted,
                time: timeFormatted,
                duration: `${validated.duration_minutes} minutos`,
                location: validated.location || "Por confirmar",
                locationType: validated.location_type,
                customerName: validated.customer_name,
                status: "pending"
            },
            message: `Cita agendada: "${validated.title}" para el ${dateFormatted} a las ${timeFormatted}.`,
            nextStep: "La cita queda pendiente de confirmación. El equipo se comunicará para confirmar."
        }
    }
}

// ==================== PROPIEDADES (INMOBILIARIO) ====================

async function searchProperties(supabase: any, input: any, context: ToolContext): Promise<ToolResult> {
    const validated = SearchPropertiesSchema.parse(input)
    let { query, property_type, city, neighborhood, min_price, max_price, bedrooms, property_class, limit = 5 } = validated

    // Auto-extraer filtros estructurados del query libre
    const queryLower = (query || "").toLowerCase()
    const stopwords = ["busco", "quiero", "necesito", "en", "de", "un", "una", "el", "la", "los", "las", "con", "para", "por", "que", "me", "mi", "al", "del", "y", "o", "a", "su"]

    const classMap: Record<string, string> = {
        "apartamento": "Apartamento", "apto": "Apartamento", "aptos": "Apartamento",
        "casa": "Casa", "casas": "Casa",
        "local": "Local", "locales": "Local",
        "oficina": "Oficina", "oficinas": "Oficina",
        "bodega": "Bodega", "bodegas": "Bodega",
        "lote": "Lote", "lotes": "Lote",
        "finca": "Finca", "fincas": "Finca"
    }

    // Detectar clase de propiedad del query si no viene como param
    if (!property_class) {
        for (const [keyword, cls] of Object.entries(classMap)) {
            if (queryLower.includes(keyword)) {
                property_class = cls
                break
            }
        }
    }

    // Detectar tipo (arriendo/venta) del query si no viene como param
    if (!property_type) {
        if (queryLower.includes("arriendo") || queryLower.includes("arrendar") || queryLower.includes("alquiler")) {
            property_type = "arriendo"
        } else if (queryLower.includes("venta") || queryLower.includes("comprar") || queryLower.includes("compra")) {
            property_type = "venta"
        }
    }

    console.log("[searchProperties] Input:", { query, property_type, city, neighborhood, min_price, max_price, bedrooms, property_class, limit })
    console.log("[searchProperties] Auto-detected: property_class=", property_class, "property_type=", property_type)

    const buildQuery = (applyTextFilter: boolean) => {
        let q = supabase
            .from("properties")
            .select("id, title, property_type, property_class, city, neighborhood, address, bedrooms, bathrooms, area_m2, price_sale, price_rent, price_admin, images, stratum, status")
            .eq("organization_id", context.organizationId)
            .eq("status", "active")

        // Filtro por texto libre: dividir en palabras clave relevantes
        if (applyTextFilter && query) {
            const keywords = query.toLowerCase().split(/\s+/)
                .filter(w => w.length > 2 && !stopwords.includes(w))
                .filter(w => !classMap[w] && !["arriendo", "arrendar", "venta", "comprar", "alquiler", "compra"].includes(w))

            if (keywords.length > 0) {
                const orConditions = keywords.map(kw =>
                    `title.ilike.%${kw}%,neighborhood.ilike.%${kw}%,address.ilike.%${kw}%,city.ilike.%${kw}%`
                ).join(",")
                q = q.or(orConditions)
                console.log("[searchProperties] Text filter keywords:", keywords)
            }
        }

        // Filtro por tipo (arriendo/venta) — usa campos de precio, no property_type column
        if (property_type) {
            if (property_type.toLowerCase().includes("arriendo")) {
                q = q.not("price_rent", "is", null).gt("price_rent", 0)
            } else if (property_type.toLowerCase().includes("venta")) {
                q = q.not("price_sale", "is", null).gt("price_sale", 0)
            }
        }

        if (city) q = q.ilike("city", `%${city}%`)
        if (neighborhood) q = q.ilike("neighborhood", `%${neighborhood}%`)
        if (bedrooms) q = q.gte("bedrooms", bedrooms)
        if (property_class) q = q.ilike("property_class", `%${property_class}%`)

        if (max_price) {
            if (property_type?.toLowerCase().includes("arriendo")) q = q.lte("price_rent", max_price)
            else if (property_type?.toLowerCase().includes("venta")) q = q.lte("price_sale", max_price)
        }
        if (min_price) {
            if (property_type?.toLowerCase().includes("arriendo")) q = q.gte("price_rent", min_price)
            else if (property_type?.toLowerCase().includes("venta")) q = q.gte("price_sale", min_price)
        }

        return q
    }

    // Intentar con filtros de texto primero
    let { data: properties, error } = await buildQuery(true).limit(limit)
    console.log("[searchProperties] Results with text filter:", properties?.length || 0, error ? `Error: ${error.message}` : "")

    // Fallback: si no hay resultados, intentar sin filtro de texto
    if ((!properties || properties.length === 0) && !error) {
        const fallback = await buildQuery(false).limit(limit)
        properties = fallback.data
        error = fallback.error
        console.log("[searchProperties] Fallback without text filter:", properties?.length || 0)
    }

    if (error) {
        console.error("[searchProperties] Error:", error)
        return { success: false, error: error.message }
    }

    const formatPrice = (price: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price)

    return {
        success: true,
        data: {
            properties: (properties || []).map((p: any) => ({
                id: p.id,
                title: p.title,
                type: p.property_type,
                class: p.property_class,
                location: `${p.neighborhood || ''}, ${p.city || ''}`.replace(/^, |, $/g, ''),
                address: p.address,
                bedrooms: p.bedrooms,
                bathrooms: p.bathrooms,
                area: p.area_m2 ? `${p.area_m2} m²` : null,
                stratum: p.stratum,
                priceRent: p.price_rent ? formatPrice(p.price_rent) : null,
                priceSale: p.price_sale ? formatPrice(p.price_sale) : null,
                priceAdmin: p.price_admin ? formatPrice(p.price_admin) : null,
                image_url: p.images?.[0]?.url || null
            })),
            totalFound: properties?.length || 0,
            tip: "Usa show_property con el ID para mostrar la ficha completa al cliente."
        }
    }
}

async function showProperty(supabase: any, input: any, context: ToolContext): Promise<ToolResult> {
    const { property_id } = ShowPropertySchema.parse(input)

    const { data: property, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", property_id)
        .eq("organization_id", context.organizationId)
        .single()

    if (error || !property) {
        return { success: false, error: "Propiedad no encontrada" }
    }

    const formatPrice = (price: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price)

    // Extraer características relevantes
    const features = (property.features || [])
        .filter((f: any) => f.value && f.value !== "0" && f.value !== "No")
        .map((f: any) => `${f.description}: ${f.valueText || f.value}`)

    return {
        success: true,
        data: {
            ui_component: "property_card",
            property: {
                id: property.id,
                title: property.title,
                description: property.description,
                type: property.property_type,
                class: property.property_class,
                status: property.status,
                location: {
                    city: property.city,
                    neighborhood: property.neighborhood,
                    address: property.address,
                    department: property.department,
                    stratum: property.stratum
                },
                specs: {
                    bedrooms: property.bedrooms,
                    bathrooms: property.bathrooms,
                    area: property.area_m2 ? `${property.area_m2} m²` : null,
                    parking: property.parking_spots,
                    floor: property.floor_number,
                    age: property.age_years ? `${property.age_years} años` : null
                },
                prices: {
                    rent: property.price_rent ? formatPrice(property.price_rent) : null,
                    sale: property.price_sale ? formatPrice(property.price_sale) : null,
                    admin: property.price_admin ? formatPrice(property.price_admin) : null
                },
                images: (property.images || []).slice(0, 10).map((img: any) => img.url),
                features: features.slice(0, 15),
                is_featured: property.is_featured,
                external_code: property.external_code
            }
        }
    }
}
