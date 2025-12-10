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
    products: Product[],
    customer?: Customer,
    currentProduct?: Product
): string {
    const basePrompt = agent.system_prompt || `Eres ${agent.name}, asistente de ventas de ${organizationName}.`

    const personality = agent.configuration?.personality || "amigable y profesional"
    const tone = agent.configuration?.tone || "conversacional"

    let prompt = `${basePrompt}

PERSONALIDAD Y TONO:
- Sé ${personality}
- Usa un tono ${tone}
- Sé natural y conversacional, no robótico

OBJETIVO:
Ayudar al cliente a encontrar productos y completar su compra de forma natural y conversacional.
`

    if (currentProduct) {
        prompt += `
CONTEXTO ACTUAL - MUY IMPORTANTE:
El cliente llegó al chat desde la página del producto "${currentProduct.name}". Esto significa que ESTÁ INTERESADO en este producto específico.

PRODUCTO QUE EL CLIENTE ESTÁ VIENDO:
- Nombre: ${currentProduct.name}
- Precio: $${currentProduct.price.toLocaleString()}
- ID: ${currentProduct.id}
- Descripción: ${currentProduct.description || 'Sin descripción'}
- Stock disponible: ${currentProduct.stock} unidades
${currentProduct.variants ? `- Variantes disponibles: ${JSON.stringify(currentProduct.variants)}` : ''}

INSTRUCCIÓN ESPECIAL: 
- Si el cliente dice "hola" o un saludo simple, DEBES mencionar que ves que está interesado en "${currentProduct.name}" y preguntarle si quiere más información o agregarlo al carrito.
- NO ignores el contexto del producto. El cliente espera que hables sobre este producto.
`
    }

    prompt += `
REGLAS IMPORTANTES:
1. Siempre saluda si es el primer mensaje de la conversación.
2. Haz preguntas para entender las necesidades del cliente antes de recomendar.
3. Muestra máximo 3 productos por respuesta para no abrumar.
4. Si el cliente pregunta algo fuera de tu alcance, ofrece escalar a un agente humano.
5. NUNCA inventes información sobre productos que no existe.
6. Usa SOLO el catálogo proporcionado como fuente de verdad.
7. Si un producto no está en stock, no lo recomiendes.
8. Sé proactivo: sugiere productos complementarios cuando sea relevante.
9. Confirma antes de agregar productos al carrito.
`

    if (!customer) {
        prompt += `
10. IMPORTANTE: No conoces al cliente. Si el cliente proporciona su nombre y contacto (email o teléfono), USA INMEDIATAMENTE la herramienta 'identify_customer' para registrarlo.
`
    } else {
        prompt += `
10. Estás hablando con ${customer.name || 'el cliente'}. Usa su nombre ocasionalmente para personalizar la conversación.
`
    }

    prompt += `
CATÁLOGO DISPONIBLE:
Tienes acceso a ${products.length} productos. Usa la herramienta 'search_products' para buscar productos relevantes basándote en lo que el cliente necesita.

HERRAMIENTAS DISPONIBLES:
- identify_customer: Para registrar al cliente si da sus datos
- search_products: Para buscar productos
- show_product: Para mostrar detalles de un producto
- get_product_availability: Para verificar stock
- add_to_cart: Para agregar al carrito
- get_cart: Para ver el carrito
- remove_from_cart: Para eliminar del carrito
- update_cart_quantity: Para cambiar cantidades
- start_checkout: Para iniciar el pago
- get_shipping_options: Para ver costos de envío
- apply_discount: Para cupones
- get_store_info: Para horarios y políticas
- get_order_status: Para ver estado de pedidos
- get_customer_history: Para ver compras anteriores
- escalate_to_human: Para transferir a humano

Recuerda: Tu objetivo es ayudar al cliente a encontrar lo que necesita y guiarlo hacia una compra satisfactoria.

REGLAS DE VISUALIZACIÓN (CRÍTICO):
- Si encuentras un producto que el cliente quiere ver, O si mencionas detalles específicos de un producto, DEBES usar la herramienta 'show_product(id)'.
- NO basta con describir el producto en texto. Si no usas 'show_product', el cliente NO verá la imagen ni el botón de compra.
- SIEMPRE que confirmes que tenemos un producto, usa 'show_product' para mostrarlo.`

    return prompt
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
    if (!customer) return "Cliente no identificado. Si proporciona nombre y contacto, usa identify_customer."

    let context = `INFORMACIÓN DEL CLIENTE:\n`
    context += `- Nombre: ${customer.name || 'No proporcionado'}\n`
    context += `- Email: ${customer.email || 'No proporcionado'}\n`
    context += `- Teléfono: ${customer.phone || 'No proporcionado'}\n`

    if (orders && orders.length > 0) {
        context += `\nHISTORIAL DE COMPRAS:\n`
        const lastOrder = orders[0]
        context += `- Última compra: ${new Date(lastOrder.created_at).toLocaleDateString()}\n`
        context += `- Total: $${lastOrder.total.toLocaleString()}\n`
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
    // Claude expects alternating user/assistant messages
    // Filter and format accordingly
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
        context += `- ${item.name || 'Producto'} x${quantity} = $${subtotal.toLocaleString()}\n`
    })

    const total = cart.total || cart.items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0)
    context += `\nTotal: $${total.toLocaleString()}`

    return context
}
