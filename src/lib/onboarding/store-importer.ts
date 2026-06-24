/**
 * Onboarding mágico — extracción de catálogo desde la web actual del merchant.
 *
 * MVP sin Playwright (corre en Vercel): fetch server-side + JSON-LD
 * determinista + Claude para el resto. Para sitios SPA/Instagram que rinden
 * en cliente, Fase 2 añadirá un worker Playwright en el VPS.
 *
 * Contrato: NUNCA lanza — retorna { ok:false, error } ante cualquier fallo
 * (URL inválida, timeout, sitio caído, LLM caído). La extracción es una
 * PROPUESTA: el merchant revisa/edita antes de importar (la IA no es perfecta).
 */

import { z } from "zod"
import { createMessage } from "@/lib/ai/anthropic"
import { logger } from "@/lib/logger"

const log = logger("onboarding/importer")

const FETCH_TIMEOUT_MS = 12_000
const MAX_HTML_BYTES = 1_500_000          // no descargar páginas gigantes
const MAX_LLM_CHARS = 24_000              // presupuesto de tokens del prompt (texto)
const MAX_IMAGE_CANDIDATES = 40           // URLs de imagen que ve el LLM
const MAX_PRODUCTS = 50
const EXTRACTOR_MODEL = "claude-haiku-4-5-20251001"

export interface ExtractedProduct {
    name: string
    price: number | null
    description: string | null
    imageUrl: string | null
}

export interface ExtractedStore {
    brandName: string | null
    currency: string | null
    primaryColor: string | null
    logoUrl: string | null
    products: ExtractedProduct[]
    sourceUrl: string
    productsFound: number
}

export type ExtractResult =
    | { ok: true; data: ExtractedStore }
    | { ok: false; error: string }

const urlSchema = z.string().trim().url()

/** Schema de la salida del LLM (defensivo: todo opcional, se sanea después). */
const llmStoreSchema = z.object({
    brand_name: z.string().nullish(),
    currency: z.string().nullish(),
    primary_color: z.string().nullish(),
    products: z.array(z.object({
        name: z.string().nullish(),
        price: z.union([z.number(), z.string()]).nullish(),
        description: z.string().nullish(),
        image_url: z.string().nullish(),
    })).nullish(),
})

/** Normaliza precios LATAM: "$30.000" → 30000, "1.250,50" → 1250.5, "" → null. */
export function normalizePrice(raw: number | string | null | undefined): number | null {
    if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : null
    if (!raw) return null
    let s = raw.replace(/[^\d.,]/g, "").trim()
    if (!s) return null
    const lastComma = s.lastIndexOf(",")
    const lastDot = s.lastIndexOf(".")
    // El separador decimal es el último que aparezca; el otro son miles.
    if (lastComma > lastDot) {
        s = s.replace(/\./g, "").replace(",", ".")
    } else {
        s = s.replace(/,/g, "")
        // Punto como separador de miles (ej. "30.000"): sin decimales reales
        if (lastDot !== -1 && s.length - lastDot - 1 === 3 && !raw.includes(",")) {
            s = s.replace(/\./g, "")
        }
    }
    const n = Number.parseFloat(s)
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

function absoluteUrl(candidate: string | null | undefined, base: string): string | null {
    if (!candidate) return null
    try {
        return new URL(candidate, base).toString()
    } catch {
        return null
    }
}

/** Extrae productos de bloques JSON-LD (schema.org Product) — la vía fiable. */
function extractJsonLd(html: string, baseUrl: string): ExtractedProduct[] {
    const products: ExtractedProduct[] = []
    const blocks = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)

    for (const block of blocks) {
        let parsed: unknown
        try {
            parsed = JSON.parse(block[1].trim())
        } catch {
            continue
        }
        const nodes: unknown[] = []
        const collect = (node: unknown) => {
            if (Array.isArray(node)) node.forEach(collect)
            else if (node && typeof node === "object") {
                const record = node as Record<string, unknown>
                if (Array.isArray(record["@graph"])) record["@graph"].forEach(collect)
                nodes.push(record)
            }
        }
        collect(parsed)

        for (const node of nodes) {
            const record = node as Record<string, unknown>
            const type = record["@type"]
            const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"))
            if (!isProduct || typeof record.name !== "string") continue

            const offers = (Array.isArray(record.offers) ? record.offers[0] : record.offers) as Record<string, unknown> | undefined
            const image = Array.isArray(record.image) ? record.image[0] : record.image
            products.push({
                name: record.name.trim().slice(0, 120),
                price: normalizePrice(offers?.price as string | number | undefined),
                description: typeof record.description === "string" ? record.description.trim().slice(0, 500) : null,
                imageUrl: absoluteUrl(typeof image === "string" ? image : null, baseUrl),
            })
        }
    }
    return products
}

