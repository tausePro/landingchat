import { createClient } from "@/lib/supabase/server"
import {
    ShowProductSchema,
    SearchProductsSchema,
    AddToCartSchema,
    ApplyDiscountSchema,
    GetOrderStatusSchema,
    EscalateToHumanSchema
} from "./tools"

interface ToolExecutionResult {
    success: boolean
    data?: any
    error?: string
    message?: string
}

// Execute show_product tool
export async function executeShowProduct(
    input: unknown,
    organizationId: string
): Promise<ToolExecutionResult> {
    try {
        const { product_id, message } = ShowProductSchema.parse(input)

        const supabase = await createClient()
        const { data: product, error } = await supabase
            .from("products")
            .select("*")
            .eq("id", product_id)
            .eq("organization_id", organizationId)
            .eq("is_active", true)
            .single()

        if (error || !product) {
            return {
                success: false,
                error: "Producto no encontrado"
            }
        }

        return {
            success: true,
            data: {
                type: "product_card",
                product: {
                    id: product.id,
                    name: product.name,
                    description: product.description,
                    price: product.price,
                    image_url: product.image_url || product.images?.[0],
                    stock: product.stock,
                    variants: product.variants
                },
                message: message || `Aquí está el ${product.name}`
            }
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.message
        }
    }
}

// Execute search_products tool
export async function executeSearchProducts(
    input: unknown,
    organizationId: string
): Promise<ToolExecutionResult> {
    try {
        const { query, max_results, min_price, max_price } = SearchProductsSchema.parse(input)

        const supabase = await createClient()
        let queryBuilder = supabase
            .from("products")
            .select("*")
            .eq("organization_id", organizationId)
            .eq("is_active", true)
            .or(`name.ilike.%${query}%,description.ilike.%${query}%`)

        if (min_price !== undefined) {
            queryBuilder = queryBuilder.gte("price", min_price)
        }
        if (max_price !== undefined) {
            queryBuilder = queryBuilder.lte("price", max_price)
        }

        const { data: products, error } = await queryBuilder
            .limit(max_results)
            .order("created_at", { ascending: false })

        if (error) {
            return {
                success: false,
                error: "Error al buscar productos"
            }
        }

        if (!products || products.length === 0) {
            return {
                success: true,
                data: {
                    products: [],
                    message: `No encontré productos que coincidan con "${query}". ¿Podrías ser más específico o probar con otros términos?`
                }
            }
        }

        return {
            success: true,
            data: {
                products: products.map(p => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    price: p.price,
                    image_url: p.image_url || p.images?.[0],
                    stock: p.stock
                })),
                message: `Encontré ${products.length} producto(s) que podrían interesarte:`
            }
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.message
        }
    }
}

// Execute add_to_cart tool
export async function executeAddToCart(
    input: unknown,
    chatId: string
): Promise<ToolExecutionResult> {
    try {
        const { product_id, quantity, variant } = AddToCartSchema.parse(input)

        // This will be handled on the client side via the response
        // We just return the action to be executed
        return {
            success: true,
            data: {
                type: "add_to_cart",
                product_id,
                quantity: quantity || 1,
                variant,
                message: `He agregado ${quantity || 1} unidad(es) al carrito. ¿Deseas continuar comprando o proceder al pago?`
            }
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.message
        }
    }
}

// Execute get_cart tool
export async function executeGetCart(
    chatId: string,
    customerId?: string
): Promise<ToolExecutionResult> {
    try {
        const supabase = await createClient()

        // Get active cart for this chat/customer
        const { data: cart, error } = await supabase
            .from("carts")
            .select("*")
            .eq("chat_id", chatId)
            .eq("status", "active")
            .single()

        if (error || !cart || !cart.items || cart.items.length === 0) {
            return {
                success: true,
                data: {
                    items: [],
                    total: 0,
                    message: "Tu carrito está vacío actualmente."
                }
            }
        }

        const total = cart.items.reduce((sum: number, item: any) =>
            sum + (item.price * item.quantity), 0
        )

        return {
            success: true,
            data: {
                items: cart.items,
                total,
                message: `Tienes ${cart.items.length} producto(s) en tu carrito por un total de $${total.toLocaleString()}`
            }
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.message
        }
    }
}

// Execute apply_discount tool
export async function executeApplyDiscount(
    input: unknown
): Promise<ToolExecutionResult> {
    try {
        const { code } = ApplyDiscountSchema.parse(input)

        // TODO: Implement discount code validation
        // For now, return a placeholder
        return {
            success: false,
            message: "La funcionalidad de códigos de descuento estará disponible próximamente."
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.message
        }
    }
}

// Execute get_order_status tool
export async function executeGetOrderStatus(
    input: unknown,
    customerId?: string
): Promise<ToolExecutionResult> {
    try {
        const { order_id } = GetOrderStatusSchema.parse(input)

        const supabase = await createClient()
        const { data: order, error } = await supabase
            .from("orders")
            .select("*")
            .eq("id", order_id)
            .single()

        if (error || !order) {
            return {
                success: false,
                error: "Orden no encontrada"
            }
        }

        // Verify customer owns this order
        if (customerId && order.customer_id !== customerId) {
            return {
                success: false,
                error: "No tienes permiso para ver esta orden"
            }
        }

        return {
            success: true,
            data: {
                order: {
                    id: order.id,
                    status: order.status,
                    total: order.total,
                    created_at: order.created_at,
                    items: order.items
                },
                message: `Tu orden #${order.id.slice(0, 8)} está en estado: ${order.status}`
            }
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.message
        }
    }
}

// Execute escalate_to_human tool
export async function executeEscalateToHuman(
    input: unknown,
    chatId: string
): Promise<ToolExecutionResult> {
    try {
        const { reason, priority } = EscalateToHumanSchema.parse(input)

        const supabase = await createClient()

        // Update chat status to pending
        await supabase
            .from("chats")
            .update({
                status: "pending",
                metadata: { escalation_reason: reason, priority: priority || "medium" }
            })
            .eq("id", chatId)

        return {
            success: true,
            data: {
                type: "escalation",
                message: "Entiendo. Voy a conectarte con uno de nuestros agentes humanos que podrá ayudarte mejor. Un momento por favor..."
            }
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.message
        }
    }
}

// Main tool executor
export async function executeTool(
    toolName: string,
    toolInput: unknown,
    context: {
        chatId: string
        organizationId: string
        customerId?: string
    }
): Promise<ToolExecutionResult> {
    switch (toolName) {
        case "show_product":
            return executeShowProduct(toolInput, context.organizationId)

        case "search_products":
            return executeSearchProducts(toolInput, context.organizationId)

        case "add_to_cart":
            return executeAddToCart(toolInput, context.chatId)

        case "get_cart":
            return executeGetCart(context.chatId, context.customerId)

        case "apply_discount":
            return executeApplyDiscount(toolInput)

        case "get_order_status":
            return executeGetOrderStatus(toolInput, context.customerId)

        case "escalate_to_human":
            return executeEscalateToHuman(toolInput, context.chatId)

        default:
            return {
                success: false,
                error: `Unknown tool: ${toolName}`
            }
    }
}
