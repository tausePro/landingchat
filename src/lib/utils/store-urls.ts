export function getStoreBasePath(isSubdomain: boolean, slug: string): string {
    // Si estamos en subdominio, la base es "" (relativo a la raíz del subdominio)
    // Si estamos en path, la base es "/store/[slug]"
    return isSubdomain ? '' : `/store/${slug}`
}

export function getStoreLink(path: string, isSubdomain: boolean, slug: string): string {
    const base = getStoreBasePath(isSubdomain, slug)
    // Asegurar que path empiece con /
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    return `${base}${cleanPath}`
}

export function isSubdomain(hostname: string): boolean {
    if (!hostname) return false
    // qp.landingchat.co → true
    // www.landingchat.co → false
    // localhost → false (excepto si usamos subdominios locales como store.localhost)

    // Ignorar localhost simple
    if (hostname === 'localhost' || hostname.includes('127.0.0.1')) return false

    const parts = hostname.split('.')
    // En producción: tienda.landingchat.co (3 partes)
    // En local: tienda.localhost:3000 (2 partes + puerto) -> tienda.localhost

    // Lógica simple: si tiene más de 2 partes y no es www
    if (parts.length >= 3 && parts[0] !== 'www') return true

    return false
}

export function getProductUrl(productSlug: string, isSubdomain: boolean, storeSlug: string): string {
    return getStoreLink(`/producto/${productSlug}`, isSubdomain, storeSlug)
}

export function getChatUrl(isSubdomain: boolean, storeSlug: string): string {
    return getStoreLink('/chat', isSubdomain, storeSlug)
}
