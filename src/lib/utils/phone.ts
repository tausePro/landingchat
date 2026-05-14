/**
 * Utilidades de normalización de teléfono
 * 
 * Usadas tanto por el identify API (web chat) como por el webhook de WhatsApp
 * para unificar la identidad del cliente entre canales.
 * 
 * Formato canónico: solo dígitos con código de país (ej: "573001234567")
 */

/**
 * Extrae el número de teléfono (o identificador limpio) desde un JID de WhatsApp.
 *
 * Formatos soportados:
 *   - "573001234567@s.whatsapp.net"  -> "573001234567" (formato clasico)
 *   - "65820390633601@lid"           -> "65820390633601" (Linked ID, privacidad nueva)
 *   - "573001234567@c.us"            -> "573001234567" (variante de algunos providers)
 *   - "573001234567"                  -> "573001234567" (ya limpio)
 *
 * IMPORTANTE: usar esta funcion en TODOS los puntos donde se procesa un
 * remoteJid del webhook, antes de pasar el valor a findOrCreateCustomer,
 * findOrCreateChat o findActiveChatByPhone. La asimetria entre como se
 * guarda el chat y como se busca causa el bug "No hay conversacion activa"
 * cuando WhatsApp envia el remoteJid con sufijo @lid.
 *
 * Incidente Casa Inmobiliaria 2026-05-14: comandos /yo /info /bot fallaban
 * porque el chat se guardaba con "...@lid" en phone_number pero la busqueda
 * limpiaba el @lid via regex \D y nunca matcheaba.
 */
export function extractPhoneFromJid(jid: string): string {
    if (!jid) return ""
    // Quitar cualquier sufijo @xxx (todo lo que viene desde el @ en adelante).
    // Esto cubre @s.whatsapp.net, @lid, @c.us, @g.us (grupos) y cualquier
    // formato futuro que WhatsApp/Meta introduzca.
    return jid.replace(/@.*$/, "")
}

/**
 * Reconstruye un JID completo de WhatsApp a partir de un identificador
 * (telefono limpio o JID parcial). Necesario para enviar mensajes via
 * Evolution API: la API requiere el JID completo (con sufijo) para entregar
 * mensajes a contactos con Linked ID; un MSISDN puro tambien funciona pero
 * un identificador opaco sin sufijo NO se resuelve.
 *
 * Heuristica:
 *   - Si ya contiene "@" -> devolver tal cual (asumir JID completo).
 *   - Si parece MSISDN (10-13 digitos numericos puros) -> agregar
 *     "@s.whatsapp.net" (formato clasico).
 *   - En cualquier otro caso (>=14 digitos, no-numerico, etc.) -> asumir
 *     Linked ID y agregar "@lid".
 *
 * Incidente Casa Inmobiliaria 2026-05-14: el envio de respuestas del agente
 * fallaba para contactos con remoteJid `@lid` porque el phone_number en BD
 * estaba sin sufijo y Evolution API no podia resolver el destinatario.
 *
 * Esta funcion es solo un fallback heuristico. La fuente de verdad debe ser
 * `chats.whatsapp_jid` (introducida en migracion 20260514): el webhook
 * persiste el remoteJid original al recibir, y el sender lo prefiere al enviar.
 */
export function buildWhatsAppJid(phoneOrJid: string): string {
    if (!phoneOrJid) return phoneOrJid
    if (phoneOrJid.includes("@")) return phoneOrJid

    // MSISDN clasico: 10-13 digitos numericos puros.
    if (/^[0-9]{10,13}$/.test(phoneOrJid)) {
        return `${phoneOrJid}@s.whatsapp.net`
    }

    // Cualquier otro identificador: asumir Linked ID.
    return `${phoneOrJid}@lid`
}

/**
 * Resuelve el destinatario de un envio WhatsApp desde una fila de `chats`.
 *
 * Cascada (de mas robusto a fallback):
 *   1. `whatsapp_jid` (preferido): JID completo persistido al recibir el
 *      webhook. Es la fuente de verdad porque preserva el sufijo `@lid` o
 *      `@s.whatsapp.net` que Evolution API necesita para resolver contactos
 *      con Linked ID.
 *   2. `phone_number` reconstruido via `buildWhatsAppJid`: heuristica por si
 *      el chat es legacy (creado antes del v1.12.7) y aun no tiene
 *      `whatsapp_jid` poblado.
 *   3. `whatsapp_chat_id`: ultimo recurso para chats muy antiguos.
 *
 * Devuelve `null` si no hay ningun identificador disponible.
 *
 * Centralizado aqui para que `sendWhatsAppResponse` (unified.ts) y
 * `sendAgentMessage` (dashboard/chats/actions.ts) compartan la misma logica
 * y los tests cubran ambos call-sites.
 */
export function resolveWhatsAppSendTarget(chat: {
    whatsapp_jid?: string | null
    phone_number?: string | null
    whatsapp_chat_id?: string | null
}): string | null {
    if (chat.whatsapp_jid) return chat.whatsapp_jid
    if (chat.phone_number) return buildWhatsAppJid(chat.phone_number)
    if (chat.whatsapp_chat_id) return chat.whatsapp_chat_id
    return null
}

/**
 * Normaliza un número de teléfono a formato canónico (solo dígitos con código de país)
 * Ejemplo: "+57 300 123 4567" → "573001234567"
 */
export function normalizePhone(phone: string): string {
    const digitsOnly = phone.replace(/\D/g, "")

    // Si ya tiene código de país colombiano
    if (digitsOnly.startsWith("57") && digitsOnly.length >= 12) {
        return digitsOnly
    }

    // Número local colombiano (10 dígitos, empieza por 3)
    if (digitsOnly.length === 10 && digitsOnly.startsWith("3")) {
        return `57${digitsOnly}`
    }

    // Fallback: devolver solo dígitos
    return digitsOnly
}

/**
 * Genera variantes de búsqueda para encontrar un cliente
 * sin importar en qué formato se guardó el teléfono.
 * 
 * Ejemplo: "573001234567" → ["573001234567", "3001234567", "+573001234567"]
 */
export function getPhoneVariants(phone: string): string[] {
    const digitsOnly = phone.replace(/\D/g, "")
    const cleanPhone = phone.replace(/[^\d+]/g, "")
    const variants: string[] = []

    if (digitsOnly.startsWith("57") && digitsOnly.length >= 12) {
        // Formato: 573001234567
        variants.push(digitsOnly)                    // 573001234567
        variants.push(digitsOnly.substring(2))       // 3001234567
        variants.push(`+${digitsOnly}`)             // +573001234567
    } else if (digitsOnly.length >= 10 && digitsOnly.length <= 11) {
        // Formato: 3001234567
        variants.push(digitsOnly)                    // 3001234567
        variants.push(`57${digitsOnly}`)            // 573001234567
        variants.push(`+57${digitsOnly}`)           // +573001234567
    } else {
        // Fallback: usar el número limpio como está
        variants.push(cleanPhone)
        variants.push(digitsOnly)
    }

    // Eliminar duplicados y vacíos
    return [...new Set(variants.filter(p => p.length > 0))]
}
