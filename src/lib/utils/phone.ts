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
