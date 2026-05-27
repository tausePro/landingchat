import { describe, expect, it } from "vitest"

import { buildHighlightSegments } from "@/lib/storefront/highlight-match"

describe("buildHighlightSegments", () => {
    it("returns the whole text as a single non-match segment when query is empty", () => {
        expect(buildHighlightSegments("Serum Hidratante", "")).toEqual([
            { text: "Serum Hidratante", isMatch: false },
        ])
        expect(buildHighlightSegments("Serum Hidratante", "   ")).toEqual([
            { text: "Serum Hidratante", isMatch: false },
        ])
    })

    it("returns [] when text is empty", () => {
        expect(buildHighlightSegments("", "anything")).toEqual([])
    })

    it("highlights a simple case-insensitive match", () => {
        expect(buildHighlightSegments("Serum Hidratante", "serum")).toEqual([
            { text: "Serum", isMatch: true },
            { text: " Hidratante", isMatch: false },
        ])
    })

    it("highlights uppercase query against lowercase text", () => {
        expect(buildHighlightSegments("crema antiarrugas", "CREMA")).toEqual([
            { text: "crema", isMatch: true },
            { text: " antiarrugas", isMatch: false },
        ])
    })

    it("matches accented characters when query has no accents (cafe -> café)", () => {
        expect(buildHighlightSegments("Café Molido Premium", "cafe")).toEqual([
            { text: "Café", isMatch: true },
            { text: " Molido Premium", isMatch: false },
        ])
    })

    it("matches when text has no accents and query has accents (café -> cafe)", () => {
        expect(buildHighlightSegments("Cafe molido", "café")).toEqual([
            { text: "Cafe", isMatch: true },
            { text: " molido", isMatch: false },
        ])
    })

    it("highlights multiple occurrences", () => {
        expect(buildHighlightSegments("serum y serum", "serum")).toEqual([
            { text: "serum", isMatch: true },
            { text: " y ", isMatch: false },
            { text: "serum", isMatch: true },
        ])
    })

    it("preserves leading text before the first match", () => {
        expect(
            buildHighlightSegments("Tipo de arena para gato", "arena"),
        ).toEqual([
            { text: "Tipo de ", isMatch: false },
            { text: "arena", isMatch: true },
            { text: " para gato", isMatch: false },
        ])
    })

    it("returns whole text as non-match when query has no occurrences", () => {
        expect(
            buildHighlightSegments("Serum Hidratante", "xyz"),
        ).toEqual([{ text: "Serum Hidratante", isMatch: false }])
    })

    it("handles n-tilde (ñ) decomposed as n", () => {
        // pg_trgm + f_unaccent decomponen 'ñ' a 'n', mantenemos simetria
        expect(buildHighlightSegments("Niño feliz", "nino")).toEqual([
            { text: "Niño", isMatch: true },
            { text: " feliz", isMatch: false },
        ])
    })

    it("handles a query that spans an accented character in the middle", () => {
        // "Hidratacion" matches "Hidratación" (n al final, ó en medio)
        expect(
            buildHighlightSegments("Crema Hidratación Profunda", "hidratacion"),
        ).toEqual([
            { text: "Crema ", isMatch: false },
            { text: "Hidratación", isMatch: true },
            { text: " Profunda", isMatch: false },
        ])
    })

    it("handles partial-word matches", () => {
        expect(buildHighlightSegments("Antiarrugas", "arruga")).toEqual([
            { text: "Anti", isMatch: false },
            { text: "arruga", isMatch: true },
            { text: "s", isMatch: false },
        ])
    })

    it("returns single non-match when query is longer than text", () => {
        expect(
            buildHighlightSegments("ab", "this is a very long query"),
        ).toEqual([{ text: "ab", isMatch: false }])
    })

    it("trims query before matching but not the text", () => {
        expect(
            buildHighlightSegments("  serum hidratante  ", " serum "),
        ).toEqual([
            { text: "  ", isMatch: false },
            { text: "serum", isMatch: true },
            { text: " hidratante  ", isMatch: false },
        ])
    })
})
