/**
 * Tests del componente WhatsAppFloatingButton (v1.14.2).
 *
 * El repo NO usa @testing-library/react; los tests de componentes se hacen
 * con dos patrones:
 *   1. Source-string-matching para verificar invariantes del JSX/CSS
 *      (mismo patrón que tracking-provider.regression.test.ts).
 *   2. Unit tests de funciones puras exportadas.
 */

import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { normalizeWhatsAppPhone } from "@/components/store/whatsapp-floating-button"

const repoRoot = path.resolve(__dirname, "../../../..")

function readSource(relativePath: string): string {
    return readFileSync(path.join(repoRoot, relativePath), "utf8")
}

describe("WhatsAppFloatingButton — normalizeWhatsAppPhone", () => {
    it("normaliza un número internacional con espacios y +", () => {
        expect(normalizeWhatsAppPhone("+57 300 123 4567")).toBe("573001234567")
    })

    it("normaliza un número con guiones", () => {
        expect(normalizeWhatsAppPhone("57-300-123-4567")).toBe("573001234567")
    })

    it("normaliza un número con paréntesis", () => {
        expect(normalizeWhatsAppPhone("(57) 300 1234567")).toBe("573001234567")
    })

    it("retorna null si el input es null", () => {
        expect(normalizeWhatsAppPhone(null)).toBeNull()
    })

    it("retorna null si el input es undefined", () => {
        expect(normalizeWhatsAppPhone(undefined)).toBeNull()
    })

    it("retorna null si el input es string vacío", () => {
        expect(normalizeWhatsAppPhone("")).toBeNull()
    })

    it("retorna null si el input solo tiene espacios", () => {
        expect(normalizeWhatsAppPhone("   ")).toBeNull()
    })

    it("retorna null si tiene menos de 8 dígitos", () => {
        expect(normalizeWhatsAppPhone("1234567")).toBeNull()
    })

    it("acepta exactamente 8 dígitos como mínimo", () => {
        expect(normalizeWhatsAppPhone("12345678")).toBe("12345678")
    })

    it("preserva números más largos (e.g. con código país US)", () => {
        expect(normalizeWhatsAppPhone("+1 (415) 555-9876")).toBe("14155559876")
    })

    it("ignora caracteres no numéricos exóticos", () => {
        expect(normalizeWhatsAppPhone("57·300·123·4567")).toBe("573001234567")
    })
})

describe("WhatsAppFloatingButton — invariantes visuales (v1.14.2)", () => {
    // Estos tests blindan el patrón visual decidido en el hotfix:
    //   color WhatsApp oficial, halo animado, tooltip glass al hover, ring.
    // Si alguien refactoriza y elimina alguna clase clave, el test falla.

    const source = readSource(
        "src/components/store/whatsapp-floating-button.tsx"
    )

    it("usa el color oficial #25D366 (no bg-green-500 genérico)", () => {
        expect(source).toContain("bg-[#25D366]")
        expect(source).not.toContain("bg-green-500")
    })

    it("incluye halo animado animate-pulse + animate-ping", () => {
        expect(source).toContain("animate-pulse")
        expect(source).toContain("animate-ping")
    })

    it("usa fixed bottom-6 right-6 z-50 para posicionamiento consistente con b2b_imprima", () => {
        expect(source).toContain("fixed bottom-6 right-6 z-50")
    })

    it("incluye tooltip glass al hover con backdrop-blur", () => {
        expect(source).toContain("backdrop-blur")
        expect(source).toContain("group-hover:opacity-100")
    })

    it("incluye ring blanco semi-transparente", () => {
        expect(source).toContain("ring-white/60")
    })

    it("abre WhatsApp con wa.me (no API directa)", () => {
        expect(source).toContain("https://wa.me/")
    })

    it("usa target=_blank + rel noopener noreferrer (seguridad)", () => {
        expect(source).toContain('target="_blank"')
        expect(source).toContain('rel="noopener noreferrer"')
    })

    it("NO introduce LeadModal (capture de leads es Fase 2)", () => {
        expect(source).not.toMatch(/LeadModal|leadCapture|capture-lead/i)
    })
})

describe("ChatAIFloatingButton — invariantes visuales (v1.14.2)", () => {
    const source = readSource(
        "src/components/store/chat-ai-floating-button.tsx"
    )

    it("usa fixed bottom-6 right-6 z-50 (misma posición que WhatsApp)", () => {
        expect(source).toContain("fixed bottom-6 right-6 z-50")
    })

    it("usa primaryColor del tenant via style inline", () => {
        expect(source).toContain("backgroundColor: primaryColor")
    })

    it("incluye ring blanco para coherencia visual con WhatsAppFloatingButton", () => {
        expect(source).toContain("ring-white/60")
    })
})

