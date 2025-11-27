import { z } from "zod"
import Anthropic from "@anthropic-ai/sdk"

export const tools: Anthropic.Tool[] = [
    // ==================== IDENTIFICACIÓN ====================
    {
        name: "identify_customer",
        description: "Identifica o crea un cliente con su información de contacto. USAR AL INICIO de cada conversación nueva cuando el cliente proporcione su nombre y contacto.",
        input_schema: {
            type: "object" as const,
            properties: {
                name: {
                    type: "string",
                    description: "Nombre completo del cliente"
                },
                email: {
                    type: "string",
                    description: "Email del cliente (opcional si tiene teléfono)"
                },
                phone: {
                    type: "string",
                    description: "Teléfono o WhatsApp del cliente (opcional si tiene email)"
                }
            },
            required: ["name"]
        }
    },

    // ==================== PRODUCTOS ====================
    {
        name: "search_products",
        description: "Busca productos en el catálogo basándose en lo que el cliente describe. Usa esto cuando el cliente dice qué tipo de producto busca.",
        input_schema: {
            type: "object" as const,
            properties: {
                query: {
                    type: "string",
                    description: "Descripción de lo que busca el cliente (ej: 'zapatillas para correr', 'algo económico para regalo')"
                },
                category: {
                    type: "string",
                    description: "Categoría específica si se menciona"
                },
                max_price: {
                    type: "number",
                    description: "Precio máximo si el cliente menciona presupuesto"
                },
                limit: {
                    type: "number",
                    description: "Cantidad de resultados (default 5)"
                }
            },
            required: ["query"]
        }
    },
    {
        name: "show_product",
        description: "Muestra los detalles completos de un producto específico. Usar cuando el cliente quiere ver más info de un producto.",
        input_schema: {
            type: "object" as const,
            properties: {
                product_id: {
                    type: "string",
                    description: "ID del producto a mostrar"
                }
            },
            required: ["product_id"]
        }
    },
    {
        name: "get_product_availability",
        description: "Verifica el stock disponible de un producto.",
        input_schema: {
            type: "object" as const,
            properties: {
                product_id: {
                    type: "string",
                    description: "ID del producto"
                },
                variant: {
                    type: "string",
                    description: "Variante específica (talla, color, etc.)"
                }
            },
            required: ["product_id"]
        }
    },

    // ==================== CARRITO ====================
    {
        name: "add_to_cart",
        description: "Agrega un producto al carrito del cliente. Usar cuando el cliente confirma que quiere agregar algo.",
        input_schema: {
            type: "object" as const,
            properties: {
                product_id: {
                    type: "string",
                    description: "ID del producto a agregar"
                },
                quantity: {
                    type: "number",
                    description: "Cantidad a agregar (default 1)"
                },
                variant: {
                    type: "string",
                    description: "Variante si aplica (talla, color)"
                }
            },
            required: ["product_id"]
        }
    },
    {
        name: "get_cart",
        description: "Obtiene el contenido actual del carrito. Usar cuando el cliente pregunta qué tiene en el carrito o quiere revisar antes de pagar.",
        input_schema: {
            type: "object" as const,
            properties: {}
        }
    },
    {
        name: "remove_from_cart",
        description: "Elimina un producto del carrito.",
        input_schema: {
            type: "object" as const,
            properties: {
                product_id: {
                    type: "string",
                    description: "ID del producto a eliminar"
                }
            },
            required: ["product_id"]
        }
    },
    {
        name: "update_cart_quantity",
        description: "Actualiza la cantidad de un producto en el carrito.",
        input_schema: {
            type: "object" as const,
            properties: {
                product_id: {
                    type: "string",
                    description: "ID del producto"
                },
                quantity: {
                    type: "number",
                    description: "Nueva cantidad"
                }
            },
            required: ["product_id", "quantity"]
        }
    },

    // ==================== CHECKOUT ====================
    {
        name: "start_checkout",
        description: "Inicia el proceso de pago. Usar cuando el cliente dice que quiere pagar o finalizar la compra.",
        input_schema: {
            type: "object" as const,
            properties: {
                shipping_address: {
                    type: "string",
                    description: "Dirección de envío si ya la proporcionó"
                },
                city: {
                    type: "string",
                    description: "Ciudad de envío"
                }
            }
        }
    },
    {
        name: "get_shipping_options",
        description: "Obtiene las opciones de envío disponibles y sus costos.",
        input_schema: {
            type: "object" as const,
            properties: {
                city: {
                    type: "string",
                    description: "Ciudad de destino"
                },
                address: {
                    type: "string",
                    description: "Dirección completa"
                }
            }
        }
    },
    {
        name: "apply_discount",
        description: "Aplica un código de descuento al carrito.",
        input_schema: {
            type: "object" as const,
            properties: {
                code: {
                    type: "string",
                    description: "Código de descuento"
                }
            },
            required: ["code"]
        }
    },

    // ==================== INFORMACIÓN ====================
    {
        name: "get_store_info",
        description: "Obtiene información de la tienda como horarios, políticas de envío, devoluciones, etc.",
        input_schema: {
            type: "object" as const,
            properties: {
                topic: {
                    type: "string",
                    description: "Tema específico: 'shipping', 'returns', 'hours', 'payment_methods', 'contact'"
                }
            }
        }
    },
    {
        name: "get_order_status",
        description: "Consulta el estado de una orden existente.",
        input_schema: {
            type: "object" as const,
            properties: {
                order_id: {
                    type: "string",
                    description: "ID de la orden (si lo tiene)"
                },
                email: {
                    type: "string",
                    description: "Email usado en la compra (alternativa al order_id)"
                }
            }
        }
    },
    {
        name: "get_customer_history",
        description: "Obtiene el historial de compras y preferencias del cliente actual. Usar para personalizar recomendaciones.",
        input_schema: {
            type: "object" as const,
            properties: {}
        }
    },

    // ==================== ESCALAMIENTO ====================
    {
        name: "escalate_to_human",
        description: "Transfiere la conversación a un agente humano. Usar cuando: el cliente lo pide explícitamente, hay un problema que no puedes resolver, o detectas frustración.",
        input_schema: {
            type: "object" as const,
            properties: {
                reason: {
                    type: "string",
                    description: "Motivo del escalamiento"
                },
                priority: {
                    type: "string",
                    description: "'high', 'medium', 'low'"
                }
            },
            required: ["reason"]
        }
    }
]

