import { headers } from "next/headers"
import { getStoreLink, isSubdomain } from "./store-urls"

/**
 * Versión server-side de `getStoreLink`: detecta si el request llega por
 * subdominio (qp.landingchat.co/...) o por path (landingchat.co/store/qp/...)
 * leyendo el header `host`, y construye el link correcto en ambos casos.
 *
 * Necesario en las páginas de orden (Server Components) que viven bajo
 * `/store/[slug]` pero se sirven también vía subdominio: hardcodear
 * `/store/${slug}` produce 404 en subdominio (qp.landingchat.co/store/qp).
 */
export async function getStoreLinkServer(path: string, slug: string): Promise<string> {
    const headersList = await headers()
    const host = headersList.get("host") || ""
    return getStoreLink(path, isSubdomain(host), slug)
}
