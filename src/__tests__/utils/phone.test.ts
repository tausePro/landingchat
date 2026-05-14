/**
 * Tests focales para los helpers de telefono.
 *
 * Cubre principalmente extractPhoneFromJid (agregado en v1.12.5 como fix
 * al bug "No hay conversacion activa" reportado por Casa Inmobiliaria el
 * 2026-05-14: WhatsApp empezo a enviar remoteJid con sufijo @lid en lugar
 * de @s.whatsapp.net y los comandos del operador dejaron de matchear el
 * chat porque la asimetria entre guardar (con sufijo) y buscar (sin sufijo)
 * rompia la consulta).
 */
import { describe, expect, it } from "vitest"
import { extractPhoneFromJid, getPhoneVariants, normalizePhone } from "@/lib/utils/phone"

describe("extractPhoneFromJid", () => {
    describe("formatos validos de WhatsApp", () => {
        it("limpia el sufijo @s.whatsapp.net (formato clasico)", () => {
            expect(extractPhoneFromJid("573001234567@s.whatsapp.net")).toBe("573001234567")
        })

        it("limpia el sufijo @lid (Linked ID, privacidad nueva)", () => {
            // Regresion del incidente Casa Inmob 2026-05-14
            expect(extractPhoneFromJid("65820390633601@lid")).toBe("65820390633601")
        })

        it("limpia el sufijo @c.us (variante de algunos providers)", () => {
            expect(extractPhoneFromJid("573001234567@c.us")).toBe("573001234567")
        })

        it("limpia el sufijo @g.us (grupos, aunque no procesamos grupos hoy)", () => {
            expect(extractPhoneFromJid("123456789-1234567890@g.us")).toBe("123456789-1234567890")
        })

        it("deja intacto un valor ya limpio (sin @)", () => {
            expect(extractPhoneFromJid("573001234567")).toBe("573001234567")
        })

        it("maneja sufijos desconocidos futuros (@cualquier-cosa)", () => {
            // Fail-forward: si WhatsApp introduce un nuevo formato, lo seguimos limpiando.
            expect(extractPhoneFromJid("573001234567@futuro.nuevo")).toBe("573001234567")
        })
    })

    describe("inputs degradados", () => {
        it("string vacio devuelve vacio", () => {
            expect(extractPhoneFromJid("")).toBe("")
        })

        it("solo el @ devuelve vacio (todo despues del primer @ se quita)", () => {
            expect(extractPhoneFromJid("@s.whatsapp.net")).toBe("")
        })

        it("multiples @ -> corta en el PRIMER @", () => {
            expect(extractPhoneFromJid("foo@bar@baz")).toBe("foo")
        })
    })

    describe("simetria con getPhoneVariants y normalizePhone", () => {
        it("output es compatible con normalizePhone para numero colombiano", () => {
            const cleaned = extractPhoneFromJid("573001234567@s.whatsapp.net")
            expect(normalizePhone(cleaned)).toBe("573001234567")
        })

        it("output es compatible con getPhoneVariants para Linked ID", () => {
            // Para un @lid no colombiano, el output cae al fallback de getPhoneVariants
            // y al menos debe contener el numero original sin sufijo.
            const cleaned = extractPhoneFromJid("65820390633601@lid")
            const variants = getPhoneVariants(cleaned)
            expect(variants).toContain("65820390633601")
        })

        it("garantiza que guardar y buscar matchean despues del fix", () => {
            // Reproduce el incidente: el chat se guardaba con phone_number igual
            // al output de extractPhoneFromJid; las variantes para la busqueda deben
            // incluir ese mismo valor para que la query .in() encuentre el chat.
            const fromJid = extractPhoneFromJid("65820390633601@lid")
            const variants = getPhoneVariants(fromJid)
            expect(variants).toContain(fromJid)
        })
    })
})

describe("normalizePhone", () => {
    it("normaliza numero colombiano con formato +57 al canonico", () => {
        expect(normalizePhone("+57 300 123 4567")).toBe("573001234567")
    })

    it("agrega prefijo 57 a numero colombiano de 10 digitos", () => {
        expect(normalizePhone("3001234567")).toBe("573001234567")
    })

    it("deja intacto numero ya canonico", () => {
        expect(normalizePhone("573001234567")).toBe("573001234567")
    })

    it("devuelve solo digitos como fallback para numeros no colombianos", () => {
        // Linked ID se trata como fallback (no es un numero real de pais).
        expect(normalizePhone("65820390633601")).toBe("65820390633601")
    })
})

describe("getPhoneVariants", () => {
    it("genera 3 variantes para numero colombiano canonico", () => {
        const variants = getPhoneVariants("573001234567")
        expect(variants).toContain("573001234567")
        expect(variants).toContain("3001234567")
        expect(variants).toContain("+573001234567")
    })

    it("genera 3 variantes para numero colombiano de 10 digitos", () => {
        const variants = getPhoneVariants("3001234567")
        expect(variants).toContain("3001234567")
        expect(variants).toContain("573001234567")
        expect(variants).toContain("+573001234567")
    })

    it("deduplica y filtra vacios", () => {
        const variants = getPhoneVariants("573001234567")
        expect(new Set(variants).size).toBe(variants.length)
        expect(variants.every((v) => v.length > 0)).toBe(true)
    })
})
