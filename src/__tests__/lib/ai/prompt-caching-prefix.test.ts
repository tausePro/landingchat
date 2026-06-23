/**
 * Regresión prompt caching — el prefijo cacheado debe ser ESTABLE entre turnos.
 *
 * Anthropic cachea por prefijo (tools + system con cache_control). Si dentro del
 * bloque cacheado va algo que cambia por request, el prefijo deja de coincidir y
 * el cache se invalida en cada turno (cero ahorro).
 *
 * El fix saca del bloque cacheado todo lo que cambia por request:
 *   - fecha/hora con minutos → `getModeDateTimeContext` (el chat la inyecta en el
 *     bloque DINÁMICO, fuera del cache_control).
 *   - archivos prioritarios por mensaje → `priorityMediaContext` en chat-agent.
 *
 * Estos tests fijan la propiedad a nivel de agent-factory: con `includeDateTime=false`
 * el addendum (parte cacheable) NO incluye la fecha y es determinista, mientras que
 * la fecha sigue disponible aparte para el bloque dinámico.
 */
import { describe, expect, it } from "vitest"
import { getModePromptAddendum, getModeDateTimeContext } from "@/lib/ai/agent-factory"

describe("prompt caching — fecha/hora fuera del prefijo cacheado", () => {
    it("getModeDateTimeContext devuelve la fecha para real_estate", () => {
        expect(getModeDateTimeContext("real_estate", "es-CO", null)).toContain("FECHA Y HORA ACTUAL")
    })

    it("getModeDateTimeContext devuelve la fecha para ecommerce con módulo appointments", () => {
        expect(getModeDateTimeContext("ecommerce", "es-CO", ["appointments"])).toContain("FECHA Y HORA ACTUAL")
    })

    it("getModeDateTimeContext en-US devuelve la fecha en inglés", () => {
        expect(getModeDateTimeContext("real_estate", "en-US", null)).toContain("CURRENT DATE AND TIME")
    })

    it("getModeDateTimeContext devuelve '' para ecommerce sin booking (no necesita fecha)", () => {
        expect(getModeDateTimeContext("ecommerce", "es-CO", null)).toBe("")
    })

    it("addendum con includeDateTime=false NO incluye la fecha (real_estate) pero conserva el resto", () => {
        const addendum = getModePromptAddendum("real_estate", 12, null, "es-CO", null, false)
        expect(addendum).not.toContain("FECHA Y HORA ACTUAL")
        expect(addendum).toContain("MODO INMOBILIARIO")
        expect(addendum).toContain("12 propiedades")
    })

    it("addendum con includeDateTime=false NO incluye la fecha (ecommerce + booking)", () => {
        const addendum = getModePromptAddendum("ecommerce", 0, null, "es-CO", ["appointments"], false)
        expect(addendum).not.toContain("FECHA Y HORA ACTUAL")
    })

    it("el prefijo cacheable es determinista: misma entrada → mismo addendum (sin reloj)", () => {
        const a = getModePromptAddendum("real_estate", 12, null, "es-CO", null, false)
        const b = getModePromptAddendum("real_estate", 12, null, "es-CO", null, false)
        expect(a).toBe(b)
    })

    it("retro-compat: con includeDateTime por defecto (true) la fecha SÍ se incrusta", () => {
        const addendum = getModePromptAddendum("real_estate", 12, null, "es-CO", null)
        expect(addendum).toContain("FECHA Y HORA ACTUAL")
    })
})
