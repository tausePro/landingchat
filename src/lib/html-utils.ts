
export interface TOCItem {
    id: string
    text: string
    level: number
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
        // Limpiamos el texto de tags html internos si los hubiera para el slug
        const cleanText = text.replace(/<[^>]*>/g, '')
        const id = slugify(cleanText)

        toc.push({
            id,
            text: cleanText,
            level
        })

        return `<h${level} id="${id}">${text}</h${level}>`
    })

    return {
        content: processedContent,
        toc
    }
}
