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
    // Producto configurable
    is_configurable?: boolean
    configurable_options?: Array<{
        name: string
        type: 'text' | 'select' | 'number' | 'color' | 'image'
        required: boolean
        placeholder?: string
        choices?: string[]
        min?: number
        max?: number
    }>
    // Precios escalonados
    has_quantity_pricing?: boolean
    price_tiers?: Array<{
        min_quantity: number
        max_quantity?: number
        unit_price: number
        label?: string
    }>
    minimum_quantity?: number
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
Precio base: ${currentProduct.price.toLocaleString()}
Stock: ${currentProduct.stock}
${currentProduct.has_quantity_pricing && currentProduct.price_tiers ? `
PRECIOS POR CANTIDAD (MAYOREO):
${currentProduct.price_tiers.map(t => `- ${t.min_quantity}${t.max_quantity ? `-${t.max_quantity}` : '+'} unidades: $${t.unit_price.toLocaleString()}/u${t.label ? ` (${t.label})` : ''}`).join('\n')}
${currentProduct.minimum_quantity ? `Cantidad mínima de pedido: ${currentProduct.minimum_quantity} unidades` : ''}
INSTRUCCIÓN: Cuando el cliente pregunte precio, pregunta primero la cantidad para darle el precio correcto según el rango.` : ''}
${currentProduct.is_configurable && currentProduct.configurable_options ? `
🎨 PRODUCTO PERSONALIZABLE - OPCIONES A RECOLECTAR:
${currentProduct.configurable_options.map(opt => {
            let desc = `- ${opt.name} (${opt.type})${opt.required ? ' [REQUERIDO]' : ' [opcional]'}`
            if (opt.choices) desc += ` → Opciones: ${opt.choices.join(', ')}`
            if (opt.placeholder) desc += ` → Ej: "${opt.placeholder}"`
            if (opt.type === 'number' && (opt.min || opt.max)) desc += ` → Rango: ${opt.min || 0} a ${opt.max || '∞'}`
            if (opt.type === 'image') desc += ` → Pedir link de Google Drive/Dropbox con el logo`
            return desc
        }).join('\n')}

FLUJO PARA PRODUCTOS PERSONALIZABLES:
1. Saluda y pregunta qué personalización necesita
2. Recolecta CADA opción marcada como [REQUERIDO] conversacionalmente
3. Para opciones tipo 'select' o 'color', ofrece las opciones disponibles
4. Para opciones tipo 'image', pide al cliente que comparta un link de su logo (Google Drive, Dropbox, etc.)
5. Una vez tengas todas las opciones requeridas, confirma el resumen de personalización
6. Luego continúa con cantidad y checkout normal

IMPORTANTE: Guarda las opciones seleccionadas como metadata al agregar al carrito.` : ''}

