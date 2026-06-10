/**
 * Builder puro del robots.txt multi-tenant.
 *
 * Vive separado del route handler (`src/app/robots.txt/route.ts`) para poder
 * testearlo sin mocks de Next. Reemplaza al antiguo `src/app/robots.ts`
 * (convención MetadataRoute) porque esa API tipada no soporta directivas
 * no estándar como `Content-Signal`.
 */

/** Rutas privadas excluidas de crawling (mismas que el robots.ts histórico). */
export const ROBOTS_DISALLOWED_PATHS = [
    "/dashboard/",
    "/admin/",
    "/api/",
    "/onboarding/",
    "/order/",
    "/checkout/",
    "/profile/",
] as const

/**
 * Content Signals (contentsignals.org): preferencias de uso del contenido
 * por sistemas de AI. Decisión de plataforma (2026-06-10):
 * - `search=yes`    → indexación y resultados de búsqueda, bienvenidos.
 * - `ai-input=yes`  → asistentes AI pueden usar el contenido para responder
 *                     (queremos que agentes descubran y recomienden las
 *                     tiendas de los tenants — es comercio conversacional).
 * - `ai-train=no`   → no autorizamos entrenamiento de modelos con el
 *                     contenido de los tenants.
 */
export const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no"

export function buildRobotsTxt(baseUrl: string): string {
    const lines = [
        "User-Agent: *",
        "Allow: /",
        ...ROBOTS_DISALLOWED_PATHS.map((path) => `Disallow: ${path}`),
        `Content-Signal: ${CONTENT_SIGNAL}`,
        "",
        `Sitemap: ${baseUrl}/sitemap.xml`,
        "",
    ]
    return lines.join("\n")
}
