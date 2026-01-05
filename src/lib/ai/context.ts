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
    avatar_url?: string
    configuration?: {
        greeting?: string
        tone?: string
        personality?: {
            tone?: string
            instructions?: string
        }
    }
}

interface Message {
    role: 'user' | 'assistant'
    content: string
}

// Build system prompt - OPTIMIZED version that only needs product count (not all products)
export function buildSystemPromptOptimized(
    agent: AgentConfig,
    organizationName: string,
    productCount: number,
    customer?: Customer,
    currentProduct?: Product
): string {
    const customInstructions = agent.configuration?.personality?.instructions
    const hasCustomPrompt = customInstructions && customInstructions.trim().length > 50

    console.log("[buildSystemPrompt] Custom instructions found:", hasCustomPrompt, customInstructions?.substring(0, 80) + "...")

    let prompt = ""

    if (hasCustomPrompt) {
        prompt = `${customInstructions}

---
FORMATO DE RESPUESTA:
- Escribe respuestas cortas y claras
- Usa párrafos separados (máximo 2-3 oraciones por párrafo)
- Deja una línea en blanco entre párrafos para mejor legibilidad
- No escribas todo en un solo bloque de texto

CONTEXTO TÉCNICO (información adicional para esta conversación):

${customer ? `CLIENTE: Estás hablando con ${customer.name || 'el cliente'}.` : 'CLIENTE: Nuevo cliente, no identificado aún.'}

CATÁLOGO: Tienes acceso a ${productCount} productos de ${organizationName}. Usa search_products para buscar.

${currentProduct ? `
CONTEXTO ACTUAL (PRIORIDAD MÁXIMA):
El cliente está viendo AHORA MISMO: "${currentProduct.name}"
Precio: ${currentProduct.price.toLocaleString()}
Stock: ${currentProduct.stock}

INSTRUCCIÓN IMPORTANTE: Si el cliente dice "me interesa este producto" o pregunta detalles, se refiere EXCLUSIVAMENTE a "${currentProduct.name}". IGNORA cualquier producto del que hayan hablado antes en el historial para esta nueva consulta.` : ''}

HERRAMIENTAS DISPONIBLES (úsalas cuando sea necesario):
- search_products: Buscar productos por nombre o categoría (ÚSALA SIEMPRE antes de mencionar que tenemos algo)
- show_product: Mostrar tarjeta visual de un producto (IMPORTANTE: úsala para que el cliente vea imagen y botón de compra)
- add_to_cart: Agregar producto al carrito
- get_cart: Ver contenido del carrito
- start_checkout: Iniciar proceso de pago
- confirm_shipping_details: CONFIRMAR datos de envío cuando el cliente los proporcione (nombre, email, teléfono, dirección, ciudad, documento)
- escalate_to_human: Transferir a agente humano si es necesario

REGLAS CRÍTICAS DE VERACIDAD (ANTI-ALUCINACIONES):
1. NO inventes productos, precios ni características. Si no lo encuentras con search_products, di que no lo tenemos.
2. NO prometas envío gratis ni descuentos que no estén explícitamente en la información del negocio.
3. Si el cliente pregunta por un producto que no está en el contexto actual, DEBES usar search_products para verificar si existe.

OTRAS REGLAS:
- Si mencionas un producto, usa 'show_product' para que el cliente lo vea visualmente con imagen y botón de agregar
- CUANDO el cliente proporcione TODOS sus datos de envío (nombre, email, teléfono, dirección, ciudad, documento), usa 'confirm_shipping_details' para confirmarlos antes de proceder al pago
---`
    } else {
        const basePrompt = agent.system_prompt || `Eres ${agent.name}, asistente de ventas de ${organizationName}.`
        const personality = agent.configuration?.personality?.tone || "amigable y profesional"

        prompt = `${basePrompt}

PERSONALIDAD: Sé ${personality}, natural y conversacional.

OBJETIVO: Ayudar al cliente a encontrar productos y completar su compra.

FORMATO DE RESPUESTA:
- Escribe respuestas cortas y claras
- Usa párrafos separados (máximo 2-3 oraciones por párrafo)
- Deja una línea en blanco entre párrafos para mejor legibilidad
- No escribas todo en un solo bloque de texto

${customer ? `CLIENTE: ${customer.name || 'Cliente'}` : 'CLIENTE: Nuevo cliente.'}

${currentProduct ? `
CONTEXTO ACTUAL: El cliente está viendo "${currentProduct.name}" (${currentProduct.price.toLocaleString()}, stock: ${currentProduct.stock}).
Menciona este producto cuando saluden.
` : ''}

REGLAS DE ORO (ANTI-ALUCINACIONES):
1. JAMÁS inventes productos. Si search_products no devuelve nada, di que no lo tenemos.
2. JAMÁS inventes precios o promociones de envío.
3. Verifica siempre el stock antes de ofrecer.

CATÁLOGO: ${productCount} productos disponibles. Usa search_products para buscar.

HERRAMIENTAS:
- search_products: Buscar productos (ÚSALA SIEMPRE ANTES DE RESPONDER SOBRE DISPONIBILIDAD)
- show_product: Mostrar tarjeta del producto (usa siempre que menciones un producto)
- add_to_cart: Agregar al carrito
- get_cart: Ver carrito
- start_checkout: Iniciar pago
- confirm_shipping_details: Confirmar datos de envío completos
- escalate_to_human: Transferir a humano

IMPORTANTE: 
- Usa 'show_product' para que el cliente vea imagen y botón de compra
- Usa 'confirm_shipping_details' cuando tengas TODOS los datos del cliente (nombre, email, teléfono, dirección, ciudad, documento)`
    }

    return prompt
}

