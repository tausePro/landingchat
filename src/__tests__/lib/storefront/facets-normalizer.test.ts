import { describe, expect, it } from "vitest"

import { normalizeCategoryCounts } from "@/lib/storefront/facets-normalizer"

describe("normalizeCategoryCounts", () => {
    it("returns [] when input is null or undefined", () => {
        expect(normalizeCategoryCounts(null)).toEqual([])
        expect(normalizeCategoryCounts(undefined)).toEqual([])
    })

    it("returns [] when input is not an array (legacy RPC pre-20260527)", () => {
        expect(normalizeCategoryCounts({})).toEqual([])
        expect(normalizeCategoryCounts("not-an-array")).toEqual([])
        expect(normalizeCategoryCounts(123)).toEqual([])
    })

    it("returns [] for an empty array", () => {
        expect(normalizeCategoryCounts([])).toEqual([])
    })

    it("normalizes a valid jsonb array as returned by storefront_facets", () => {
        const input = [
            { name: "Snacks", count: 12 },
            { name: "Juguetes", count: 5 },
            { name: "Arenas Sanitarias", count: 8 },
        ]
        expect(normalizeCategoryCounts(input)).toEqual([
            { name: "Snacks", count: 12 },
            { name: "Juguetes", count: 5 },
            { name: "Arenas Sanitarias", count: 8 },
        ])
    })

    it("filters out items with empty or whitespace-only name", () => {
        const input = [
            { name: "Snacks", count: 12 },
            { name: "", count: 3 },
            { name: "   ", count: 2 },
            { name: "Juguetes", count: 5 },
        ]
        expect(normalizeCategoryCounts(input)).toEqual([
            { name: "Snacks", count: 12 },
            { name: "Juguetes", count: 5 },
        ])
    })

    it("filters out items with count <= 0 or non-numeric", () => {
        const input = [
            { name: "Snacks", count: 12 },
            { name: "Empty", count: 0 },
            { name: "Negative", count: -3 },
            { name: "Invalid", count: "not-a-number" },
            { name: "MissingCount" },
        ]
        expect(normalizeCategoryCounts(input)).toEqual([
            { name: "Snacks", count: 12 },
        ])
    })

    it("parses string counts as integers (defensive against jsonb quirks)", () => {
        const input = [
            { name: "Snacks", count: "12" },
            { name: "Juguetes", count: "5" },
        ]
        expect(normalizeCategoryCounts(input)).toEqual([
            { name: "Snacks", count: 12 },
            { name: "Juguetes", count: 5 },
        ])
    })

    it("trims whitespace from category names", () => {
        const input = [
            { name: "  Snacks  ", count: 12 },
            { name: "Juguetes\n", count: 5 },
        ]
        expect(normalizeCategoryCounts(input)).toEqual([
            { name: "Snacks", count: 12 },
            { name: "Juguetes", count: 5 },
        ])
    })

    it("ignores items that are not objects", () => {
        const input = [
            { name: "Snacks", count: 12 },
            null,
            "string-item",
            123,
            { name: "Juguetes", count: 5 },
        ]
        expect(normalizeCategoryCounts(input)).toEqual([
            { name: "Snacks", count: 12 },
            { name: "Juguetes", count: 5 },
        ])
    })
})