/** #rrggbb válido (expande #rgb), o null. */
function normalizeHex(value: string | null | undefined): string | null {
    if (!value) return null
    const v = value.trim().toLowerCase()
    const six = v.match(/^#([0-9a-f]{6})$/)
    if (six) return `#${six[1]}`
    const three = v.match(/^#([0-9a-f]{3})$/)
    if (three) return `#${three[1].split("").map((c) => c + c).join("")}`
    return null
}

/** Neutro (gris/blanco/negro) → no sirve como color de marca. */
function isNeutralColor(hex: string): boolean {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    return max - min < 24 || max < 32 || min > 232
}

/**
 * Colores de marca candidatos del HTML crudo (style="" + <style>), ordenados por
 * frecuencia y sin neutros. El LLM no ve estilos (htmlToText los quita), así que
 * estos candidatos son la fuente real del color de marca.
 */
function extractColorCandidates(html: string): string[] {
    const counts = new Map<string, number>()
    for (const m of html.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
        const hex = m[0].toLowerCase()
        if (isNeutralColor(hex)) continue
        counts.set(hex, (counts.get(hex) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([hex]) => hex)
}

/**
 * Logo REAL del header (no el favicon): primer <img> cuyo tag mencione "logo"
 * (class/alt/src/id) y sea raster (png/jpg/webp/avif). Es el wordmark de marca
 * de buena resolución — mucho mejor que el favicon/apple-touch-icon chico.
 */
function extractLogo(html: string, baseUrl: string): string | null {
    for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
        const attrs = tag[0]
        if (!/logo/i.test(attrs)) continue
        const src = attrs.match(/\b(?:src|data-src|data-lazy-src)=["']([^"']+)["']/i)?.[1]
        const abs = absoluteUrl(src, baseUrl)
        if (abs && /\.(png|jpe?g|webp|avif)(\?|$)/i.test(abs)) return abs
    }
    return null
}

function extractMeta(html: string, baseUrl: string) {
    const meta = (prop: string) => {
        const match = html.match(new RegExp(`<meta[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i"))
        return match?.[1]?.trim() ?? null
    }
    const linkHref = (rel: string) => {
        const m =
            html.match(new RegExp(`<link[^>]*rel=["'][^"']*${rel}[^"']*["'][^>]*href=["']([^"']+)["']`, "i")) ??
            html.match(new RegExp(`<link[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*${rel}[^"']*["']`, "i"))
        return m?.[1]?.trim() ?? null
    }
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    return {
        brandName: meta("og:site_name") || titleMatch?.[1]?.trim() || null,
        themeColor: meta("theme-color"),
        ogImage: absoluteUrl(meta("og:image"), baseUrl),
        // Logo real del header primero; si no, favicon/apple-touch-icon/og.
        logoUrl: extractLogo(html, baseUrl) ?? absoluteUrl(linkHref("apple-touch-icon") || linkHref("icon") || meta("og:image"), baseUrl),
    }
}

interface ImageCandidate {
    url: string
    alt: string
}

const IMAGE_JUNK = /logo|icon|favicon|sprite|banner|placeholder|loading|spinner|avatar|payment|badge|flag|\.svg(\?|$)/i

/**
 * URLs de imagen presentes en el HTML estático (src/srcset/data-src) con su
 * alt. Muchos sitios (WordPress/WooCommerce/Shopify) sirven las fotos así —
 * no hace falta navegador. Se filtran logos/iconos/sprites y se deduplica.
 */
function extractImageCandidates(html: string, baseUrl: string): ImageCandidate[] {
    const seen = new Set<string>()
    const candidates: ImageCandidate[] = []

    for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
        const attrs = tag[0]
        const get = (name: string) => attrs.match(new RegExp(`${name}=["']([^"']+)["']`, "i"))?.[1]?.trim()
        const srcset = get("srcset") || get("data-srcset")
        const raw = get("src") || get("data-src") || get("data-lazy-src") || srcset?.split(",")[0]?.trim().split(/\s+/)[0]
        if (!raw) continue
        if (raw.startsWith("data:")) continue
        const url = absoluteUrl(raw, baseUrl)
        if (!url || IMAGE_JUNK.test(url) || seen.has(url)) continue
        if (!/\.(jpe?g|png|webp|avif)(\?|$)/i.test(url)) continue
        seen.add(url)
        candidates.push({ url, alt: (get("alt") || "").slice(0, 80) })
        if (candidates.length >= MAX_IMAGE_CANDIDATES) break
    }
    return candidates
}

/** HTML → texto plano acotado para el LLM (quita script/style/tags). */
function htmlToText(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_LLM_CHARS)
}

async function fetchHtml(url: string): Promise<string | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            redirect: "follow",
            headers: { "user-agent": "Mozilla/5.0 (compatible; LandingChatImporter/1.0)" },
        })
        if (!response.ok) {
            log.warn("fetch non-ok", { url, status: response.status })
            return null
        }
        const contentType = response.headers.get("content-type") ?? ""
        if (!contentType.includes("text/html")) return null
        const buffer = await response.arrayBuffer()
        if (buffer.byteLength > MAX_HTML_BYTES) {
            return new TextDecoder().decode(buffer.slice(0, MAX_HTML_BYTES))
        }
        return new TextDecoder().decode(buffer)
    } catch (error) {
        log.warn("fetch failed", { url, error: error instanceof Error ? error.message : "unknown" })
        return null
    } finally {
        clearTimeout(timeout)
    }
}