// Legacy function - calls optimized version (for backwards compatibility)
export function buildSystemPrompt(
    agent: AgentConfig,
    organizationName: string,
    products: Product[],
    customer?: Customer,
    currentProduct?: Product
): string {
    return buildSystemPromptOptimized(agent, organizationName, products.length, customer, currentProduct)
}

// Format products for context
export function buildProductContext(products: Product[]): string {
    if (products.length === 0) return "No hay productos disponibles actualmente."

    const productList = products.map(p => {
        const variants = p.variants?.map(v => `${v.type}: ${v.values.join(', ')}`).join(' | ') || ''
        const categories = p.categories?.join(', ') || ''

        return `- ${p.name} (ID: ${p.id})
  Precio: ${p.price.toLocaleString()}
  Stock: ${p.stock} unidades
  ${p.description ? `Descripción: ${p.description}` : ''}
  ${categories ? `Categorías: ${categories}` : ''}
  ${variants ? `Variantes: ${variants}` : ''}`
    }).join('\n\n')

    return `Productos disponibles:\n\n${productList}`
}

// Build customer context
export function buildCustomerContext(customer?: Customer, orders?: Order[]): string {
    if (!customer) return "Cliente no identificado. Si proporciona nombre y contacto, usa identify_customer."

    let context = `INFORMACIÓN DEL CLIENTE:\n`
    context += `- Nombre: ${customer.name || 'No proporcionado'}\n`
    context += `- Email: ${customer.email || 'No proporcionado'}\n`
    context += `- Teléfono: ${customer.phone || 'No proporcionado'}\n`

    if (orders && orders.length > 0) {
        context += `\nHISTORIAL DE COMPRAS:\n`
        const lastOrder = orders[0]
        context += `- Última compra: ${new Date(lastOrder.created_at).toLocaleDateString()}\n`
        context += `- Total: ${lastOrder.total.toLocaleString()}\n`
        context += `- Estado: ${lastOrder.status}\n`

        if (orders.length > 1) {
            context += `- Total de órdenes: ${orders.length}\n`
        }
    } else {
        context += `\nEs un cliente nuevo o sin compras previas.\n`
    }

    return context
}

// Build conversation history for Claude
export function buildConversationHistory(messages: Message[]): Array<{ role: 'user' | 'assistant'; content: string }> {
    return messages.map(msg => ({
        role: msg.role,
        content: msg.content
    }))
}

// Build cart context
export function buildCartContext(cart?: { items: any[]; total?: number }): string {
    if (!cart || !cart.items || cart.items.length === 0) {
        return "CARRITO ACTUAL: Vacío"
    }

    let context = `CARRITO ACTUAL:\n`
    cart.items.forEach(item => {
        const price = item.price || 0
        const quantity = item.quantity || 0
        const subtotal = price * quantity
        context += `- ${item.name || 'Producto'} x${quantity} = ${subtotal.toLocaleString()}\n`
    })

    const total = cart.total || cart.items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0)
    context += `\nTotal: ${total.toLocaleString()}`

    return context
}