INSTRUCCIÓN IMPORTANTE: Si el cliente dice "me interesa este producto" o pregunta detalles, se refiere EXCLUSIVAMENTE a "${currentProduct.name}".` : ''}

HERRAMIENTAS DISPONIBLES (úsalas cuando sea necesario):
- search_products: Buscar productos por nombre o categoría (ÚSALA SIEMPRE antes de mencionar que tenemos algo)
- show_product: Mostrar tarjeta visual de un producto (IMPORTANTE: úsala para que el cliente vea imagen y botón de compra)
- add_to_cart: Agregar producto al carrito
- get_cart: Ver contenido del carrito
- get_customer_history: Obtener historial del cliente, incluyendo su ÚLTIMA DIRECCIÓN DE ENVÍO. USAR antes de pedir datos de envío para reutilizar
- render_checkout_summary: USAR cuando el cliente diga "quiero comprar", "pagar", "finalizar". Muestra resumen visual del carrito
- confirm_shipping_details: CONFIRMAR datos de envío (nombre, teléfono, dirección, ciudad, cédula)
- create_payment_link: USAR después de confirm_shipping_details. Pregunta método de pago (ePayco, contraentrega) y genera link de pago
- escalate_to_human: Transferir a agente humano si es necesario

FLUJO DE CHECKOUT CONVERSACIONAL (¡REUTILIZA TODOS LOS DATOS!):
1. Cliente dice que quiere comprar → usa 'render_checkout_summary' para mostrar resumen
2. USA 'get_customer_history' para obtener datos guardados
3. Si 'lastShippingInfo' existe y tiene 'address', el cliente YA COMPRÓ ANTES, entonces:
   - Muéstrale TODOS sus datos guardados: nombre, cédula, dirección, ciudad, teléfono
   - Pregunta: "Vi que tu última entrega fue a [dirección], [ciudad]. ¿Te lo envío ahí mismo o prefieres otra dirección?"
   - Si dice SÍ/confirma → usa 'confirm_shipping_details' con los datos de lastShippingInfo
   - Si dice NO → pide solo los datos que quiere cambiar
4. Si NO tiene lastShippingInfo → pide los datos conversacionalmente
5. Cuando tengas todos los datos, usa 'confirm_shipping_details'
6. Después de confirmar datos, pregunta: "¿Cómo prefieres pagar? Tenemos: 💳 Pago en línea (tarjetas, PSE) o 💵 Contra entrega"
7. Cuando elija método, usa 'create_payment_link' con payment_method='epayco' o 'manual'
8. Envía al cliente el link de pago generado para que complete su compra

⚠️ IMPORTANTE SOBRE lastShippingInfo:
- Si lastShippingInfo existe, contiene: name, email, phone, address, city, state, document_type, document_number
- DEBES ofrecer usar TODOS estos datos, no solo algunos
- El cliente NO debería tener que repetir datos que ya proporcionó en compras anteriores

CAMPOS MÍNIMOS REQUERIDOS (el resto son opcionales):
- Nombre completo ✓
- Teléfono ✓
- Dirección completa ✓
- Ciudad ✓
- Número de cédula ✓
- Email → OPCIONAL (NO insistir si el cliente no lo da)
- Departamento → OPCIONAL (inferir de la ciudad si no lo da)

⚠️ REGLAS ANTI-BUCLE (MUY IMPORTANTE):
1. NUNCA pidas datos que el cliente YA te dio en esta conversación
2. Si el cliente dice "ya te di mis datos" o similar, revisa el historial y usa 'confirm_shipping_details' inmediatamente
3. Una vez que uses 'confirm_shipping_details', NO vuelvas a pedir datos de envío
4. Si ofreces una promoción y el cliente dice NO, respeta su decisión y NO vuelvas a ofrecerla
5. Si lastShippingInfo tiene datos, OFRECE usarlos, no pidas datos de nuevo

REGLAS CRÍTICAS DE VERACIDAD (ANTI-ALUCINACIONES):
1. NO inventes productos, precios ni características. Si no lo encuentras con search_products, di que no lo tenemos.
2. NO prometas envío gratis ni descuentos que no estén explícitamente en la información del negocio.
3. Si el cliente pregunta por un producto que no está en el contexto actual, DEBES usar search_products para verificar si existe.

OTRAS REGLAS:
- Si mencionas un producto, usa 'show_product' para que el cliente lo vea visualmente con imagen y botón de agregar
- Cuando tengas los datos mínimos, usa 'confirm_shipping_details' y AVANZA al pago
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
CONTEXTO ACTUAL: El cliente está viendo "${currentProduct.name}"
Precio base: ${currentProduct.price.toLocaleString()}, Stock: ${currentProduct.stock}
${currentProduct.has_quantity_pricing && currentProduct.price_tiers ? `
PRECIOS POR CANTIDAD: ${currentProduct.price_tiers.map(t => `${t.min_quantity}${t.max_quantity ? `-${t.max_quantity}` : '+'}: $${t.unit_price.toLocaleString()}/u`).join(' | ')}
${currentProduct.minimum_quantity ? `(Mínimo: ${currentProduct.minimum_quantity} unidades)` : ''}` : ''}
${currentProduct.is_configurable && currentProduct.configurable_options ? `
🎨 PERSONALIZABLE - Pregunta por: ${currentProduct.configurable_options.filter(o => o.required).map(o => o.name).join(', ')}
${currentProduct.configurable_options.map(opt => {
            if (opt.type === 'select' && opt.choices) return `${opt.name}: ${opt.choices.join('/')}`
            if (opt.type === 'image') return `${opt.name}: pedir link de logo`
            return `${opt.name}: pedir ${opt.type}`
        }).join(' | ')}` : ''}
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
- render_checkout_summary: Mostrar resumen y comenzar checkout conversacional (USAR cuando cliente quiera pagar)
- confirm_shipping_details: Confirmar datos de envío completos
- escalate_to_human: Transferir a humano

FLUJO DE CHECKOUT:
1. Cliente quiere comprar → 'render_checkout_summary' (muestra tarjeta visual)
2. Pide datos de envío conversacionalmente
3. Todos los datos listos → 'confirm_shipping_details'

IMPORTANTE: 
- Usa 'show_product' para que el cliente vea imagen y botón de compra
- Usa 'render_checkout_summary' cuando el cliente diga "quiero comprar", "pagar", "finalizar"
- Usa 'confirm_shipping_details' cuando tengas TODOS los datos del cliente`
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
