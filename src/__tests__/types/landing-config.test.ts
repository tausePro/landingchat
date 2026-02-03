/**
 * Tests for landing page configuration types and defaults
 */

import { describe, it, expect } from "vitest"
import { defaultLandingConfig, type LandingMainConfig } from "@/types/landing"

describe("Landing Config Defaults", () => {
    it("should have all required fields defined", () => {
        const config = defaultLandingConfig

        // Header
        expect(config.header_nav_links).toBeInstanceOf(Array)
        expect(config.header_nav_links.length).toBeGreaterThan(0)
        expect(config.header_cta_text).toBeTruthy()
        expect(config.header_cta_href).toBeTruthy()

        // Hero
        expect(config.hero_title_line1).toBeTruthy()
        expect(config.hero_title_line2).toBeTruthy()
        expect(config.hero_description).toBeTruthy()
        expect(config.hero_cta_primary_text).toBeTruthy()
        expect(config.hero_cta_primary_href).toBeTruthy()

        // Features
        expect(config.features.length).toBeGreaterThanOrEqual(4)
        expect(config.features_title).toBeTruthy()

        // Pricing labels
        expect(config.pricing_title).toBeTruthy()
        expect(config.pricing_cta_text).toBeTruthy()

        // Footer
        expect(config.footer_columns.length).toBeGreaterThanOrEqual(2)
        expect(config.footer_copyright).toBeTruthy()

        // SEO
        expect(config.seo_title).toBeTruthy()
        expect(config.seo_description).toBeTruthy()
    })

    it("should merge partial DB config over defaults correctly", () => {
        const partialDbConfig: Partial<LandingMainConfig> = {
            hero_title_line1: "Custom Title",
            pricing_title: "Custom Pricing",
        }

        const merged: LandingMainConfig = { ...defaultLandingConfig, ...partialDbConfig }

        // Overridden fields
        expect(merged.hero_title_line1).toBe("Custom Title")
        expect(merged.pricing_title).toBe("Custom Pricing")

        // Non-overridden fields keep defaults
        expect(merged.hero_title_line2).toBe(defaultLandingConfig.hero_title_line2)
        expect(merged.header_cta_text).toBe(defaultLandingConfig.header_cta_text)
        expect(merged.features).toEqual(defaultLandingConfig.features)
    })

    it("should handle empty DB config (no overrides)", () => {
        const emptyConfig: Partial<LandingMainConfig> = {}
        const merged: LandingMainConfig = { ...defaultLandingConfig, ...emptyConfig }

        expect(merged).toEqual(defaultLandingConfig)
    })

    it("should have valid nav link structure", () => {
        for (const link of defaultLandingConfig.header_nav_links) {
            expect(link.label).toBeTruthy()
            expect(link.href).toBeTruthy()
            expect(link.href.startsWith("#") || link.href.startsWith("/")).toBe(true)
        }
    })

    it("should have valid feature structure", () => {
        for (const feature of defaultLandingConfig.features) {
            expect(feature.icon).toBeTruthy()
            expect(feature.title).toBeTruthy()
            expect(feature.description).toBeTruthy()
            expect(["wide", "normal", undefined]).toContain(feature.span)
        }
    })

    it("should have footer columns with links", () => {
        for (const column of defaultLandingConfig.footer_columns) {
            expect(column.title).toBeTruthy()
            expect(column.links.length).toBeGreaterThan(0)
            for (const link of column.links) {
                expect(link.label).toBeTruthy()
                expect(link.href).toBeTruthy()
            }
        }
    })

    it("metrics should be visible by default", () => {
        expect(defaultLandingConfig.metrics_visible).toBe(true)
        expect(defaultLandingConfig.metrics.length).toBeGreaterThanOrEqual(3)
    })

    it("testimonial should be visible by default", () => {
        expect(defaultLandingConfig.testimonial_visible).toBe(true)
        expect(defaultLandingConfig.testimonial.quote).toBeTruthy()
        expect(defaultLandingConfig.testimonial.author).toBeTruthy()
    })

    it("marketplace agents should have required fields", () => {
        expect(defaultLandingConfig.marketplace_agents.length).toBeGreaterThan(0)
        for (const agent of defaultLandingConfig.marketplace_agents) {
            expect(agent.name).toBeTruthy()
            expect(agent.description).toBeTruthy()
            expect(agent.icon).toBeTruthy()
            expect(agent.color).toBeTruthy()
        }
    })

    it("comparison rows should have feature names", () => {
        expect(defaultLandingConfig.comparison_rows.length).toBeGreaterThan(0)
        for (const row of defaultLandingConfig.comparison_rows) {
            expect(row.feature).toBeTruthy()
            expect(typeof row.traditional).toBe("boolean")
            expect(typeof row.landingchat).toBe("boolean")
        }
    })
})