describe("store-layout-client — refactor del botón flotante (v1.14.2)", () => {
    // El inline button (38 líneas de SVG + condicional) fue extraído a
    // dos componentes reutilizables. Este test garantiza que no se
    // regresione el patrón.

    const source = readSource(
        "src/app/store/[slug]/store-layout-client.tsx"
    )

    it("importa WhatsAppFloatingButton del nuevo componente", () => {
        expect(source).toContain(
            'import { WhatsAppFloatingButton } from "@/components/store/whatsapp-floating-button"'
        )
    })

    it("importa ChatAIFloatingButton del nuevo componente", () => {
        expect(source).toContain(
            'import { ChatAIFloatingButton } from "@/components/store/chat-ai-floating-button"'
        )
    })

    it("YA NO contiene el SVG path inline de WhatsApp (refactor completo)", () => {
        // El path original tenía esta firma característica.
        expect(source).not.toContain("M17.472 14.382c-.297-.149-1.758-.867")
    })

    it("YA NO usa bg-green-500 (color genérico) en el botón flotante", () => {
        // Buscamos en el contexto del botón flotante específicamente.
        // bg-green-500 puede existir para otros usos (e.g. badges).
        const sectionMatch = source.match(/\/\* [^*]*Bot[oó]n flotante[^*]*\*\/[\s\S]{0,800}/i)
        if (sectionMatch) {
            expect(sectionMatch[0]).not.toContain("bg-green-500")
        }
    })

    it("mantiene el contrato condicional WhatsApp vs ChatAI", () => {
        expect(source).toContain("organization.settings?.whatsapp?.phone")
        expect(source).toContain("<WhatsAppFloatingButton")
        expect(source).toContain("<ChatAIFloatingButton")
    })
})

describe("[pageSlug]/page.tsx — enrich consistency (v1.14.2)", () => {
    // Bug pre-v1.14.2: la página de páginas custom del storefront cargaba
    // la organización con su propia query y NO aplicaba el enrich. Como
    // consecuencia el botón flotante mostraba chat IA aunque el tenant
    // tuviera WhatsApp Business conectado.

    const source = readSource(
        "src/app/store/[slug]/[pageSlug]/page.tsx"
    )

    it("importa enrichOrganizationWithStorefrontContact", () => {
        expect(source).toContain("enrichOrganizationWithStorefrontContact")
    })

    it("importa resolveOrganizationWhatsAppPhone", () => {
        expect(source).toContain("resolveOrganizationWhatsAppPhone")
    })

    it("importa resolveOrganizationAgentIdentity", () => {
        expect(source).toContain("resolveOrganizationAgentIdentity")
    })

    it("pasa enrichedOrg al StoreLayoutClient (no la org cruda)", () => {
        expect(source).toContain("organization={enrichedOrg}")
        // Sanity: no quedó el viejo passthrough.
        expect(source).not.toMatch(/organization=\{org\}/)
    })
})

describe("organization-enrichment — fallback corporate -> personal (v1.14.2)", () => {
    // Bug observado en Tez: corporate disconnected, personal connected con
    // numero valido. El query original (instance_type='corporate' AND
    // status='connected') retornaba null y el boton caia al chat IA.
    // El fix: traer todas las connected y priorizar corporate sobre personal.

    const source = readSource(
        "src/lib/storefront/organization-enrichment.ts"
    )

    it("YA NO usa el filtro estricto instance_type='corporate'", () => {
        // El query nuevo NO debe encadenar .eq('instance_type', 'corporate')
        // directamente al query (el filtro se hace post-fetch en TS).
        expect(source).not.toMatch(/\.eq\("instance_type",\s*"corporate"\)/)
    })

    it("filtra solo por status='connected' a nivel SQL", () => {
        expect(source).toContain('.eq("status", "connected")')
    })

    it("filtra phone_number not null a nivel SQL", () => {
        expect(source).toContain('.not("phone_number", "is", null)')
    })

    it("prioriza corporate sobre personal post-fetch", () => {
        const corpIdx = source.indexOf('instance_type === "corporate"')
        const persIdx = source.indexOf('instance_type === "personal"')
        expect(corpIdx).toBeGreaterThan(0)
        expect(persIdx).toBeGreaterThan(0)
        // Corporate debe aparecer ANTES que personal (priorizada).
        expect(corpIdx).toBeLessThan(persIdx)
    })
})

describe("organization-form — campo storefront whatsapp phone (v1.14.2)", () => {
    // Permitir al merchant configurar manualmente el numero WhatsApp del
    // storefront (override del fallback automatico).

    const source = readSource(
        "src/app/dashboard/settings/components/organization-form.tsx"
    )

    it("contiene el input id='storefrontWhatsappPhone'", () => {
        expect(source).toContain('id="storefrontWhatsappPhone"')
    })

    it("usa updateSettings('whatsapp', 'phone', ...) para persistir", () => {
        expect(source).toContain('updateSettings("whatsapp", "phone"')
    })

    it("incluye texto explicativo del fallback automatico", () => {
        expect(source).toMatch(/instancia de WhatsApp Business conectada/i)
    })

    it("muestra warning si el numero tiene menos de 8 digitos", () => {
        expect(source).toContain("debe tener al menos 8 dígitos")
    })

    it("expone safeSettings.whatsapp.phone con default a string vacio", () => {
        expect(source).toContain("safeSettings.whatsapp.phone")
    })
})
