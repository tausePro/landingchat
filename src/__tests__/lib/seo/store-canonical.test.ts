/**
 * Tests de `buildStoreCanonicalUrl` y `buildRobotsTxt`.
 *
 * Contexto (Seobility flag crítico 2026-06-10, tenant Tez): la misma tienda
 * se sirve por dominio custom, subdominio y /store/[slug] sin canónica →
 * contenido duplicado para Google. La canónica debe apuntar SIEMPRE al
 * origen preferido: dominio custom si existe, si no el subdominio.
 */

import { describe, expect, it } from "vitest"
import { buildStoreCanonicalUrl } from "@/lib/seo/site-discovery"
import { buildRobotsTxt, CONTENT_SIGNAL } from "@/lib/seo/robots-txt"

describe("buildStoreCanonicalUrl", () => {
    const orgWithCustomDomain = { slug: "tez", custom_domain: "tez.com.co" }
    const orgWithoutCustomDomain = { slug: "qp", custom_domain: null }

    it("prefiere el dominio custom para la home (sin path)", () => {
        expect(buildStoreCanonicalUrl(orgWithCustomDomain)).toBe("https://tez.com.co")
    })

    it("cae al subdominio cuando no hay dominio custom", () => {
        expect(buildStoreCanonicalUrl(orgWithoutCustomDomain)).toBe("https://qp.landingchat.co")
    })

    it("construye la canónica de una página interna", () => {
        expect(buildStoreCanonicalUrl(orgWithCustomDomain, "/productos")).toBe(
            "https://tez.com.co/productos"
        )
    })

    it("normaliza paths sin slash inicial", () => {
        expect(buildStoreCanonicalUrl(orgWithoutCustomDomain, "producto/collar-azul")).toBe(
            "https://qp.landingchat.co/producto/collar-azul"
        )
    })

    it("normaliza www en el dominio custom", () => {
        expect(buildStoreCanonicalUrl({ slug: "tez", custom_domain: "www.tez.com.co" })).toBe(
            "https://tez.com.co"
        )
    })
})

describe("buildRobotsTxt", () => {
    const output = buildRobotsTxt("https://tez.com.co")

    it("conserva las reglas históricas (allow, disallows y sitemap por tenant)", () => {
        expect(output).toContain("User-Agent: *")
        expect(output).toContain("Allow: /")
        for (const path of ["/dashboard/", "/admin/", "/api/", "/onboarding/", "/order/", "/checkout/", "/profile/"]) {
            expect(output).toContain(`Disallow: ${path}`)
        }
        expect(output).toContain("Sitemap: https://tez.com.co/sitemap.xml")
    })

    it("declara Content-Signal dentro del grupo User-Agent", () => {
        const lines = output.split("\n")
        const signalIndex = lines.indexOf(`Content-Signal: ${CONTENT_SIGNAL}`)
        const blankIndex = lines.indexOf("")
        expect(signalIndex).toBeGreaterThan(-1)
        // El Content-Signal pertenece al grupo `User-Agent: *` (antes de la línea en blanco)
        expect(signalIndex).toBeLessThan(blankIndex)
    })

    it("no permite el entrenamiento de modelos pero sí búsqueda y ai-input", () => {
        expect(CONTENT_SIGNAL).toBe("search=yes, ai-input=yes, ai-train=no")
    })
})
