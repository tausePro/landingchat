/**
 * Genera la base path para URLs del store
 * Si estamos en subdominio (qp.landingchat.co), la base es ""
 * Si estamos en path (landingchat.co/store/qp), la base es "/store/[slug]"
 * (Force rebuild)
 */
export function getStoreBasePath(isSubdomain: boolean, slug: string): string {
    return isSubdomain ? '' : `/store/${slug}`
}

/**
 * Genera un link completo para el storefront
 */
export function getStoreLink(path: string, isSubdomain: boolean, slug: string): string {
    const base = getStoreBasePath(isSubdomain, slug)
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${base}${normalizedPath}`
}

/**
 * Genera URL de producto
 */
export function getProductUrl(productSlug: string, isSubdomain: boolean, storeSlug: string): string {
    return getStoreLink(`/producto/${productSlug}`, isSubdomain, storeSlug)
}

/**
 * Genera URL del chat
 */
export function getChatUrl(isSubdomain: boolean, storeSlug: string): string {
    if (isSubdomain) {
        return '/chat'
    }
    return `/chat/${storeSlug}`
}

/**
 * Detecta si estamos en un subdominio (server-side)
 */
export function isSubdomain(hostname: string): boolean {
    if (!hostname) return false

    // Ignorar localhost simple
    if (hostname === 'localhost' || hostname.includes('127.0.0.1')) return false

    const parts = hostname.split('.')
    // En producción: tienda.landingchat.co (3 partes)
    // Lógica: si tiene más de 2 partes y no es www
    if (parts.length >= 3 && parts[0] !== 'www') return true

    return false
}
