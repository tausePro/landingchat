import { createClient } from "@/lib/supabase/server"
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
    GetStoreInfoSchema,
    GetOrderStatusSchema,
    GetCustomerHistorySchema,
    EscalateToHumanSchema
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

    const supabase = await createClient()

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

            case "get_store_info":
                return await getStoreInfo(supabase, input, context)

            case "get_order_status":
                return await getOrderStatus(supabase, input, context)

            case "get_customer_history":
                return await getCustomerHistory(supabase, context)

            case "escalate_to_human":
                return await escalateToHuman(supabase, input, context)

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

    // Por ahora, opciones fijas. Después se pueden configurar por organización
    const options = [
        {
            id: "standard",
            name: "Envío Estándar",
            price: 10000,
            days: "3-5 días hábiles"
        },
        {
            id: "express",
            name: "Envío Express",
            price: 20000,
            days: "1-2 días hábiles"
        }
    ]

    if (city?.toLowerCase().includes("bogota") || city?.toLowerCase().includes("bogotá")) {
        options.push({
            id: "same_day",
            name: "Mismo Día",
            price: 15000,
            days: "Hoy"
        })
    }

    return {
        success: true,
        data: { options, city }
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
        .select("full_name, metadata, total_orders, total_spent")
        .eq("id", context.customerId)
        .single()

    const { data: orders } = await supabase
        .from("orders")
        .select("id, items, total, status, created_at")
        .eq("customer_id", context.customerId)
        .order("created_at", { ascending: false })
        .limit(5)

    // Extraer productos comprados para recomendaciones
    const purchasedProducts = orders?.flatMap((o: any) => o.items?.map((i: any) => i.name)) || []
    const categories = [...new Set(purchasedProducts)]

    return {
        success: true,
        data: {
            hasHistory: true,
            customer: {
                name: customer?.full_name,
                totalOrders: customer?.total_orders || 0,
                totalSpent: customer?.total_spent || 0
            },
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
