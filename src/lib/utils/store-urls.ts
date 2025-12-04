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
    if (!slug || slug === 'undefined') {
        console.error('getStoreLink called with invalid slug:', { path, isSubdomain, slug })
        // Fallback: si es subdominio, no importa el slug. Si no, retornamos root para evitar 404 feo
        if (isSubdomain) return path.startsWith('/') ? path : `/${path}`
        return '/'
    }
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

    // Quitar puerto si existe (ej: qp.localhost:3000 -> qp.localhost)
    const hostWithoutPort = hostname.split(':')[0]

    // Localhost simple sin subdominio
    if (hostWithoutPort === 'localhost' || hostWithoutPort === '127.0.0.1') return false

    // Subdominio local: qp.localhost -> ['qp', 'localhost'] = 2 partes
    const parts = hostWithoutPort.split('.')
    if (parts.length === 2 && parts[1] === 'localhost') {
        return true // Es un subdominio local como qp.localhost
    }

    // En producción: tienda.landingchat.co (3 partes)
    // Lógica: si tiene más de 2 partes y no es www
    if (parts.length >= 3 && parts[0] !== 'www') return true

    return false
}
