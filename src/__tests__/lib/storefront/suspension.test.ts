/**
 * Suspensión real (Admin S2): una org suspendida NO es públicamente
 * resoluble — resolvePublicOrganization es el choke point de las APIs
 * públicas (chat AI, bookings). Antes, suspender en el admin era
 * decorativo: nada lo verificaba.
 */

import { describe, expect, it, vi } from "vitest"
import { resolvePublicOrganization } from "@/lib/storefront/resolvePublicOrganization"
import type { SupabaseClient } from "@supabase/supabase-js"

function buildSupabase(row: Record<string, unknown> | null): SupabaseClient {
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.single = vi.fn(async () => ({ data: row }))
    return { from: () => chain } as unknown as SupabaseClient
}

const ACTIVE_ORG = { id: "org-1", name: "Tez", slug: "tez", custom_domain: null, status: "active" }

describe("resolvePublicOrganization — suspensión", () => {
    it("org activa se resuelve normal", async () => {
        const result = await resolvePublicOrganization(buildSupabase(ACTIVE_ORG), { slug: "tez" })
        expect(result?.id).toBe("org-1")
    })

    it("org suspendida → null (chat AI y bookings cortan)", async () => {
        const result = await resolvePublicOrganization(
            buildSupabase({ ...ACTIVE_ORG, status: "suspended" }),
            { slug: "tez" }
        )
        expect(result).toBeNull()
    })

    it("org suspendida por custom domain → null también", async () => {
        const result = await resolvePublicOrganization(
            buildSupabase({ ...ACTIVE_ORG, custom_domain: "tez.com.co", status: "suspended" }),
            { host: "tez.com.co" }
        )
        expect(result).toBeNull()
    })

    it("status null (orgs legacy) se trata como activa", async () => {
        const result = await resolvePublicOrganization(
            buildSupabase({ ...ACTIVE_ORG, status: null }),
            { slug: "tez" }
        )
        expect(result?.id).toBe("org-1")
    })
})