/** Quita tags HTML y entidades básicas (para descripciones de Shopify body_html). */
function stripHtml(value: string): string {
    return value
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&[a-z]+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
}

const shopifyProductsSchema = z.object({
    products: z.array(z.object({
        title: z.string().nullish(),
        body_html: z.string().nullish(),
        variants: z.array(z.object({ price: z.union([z.string(), z.number()]).nullish() })).nullish(),
        images: z.array(z.object({ src: z.string().nullish() })).nullish(),
    })).nullish(),
})

/**
 * Shopify expone /products.json con data completa (título, body_html=descripción,
 * variants[].price, images[].src). Es la fuente más confiable para tiendas Shopify
 * — incluye DESCRIPCIONES, que el scrape de una sola página (home/colección) no trae.
 * Devuelve null si no es Shopify o falla (→ se usa el scrape HTML normal).
 */
async function fetchShopifyProducts(origin: string): Promise<ExtractedProduct[] | null> {
    if (!origin) return null
    try {
        const res = await fetch(`${origin}/products.json?limit=250`, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            headers: { "user-agent": "Mozilla/5.0 (compatible; LandingChatImporter/1.0)" },
        })
        if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) return null
        const parsed = shopifyProductsSchema.safeParse(await res.json())
        if (!parsed.success || !parsed.data.products) return null
        const products: ExtractedProduct[] = []
        for (const raw of parsed.data.products) {
            const name = raw.title?.trim()
            if (!name) continue
            products.push({
                name: name.slice(0, 120),
                price: normalizePrice(raw.variants?.[0]?.price ?? null),
                description: raw.body_html ? stripHtml(raw.body_html).slice(0, 500) || null : null,
                imageUrl: raw.images?.[0]?.src ?? null,
            })
            if (products.length >= MAX_PRODUCTS) break
        }
        return products.length > 0 ? products : null
    } catch {
        return null
    }
}

