import { describe, expect, it } from "vitest"
import {
    getMetaActionBreakdown,
    isMetaConversionAction,
} from "@/lib/analytics/meta-marketing-api"

describe("meta-marketing-api action breakdown", () => {
    describe("isMetaConversionAction", () => {
        it("acepta action_type conocidos de purchase", () => {
            expect(isMetaConversionAction("purchase")).toBe(true)
            expect(isMetaConversionAction("omni_purchase")).toBe(true)
            expect(isMetaConversionAction("offsite_conversion.fb_pixel_purchase")).toBe(true)
            expect(isMetaConversionAction("onsite_web_purchase")).toBe(true)
        })

        it("acepta action_type conocidos de lead y registration", () => {
            expect(isMetaConversionAction("lead")).toBe(true)
            expect(isMetaConversionAction("offsite_conversion.fb_pixel_lead")).toBe(true)
            expect(isMetaConversionAction("complete_registration")).toBe(true)
        })

        it("es case-insensitive", () => {
            expect(isMetaConversionAction("PURCHASE")).toBe(true)
            expect(isMetaConversionAction("Omni_Purchase")).toBe(true)
        })

        it("rechaza action_type que no son conversiones", () => {
            expect(isMetaConversionAction("link_click")).toBe(false)
            expect(isMetaConversionAction("video_view")).toBe(false)
            expect(isMetaConversionAction("page_engagement")).toBe(false)
            expect(isMetaConversionAction("post_reaction")).toBe(false)
            expect(isMetaConversionAction("")).toBe(false)
            expect(isMetaConversionAction("random_string")).toBe(false)
        })
    })

    describe("getMetaActionBreakdown", () => {
        it("retorna ceros cuando actions es undefined o vacío", () => {
            expect(getMetaActionBreakdown(undefined)).toEqual({
                purchases: 0,
                leads: 0,
                registrations: 0,
                total: 0,
            })
            expect(getMetaActionBreakdown([])).toEqual({
                purchases: 0,
                leads: 0,
                registrations: 0,
                total: 0,
            })
        })

        it("ignora action_type que no son conversiones", () => {
            const breakdown = getMetaActionBreakdown([
                { action_type: "link_click", value: "1500" },
                { action_type: "video_view", value: "8000" },
                { action_type: "page_engagement", value: "200" },
            ])
            expect(breakdown).toEqual({
                purchases: 0,
                leads: 0,
                registrations: 0,
                total: 0,
            })
        })

        it("dedup: una compra reportada bajo múltiples action_type cuenta una sola vez", () => {
            // Caso real de Meta: 1 compra aparece simultáneamente bajo varios tipos.
            const breakdown = getMetaActionBreakdown([
                { action_type: "purchase", value: "1" },
                { action_type: "omni_purchase", value: "1" },
                { action_type: "offsite_conversion.fb_pixel_purchase", value: "1" },
                { action_type: "onsite_web_purchase", value: "1" },
            ])
            expect(breakdown.purchases).toBe(1)
            expect(breakdown.total).toBe(1)
        })

        it("preferencia: omni_purchase manda sobre purchase si ambos tienen valor", () => {
            const breakdown = getMetaActionBreakdown([
                { action_type: "purchase", value: "5" },
                { action_type: "omni_purchase", value: "8" },
                { action_type: "offsite_conversion.fb_pixel_purchase", value: "5" },
            ])
            // omni_purchase es el primer preferido; toma 8, ignora los demás
            expect(breakdown.purchases).toBe(8)
            expect(breakdown.total).toBe(8)
        })

        it("preferencia: si omni_purchase es 0, cae a purchase", () => {
            const breakdown = getMetaActionBreakdown([
                { action_type: "omni_purchase", value: "0" },
                { action_type: "purchase", value: "5" },
                { action_type: "offsite_conversion.fb_pixel_purchase", value: "5" },
            ])
            expect(breakdown.purchases).toBe(5)
        })

        it("preferencia: si purchase es 0 y solo está pixel offsite, lo usa", () => {
            const breakdown = getMetaActionBreakdown([
                { action_type: "offsite_conversion.fb_pixel_purchase", value: "12" },
            ])
            expect(breakdown.purchases).toBe(12)
        })

        it("separa correctamente purchase + lead + registration sin overlap", () => {
            const breakdown = getMetaActionBreakdown([
                { action_type: "purchase", value: "3" },
                { action_type: "omni_purchase", value: "3" },
                { action_type: "lead", value: "10" },
                { action_type: "offsite_conversion.fb_pixel_lead", value: "10" },
                { action_type: "complete_registration", value: "5" },
            ])
            expect(breakdown).toEqual({
                purchases: 3,
                leads: 10,
                registrations: 5,
                total: 18,
            })
        })

        it("escenario real Tez: payload con muchos duplicados y noise no debe inflar", () => {
            // Reproducción de lo que devolvía Meta para Tez: muchos action_type
            // por evento. La implementación anterior sumaba TODOS y reportaba
            // 26.850 cuando había ~3-100 conversiones reales.
            const noisyActions = [
                { action_type: "link_click", value: "5000" },
                { action_type: "video_view", value: "8000" },
                { action_type: "post_reaction", value: "200" },
                { action_type: "page_engagement", value: "1500" },
                { action_type: "post_engagement", value: "1500" },
                // Compras duplicadas
                { action_type: "omni_purchase", value: "3" },
                { action_type: "purchase", value: "3" },
                { action_type: "offsite_conversion.fb_pixel_purchase", value: "3" },
                { action_type: "onsite_web_purchase", value: "3" },
                // Leads duplicados
                { action_type: "lead", value: "12" },
                { action_type: "offsite_conversion.fb_pixel_lead", value: "12" },
            ]
            const breakdown = getMetaActionBreakdown(noisyActions)
            expect(breakdown.purchases).toBe(3)
            expect(breakdown.leads).toBe(12)
            expect(breakdown.registrations).toBe(0)
            expect(breakdown.total).toBe(15)
        })

        it("es case-insensitive en action_type", () => {
            const breakdown = getMetaActionBreakdown([
                { action_type: "PURCHASE", value: "7" },
                { action_type: "Omni_Purchase", value: "7" },
            ])
            expect(breakdown.purchases).toBe(7)
        })

        it("parsea valores no numéricos como 0", () => {
            const breakdown = getMetaActionBreakdown([
                { action_type: "purchase", value: "not_a_number" },
            ])
            expect(breakdown.purchases).toBe(0)
            expect(breakdown.total).toBe(0)
        })
    })
})
