/**
 * Helper para highlighting de matches en resultados del SmartSearch.
 *
 * Driver: slice v1.14.6 (search UX polish). El backend ya hace
 * `f_unaccent + lower` antes de matchear (search_products), por lo que
 * "cafe" devuelve productos con "café" en el nombre. Para que el UI
 * muestre coherencia visual, el highlight tambien debe ser unaccent-aware.
 *
 * El helper retorna un array de segmentos `{text, isMatch}` para que el
 * UI elija como renderizar (ej. <mark>). Mantiene los acentos del texto
 * original; solo el "matching" es insensible a tildes.
 */

export interface HighlightSegment {
    text: string
    isMatch: boolean
}

/**
 * Quita diacritics de un string usando NFD + replace.
 * - "café" -> "cafe"
 * - "Niño" -> "Nino" (ñ se descompone como n + tilde, queda solo "n")
 *
 * NOTA: en español la ñ se considera letra propia, pero pg_trgm + f_unaccent
 * tambien la descomponen, por lo que mantenemos la simetria con el backend.
 */
function unaccent(value: string): string {
    return value.normalize("NFD").replace(/\p{Diacritic}/gu, "")
}

/**
 * Construye segmentos de texto para highlighting. Cada segmento indica si
 * pertenece a un match (`isMatch: true`) o no.
 *
 * - Insensible a mayusculas/minusculas
 * - Insensible a tildes/acentos (matchea "cafe" en "Café molido")
 * - Soporta multiples ocurrencias en el mismo texto
 * - Devuelve `[{text, isMatch: false}]` cuando query es vacia o sin matches
 */
export function buildHighlightSegments(
    text: string,
    query: string,
): HighlightSegment[] {
    if (!text) return []
    const trimmedQuery = query.trim()
    if (trimmedQuery.length === 0) {
        return [{ text, isMatch: false }]
    }

    // Mapeo char-by-char: para cada char en el texto normalizado, recordamos
    // el indice del char original que lo produjo. Esto nos permite hacer
    // indexOf() sobre la version unaccent+lowercase y luego slice() sobre el
    // original con los indices correctos.
    type CharRef = { normalChar: string; originalIdx: number }
    const normalizedChars: CharRef[] = []

    for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        const decomposed = ch.normalize("NFD")
        for (const dc of decomposed) {
            if (!/\p{Diacritic}/u.test(dc)) {
                normalizedChars.push({
                    normalChar: dc.toLowerCase(),
                    originalIdx: i,
                })
            }
        }
    }

    if (normalizedChars.length === 0) {
        return [{ text, isMatch: false }]
    }

    const normalizedString = normalizedChars.map((c) => c.normalChar).join("")
    const normalizedQuery = unaccent(trimmedQuery).toLowerCase()

    if (normalizedQuery.length === 0) {
        return [{ text, isMatch: false }]
    }

    const segments: HighlightSegment[] = []
    let originalCursor = 0
    let normalizedCursor = 0

    while (normalizedCursor <= normalizedString.length - normalizedQuery.length) {
        const idx = normalizedString.indexOf(normalizedQuery, normalizedCursor)
        if (idx === -1) break

        const originalStart = normalizedChars[idx].originalIdx
        const lastNormalizedIdx = idx + normalizedQuery.length - 1
        const originalEnd =
            normalizedChars[lastNormalizedIdx].originalIdx + 1

        if (originalStart > originalCursor) {
            segments.push({
                text: text.slice(originalCursor, originalStart),
                isMatch: false,
            })
        }
        segments.push({
            text: text.slice(originalStart, originalEnd),
            isMatch: true,
        })
        originalCursor = originalEnd
        normalizedCursor = idx + normalizedQuery.length
    }

    if (originalCursor < text.length) {
        segments.push({
            text: text.slice(originalCursor),
            isMatch: false,
        })
    }

    // Si no hubo matches, devolver el texto entero como un solo segmento
    if (segments.length === 0) {
        return [{ text, isMatch: false }]
    }

    return segments
}
