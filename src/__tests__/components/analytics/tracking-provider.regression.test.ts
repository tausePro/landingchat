import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Regresión analítica:
 * - Meta CAPI cliente quedó deshabilitado intencionalmente; el endpoint
 *   /api/store/[slug]/meta-capi sigue vivo pero ningún flujo cliente debe
 *   invocarlo hasta validar configuración real por tenant.
 * - El componente MetaPixel no debe inicializar el Pixel ni disparar PageView
 *   desde un useEffect: el <Script> inline ya hace ambas cosas y duplicarlas
 *   producía doble PageView y bajaba Event Match Quality.
 */

const repoRoot = path.resolve(__dirname, "../../../..")

function readSource(relativePath: string): string {
    return readFileSync(path.join(repoRoot, relativePath), "utf8")
}

describe("Tracking provider - Meta CAPI cliente deshabilitado", () => {
    const trackingProviderSource = readSource(
        "src/components/analytics/tracking-provider.tsx"
    )

    it("no llama al endpoint /api/store/[slug]/meta-capi", () => {
        expect(trackingProviderSource).not.toContain("/meta-capi")
    })

    it("no expone la función sendMetaCapiFunnelEvent", () => {
        expect(trackingProviderSource).not.toContain("sendMetaCapiFunnelEvent")
    })

    it("no usa getTrackingParams (fbc/fbp) porque CAPI cliente está apagado", () => {
        expect(trackingProviderSource).not.toContain("getTrackingParams")
    })

    it("documenta explícitamente que CAPI está deshabilitado", () => {
        expect(trackingProviderSource).toContain(
            "Meta Conversions API (server-side) deshabilitado a nivel cliente."
        )
    })
})

describe("MetaPixel - sin doble init/PageView", () => {
    const metaPixelSource = readSource("src/components/analytics/meta-pixel.tsx")

    it("no contiene useEffect (init/PageView quedan solo en el <Script> inline)", () => {
        expect(metaPixelSource).not.toMatch(/\buseEffect\s*\(/)
    })

    it("no importa useEffect desde React", () => {
        expect(metaPixelSource).not.toMatch(/import\s*\{[^}]*useEffect[^}]*\}\s*from\s*["']react["']/)
    })

    it("dispara PageView una sola vez (en el <Script> inline)", () => {
        const pageViewMatches = metaPixelSource.match(
            /fbq\(\s*['"]track['"]\s*,\s*['"]PageView['"]/g
        ) ?? []
        expect(pageViewMatches.length).toBe(1)
    })
})

describe("Order layout - sin tracking duplicado", () => {
    const orderLayoutSource = readSource("src/app/order/layout.tsx")

    it("no importa MetaPixel ni TrackingProvider", () => {
        expect(orderLayoutSource).not.toMatch(/import\s+\{[^}]*MetaPixel[^}]*\}\s+from/)
        expect(orderLayoutSource).not.toMatch(/import\s+\{[^}]*TrackingProvider[^}]*\}\s+from/)
    })

    it("no renderiza ningún <MetaPixel /> ni <TrackingProvider> en el JSX", () => {
        expect(orderLayoutSource).not.toMatch(/<MetaPixel\b/)
        expect(orderLayoutSource).not.toMatch(/<TrackingProvider\b/)
    })

    it("no consulta organizations por custom_domain en el layout", () => {
        expect(orderLayoutSource).not.toMatch(/\.eq\(\s*["']custom_domain["']/)
    })
})
