interface Product {
    id: string
    name: string
    description?: string
    price: number
    stock: number
    categories?: string[]
    image_url?: string
    images?: string[]
    variants?: Array<{ type: string; values: string[] }>
}

interface Customer {
    id: string
    name?: string
    email?: string
    phone?: string
    metadata?: any
}

interface Order {
    id: string
    created_at: string
    total: number
    status: string
    items: any[]
}

interface AgentConfig {
    name: string
    system_prompt?: string
    configuration?: {
        greeting?: string
        tone?: string
        personality?: string
    }
}

interface Message {
    role: 'user' | 'assistant'
    content: string
}

// Build system prompt with all context
export function buildSystemPrompt(
    agent: AgentConfig,
    organizationName: string,
    products: Product[]
): string {
    const basePrompt = agent.system_prompt || `Eres ${agent.name}, asistente de ventas de ${organizationName}.`

    const personality = agent.configuration?.personality || "amigable y profesional"
    const tone = agent.configuration?.tone || "conversacional"

    return `${basePrompt}

PERSONALIDAD Y TONO:
- Sé ${personality}
- Usa un tono ${tone}
- Sé natural y conversacional, no robótico

OBJETIVO:
Ayudar al cliente a encontrar productos y completar su compra de forma natural y conversacional.

REGLAS IMPORTANTES:
1. Siempre saluda si es el primer mensaje de la conversación
2. Haz preguntas para entender las necesidades del cliente antes de recomendar
3. Muestra máximo 3 productos por respuesta para no abrumar
4. Si el cliente pregunta algo fuera de tu alcance, ofrece escalar a un agente humano
5. NUNCA inventes información sobre productos que no existe
6. Usa SOLO el catálogo proporcionado como fuente de verdad
7. Si un producto no está en stock, no lo recomiendes
8. Sé proactivo: sugiere productos complementarios cuando sea relevante
9. Confirma antes de agregar productos al carrito

CATÁLOGO DISPONIBLE:
Tienes acceso a ${products.length} productos. Usa la herramienta 'search_products' para buscar productos relevantes basándote en lo que el cliente necesita.

HERRAMIENTAS DISPONIBLES:
- show_product: Para mostrar un producto específico
- search_products: Para buscar productos en el catálogo
- add_to_cart: Para agregar productos al carrito (solo después de confirmación)
- get_cart: Para ver qué hay en el carrito
- apply_discount: Para aplicar códigos de descuento
- get_order_status: Para consultar órdenes existentes
- escalate_to_human: Para transferir a un agente humano

Recuerda: Tu objetivo es ayudar al cliente a encontrar lo que necesita y guiarlo hacia una compra satisfactoria.`
}

// Format products for context
export function buildProductContext(products: Product[]): string {
    if (products.length === 0) return "No hay productos disponibles actualmente."

    const productList = products.map(p => {
        const variants = p.variants?.map(v => `${v.type}: ${v.values.join(', ')}`).join(' | ') || ''
        const categories = p.categories?.join(', ') || ''

        return `- ${p.name} (ID: ${p.id})
  Precio: $${p.price.toLocaleString()}
  Stock: ${p.stock} unidades
  ${p.description ? `Descripción: ${p.description}` : ''}
  ${categories ? `Categorías: ${categories}` : ''}
  ${variants ? `Variantes: ${variants}` : ''}`
    }).join('\n\n')

    return `Productos disponibles:\n\n${productList}`
}

// Build customer context
export function buildCustomerContext(customer?: Customer, orders?: Order[]): string {
    if (!customer) return ""

    let context = `INFORMACIÓN DEL CLIENTE:\n`
    context += `- Nombre: ${customer.name || 'No proporcionado'}\n`
    context += `- Email: ${customer.email || 'No proporcionado'}\n`

    if (orders && orders.length > 0) {
        context += `\nHISTORIAL DE COMPRAS:\n`
        const lastOrder = orders[0]
        context += `- Última compra: ${new Date(lastOrder.created_at).toLocaleDateString()}\n`
        context += `- Total: $${lastOrder.total.toLocaleString()}\n`
        context += `- Estado: ${lastOrder.status}\n`

        if (orders.length > 1) {
            context += `- Total de órdenes: ${orders.length}\n`
        }
    }

    return context
}

// Build conversation history for Claude
export function buildConversationHistory(messages: Message[]): Array<{ role: 'user' | 'assistant'; content: string }> {
    // Claude expects alternating user/assistant messages
    // Filter and format accordingly
    return messages.map(msg => ({
        role: msg.role,
        content: msg.content
    }))
}

// Build cart context
export function buildCartContext(cart?: { items: any[]; total: number }): string {
    if (!cart || cart.items.length === 0) {
        return "CARRITO ACTUAL: Vacío"
    }

    let context = `CARRITO ACTUAL:\n`
    cart.items.forEach(item => {
        context += `- ${item.name} x${item.quantity} = $${(item.price * item.quantity).toLocaleString()}\n`
    })
    context += `\nTotal: $${cart.total.toLocaleString()}`

    return context
}
