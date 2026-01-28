export interface TOCItem {
    id: string
    text: string
    level: number
}

/**
 * Escapa caracteres HTML para prevenir XSS
 */
function escapeHtml(text: string): string {
    const htmlEscapes: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }
    return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char)
}

export function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/[^\w\-]+/g, '') // Remove all non-word chars
        .replace(/\-\-+/g, '-')   // Replace multiple - with single -
}

export function processHtmlContent(html: string): { content: string; toc: TOCItem[] } {
    const toc: TOCItem[] = []

    // Regex para encontrar headers h2 y h3
    // Captura: 1: nivel (2 o 3), 2: contenido del header
    const regex = /<h([23])>(.*?)<\/h\1>/gi

    const processedContent = html.replace(regex, (match, levelStr, text) => {
        const level = parseInt(levelStr)
        // Limpiamos el texto de tags html internos para el slug y para texto seguro
        const cleanText = text.replace(/<[^>]*>/g, '')
        const id = slugify(cleanText)
        // Escapamos el texto limpio para prevenir XSS
        const safeText = escapeHtml(cleanText)

        toc.push({
            id,
            text: cleanText,
            level
        })

        return `<h${level} id="${id}">${safeText}</h${level}>`
    })

    return {
        content: processedContent,
        toc
    }
}