const wooProductsSchema = z.array(z.object({
    name: z.string().nullish(),
    description: z.string().nullish(),
    short_description: z.string().nullish(),
    prices: z.object({
        price: z.string().nullish(),
        currency_minor_unit: z.number().nullish(),
    }).nullish(),
    images: z.array(z.object({ src: z.string().nullish() })).nullish(),
}))

/**
 * WooCommerce expone la Store API PÚBLICA (/wp-json/wc/store/v1/products) con
 * data completa: name, description (HTML), prices (en unidad menor) e images.
 * Equivalente Woo de Shopify /products.json — trae DESCRIPCIONES. null si no es
 * WooCommerce o falla (→ se usa el scrape HTML normal).
 */
async function fetchWooCommerceProducts(origin: string): Promise<ExtractedProduct[] | null> {
    if (!origin) return null
    try {
        const res = await fetch(`${origin}/wp-json/wc/store/v1/products?per_page=100`, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            headers: { "user-agent": "Mozilla/5.0 (compatible; LandingChatImporter/1.0)" },
        })
        if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) return null
        const parsed = wooProductsSchema.safeParse(await res.json())
        if (!parsed.success) return null
        const products: ExtractedProduct[] = []
        for (const raw of parsed.data) {
            const name = raw.name?.trim()
            if (!name) continue
            let price: number | null = null
            if (raw.prices?.price) {
                const minor = raw.prices.currency_minor_unit ?? 2
                const value = Number(raw.prices.price) / 10 ** minor
                price = Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null
            }
            const desc = raw.description || raw.short_description || ""
            products.push({
                name: name.slice(0, 120),
                price,
                description: desc ? stripHtml(desc).slice(0, 500) || null : null,
                imageUrl: raw.images?.[0]?.src ?? null,
            })
            if (products.length >= MAX_PRODUCTS) break
        }
        return products.length > 0 ? products : null
    } catch {
        return null
    }
}

const EXTRACT_PROMPT = (text: string, jsonLdHint: string, imagesBlock: string, colorsBlock: string) => `
You extract a store's catalog and brand from its website content. Return JSON ONLY.

WEBSITE CONTENT (truncated):
${text}
${jsonLdHint ? `\nSTRUCTURED PRODUCTS ALREADY FOUND (schema.org):\n${jsonLdHint}` : ""}
${imagesBlock ? `\nAVAILABLE IMAGES (url — alt text). Match each product to its image by alt text / filename similarity:\n${imagesBlock}` : ""}
${colorsBlock ? `\nBRAND COLOR CANDIDATES (hex, by frequency in the page styles):\n${colorsBlock}` : ""}

Return a JSON object:
{
  "brand_name": "<store/brand name or null>",
  "currency": "<ISO code if evident, e.g. COP, USD, MXN, or null>",
  "primary_color": "<the brand's MAIN color as #rrggbb, chosen from BRAND COLOR CANDIDATES (used for buttons/headers/brand), or null>",
  "products": [
    { "name": "<product name>", "price": <number or null>, "description": "<short or null>", "image_url": "<url or null>" }
  ]
}

RULES:
- Only REAL products being sold. Ignore nav links, categories, blog posts, footer.
- price: numeric only, no currency symbols or thousand separators (e.g. 30000 not "$30.000").
- image_url: MUST be one of the URLs from AVAILABLE IMAGES above, matched to the product by alt/filename. If no clear match, use null. NEVER invent an image URL.
- Max ${MAX_PRODUCTS} products. If none are clearly products, return "products": [].
- Do NOT invent products, prices or names not present in the content.
Return JSON only, no markdown fences.
`.trim()