// Zod schemas for validation (matching the tool definitions exactly)
export const IdentifyCustomerSchema = z.object({
    name: z.string(),
    email: z.string().optional(),
    phone: z.string().optional()
})

export const SearchProductsSchema = z.object({
    query: z.string(),
    category: z.string().optional(),
    max_price: z.coerce.number().optional(),
    limit: z.coerce.number().optional().default(5)
})

export const ShowProductSchema = z.object({
    product_id: z.string()
})

export const GetProductAvailabilitySchema = z.object({
    product_id: z.string(),
    variant: z.string().optional()
})

export const AddToCartSchema = z.object({
    product_id: z.string(),
    quantity: z.coerce.number().optional().default(1),
    variant: z.string().optional()
})

export const GetCartSchema = z.object({})

export const RemoveFromCartSchema = z.object({
    product_id: z.string()
})

export const UpdateCartQuantitySchema = z.object({
    product_id: z.string(),
    quantity: z.coerce.number()
})

export const StartCheckoutSchema = z.object({
    shipping_address: z.string().optional(),
    city: z.string().optional()
})

export const GetShippingOptionsSchema = z.object({
    city: z.string().optional(),
    address: z.string().optional()
})

export const ApplyDiscountSchema = z.object({
    code: z.string()
})

export const GetStoreInfoSchema = z.object({
    topic: z.string().optional()
})

export const GetOrderStatusSchema = z.object({
    order_id: z.string().optional(),
    email: z.string().optional()
})

export const GetCustomerHistorySchema = z.object({})

export const EscalateToHumanSchema = z.object({
    reason: z.string(),
    priority: z.string().optional().default("medium")
})
