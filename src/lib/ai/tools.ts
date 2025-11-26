import { z } from "zod"

// Tool definitions for Claude
export const tools = [
    {
        name: "show_product",
        description: "Muestra un producto específico al cliente con su imagen, precio y descripción. Usa esto cuando el cliente pregunte por un producto o cuando quieras recomendar algo específico.",
        input_schema: {
            type: "object" as const,
            properties: {
                product_id: {
                    type: "string",
                    description: "ID del producto a mostrar"
                },
                message: {
                    type: "string",
                    description: "Mensaje personalizado para acompañar el producto (opcional)"
                }
            },
            required: ["product_id"]
        }
    },
    {
        name: "search_products",
        description: "Busca productos en el catálogo basándose en criterios como nombre, categoría, precio, etc. Retorna una lista de productos que coinciden.",
        input_schema: {
            type: "object" as const,
            properties: {
                query: {
                    type: "string",
                    description: "Término de búsqueda (nombre, descripción, categoría)"
                },
                max_results: {
                    type: "number",
                    description: "Número máximo de resultados a retornar (default: 5)"
                },
                min_price: {
                    type: "number",
                    description: "Precio mínimo (opcional)"
                },
                max_price: {
                    type: "number",
                    description: "Precio máximo (opcional)"
                }
            },
            required: ["query"]
        }
    },
    {
        name: "add_to_cart",
        description: "Agrega un producto al carrito del cliente. Usa esto cuando el cliente confirme que quiere comprar algo.",
        input_schema: {
            type: "object" as const,
            properties: {
                product_id: {
                    type: "string",
                    description: "ID del producto a agregar"
                },
                quantity: {
                    type: "number",
                    description: "Cantidad a agregar (default: 1)"
                },
                variant: {
                    type: "string",
                    description: "Variante seleccionada (talla, color, etc.) si aplica"
                }
            },
            required: ["product_id"]
        }
    },
    {
        name: "get_cart",
        description: "Obtiene el estado actual del carrito del cliente (productos, cantidades, total).",
        input_schema: {
            type: "object" as const,
            properties: {},
            required: []
        }
    },
    {
        name: "apply_discount",
        description: "Aplica un código de descuento al carrito del cliente.",
        input_schema: {
            type: "object" as const,
            properties: {
                code: {
                    type: "string",
                    description: "Código de descuento a aplicar"
                }
            },
            required: ["code"]
        }
    },
    {
        name: "get_order_status",
        description: "Consulta el estado de una orden existente del cliente.",
        input_schema: {
            type: "object" as const,
            properties: {
                order_id: {
                    type: "string",
                    description: "ID de la orden a consultar"
                }
            },
            required: ["order_id"]
        }
    },
    {
        name: "escalate_to_human",
        description: "Transfiere la conversación a un agente humano cuando no puedas resolver la consulta o el cliente lo solicite.",
        input_schema: {
            type: "object" as const,
            properties: {
                reason: {
                    type: "string",
                    description: "Razón por la cual se escala a humano"
                },
                priority: {
                    type: "string",
                    enum: ["low", "medium", "high"],
                    description: "Prioridad de la solicitud"
                }
            },
            required: ["reason"]
        }
    }
] as const

// Zod schemas for validation
export const ShowProductSchema = z.object({
    product_id: z.string(),
    message: z.string().optional()
})

export const SearchProductsSchema = z.object({
    query: z.string(),
    max_results: z.number().optional().default(5),
    min_price: z.number().optional(),
    max_price: z.number().optional()
})

export const AddToCartSchema = z.object({
    product_id: z.string(),
    quantity: z.number().optional().default(1),
    variant: z.string().optional()
})

export const ApplyDiscountSchema = z.object({
    code: z.string()
})

export const GetOrderStatusSchema = z.object({
    order_id: z.string()
})

export const EscalateToHumanSchema = z.object({
    reason: z.string(),
    priority: z.enum(["low", "medium", "high"]).optional().default("medium")
})

export type ToolName = typeof tools[number]["name"]