export async function extractStoreFromUrl(rawUrl: string): Promise<ExtractResult> {
    const parsedUrl = urlSchema.safeParse(rawUrl)
    if (!parsedUrl.success) return { ok: false, error: "URL inválida. Incluye https:// y un dominio válido." }
    const url = parsedUrl.data

    const html = await fetchHtml(url)
    if (!html) return { ok: false, error: "No pude leer ese sitio (¿está en línea y es público?). Intenta con la URL de tu catálogo." }

    const jsonLdProducts = extractJsonLd(html, url)
    const meta = extractMeta(html, url)
    const imageCandidates = extractImageCandidates(html, url)
    const colorCandidates = extractColorCandidates(html)
    // Guard anti-alucinación: solo aceptamos imágenes presentes en la página
    // (set exacto) o, a lo sumo, del mismo origen del sitio.
    const candidateUrls = new Set(imageCandidates.map((image) => image.url))
    let siteOrigin = ""
    try { siteOrigin = new URL(url).origin } catch { /* noop */ }
    // Shopify (/products.json) y WooCommerce (Store API) exponen data completa
    // con descripciones. Si el sitio es uno de esos, es la fuente autoritativa.
    const structuredProducts = (await fetchShopifyProducts(siteOrigin)) ?? (await fetchWooCommerceProducts(siteOrigin))
    const isRealImage = (candidate: string | null): candidate is string => {
        if (!candidate) return false
        if (candidateUrls.has(candidate)) return true
        try { return new URL(candidate).origin === siteOrigin } catch { return false }
    }

    let llmStore: z.infer<typeof llmStoreSchema> | null = null
    try {
        const jsonLdHint = jsonLdProducts.slice(0, 10).map((product) => `- ${product.name} (${product.price ?? "?"})`).join("\n")
        const imagesBlock = imageCandidates.map((image) => `- ${image.url}${image.alt ? ` — ${image.alt}` : ""}`).join("\n")
        const colorsBlock = colorCandidates.map((color) => `- ${color}`).join("\n")
        const response = await createMessage({
            model: EXTRACTOR_MODEL,
            max_tokens: 3000,
            temperature: 0.2,
            messages: [{ role: "user", content: EXTRACT_PROMPT(htmlToText(html), jsonLdHint, imagesBlock, colorsBlock) }],
        })
        const textBlock = response.content.find((block) => block.type === "text")
        if (textBlock && textBlock.type === "text") {
            const cleaned = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
            const candidate = llmStoreSchema.safeParse(JSON.parse(cleaned))
            if (candidate.success) llmStore = candidate.data
        }
    } catch (error) {
        log.warn("LLM extraction failed, falling back to JSON-LD only", { url, error: error instanceof Error ? error.message : "unknown" })
    }

    // Shopify/WooCommerce (autoritativo, con descripciones) tiene prioridad; si
    // no, merge JSON-LD (fiable) + LLM.
    let products: ExtractedProduct[]
    if (structuredProducts && structuredProducts.length > 0) {
        products = structuredProducts.slice(0, MAX_PRODUCTS)
    } else {
        const byName = new Map<string, ExtractedProduct>()
        for (const product of jsonLdProducts) {
            byName.set(product.name.toLowerCase(), product)
        }
        for (const raw of llmStore?.products ?? []) {
            const name = (raw.name ?? "").trim()
            if (!name) continue
            const key = name.toLowerCase()
            if (byName.has(key)) continue
            const llmImage = absoluteUrl(raw.image_url, url)
            byName.set(key, {
                name: name.slice(0, 120),
                price: normalizePrice(raw.price),
                description: raw.description?.trim().slice(0, 500) ?? null,
                imageUrl: isRealImage(llmImage) ? llmImage : null,   // descarta URLs inventadas
            })
        }
        products = Array.from(byName.values()).slice(0, MAX_PRODUCTS)
    }
    if (products.length === 0) {
        return { ok: false, error: "No encontré productos en esa página. Prueba con el link directo a tu catálogo o tienda." }
    }

    return {
        ok: true,
        data: {
            brandName: llmStore?.brand_name?.trim() || meta.brandName,
            currency: llmStore?.currency?.trim().toUpperCase() || null,
            primaryColor: normalizeHex(llmStore?.primary_color) || normalizeHex(meta.themeColor) || colorCandidates[0] || null,
            logoUrl: meta.logoUrl,
            products,
            sourceUrl: url,
            productsFound: products.length,
        },
    }
}
