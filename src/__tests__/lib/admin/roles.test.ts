/**
 * Tests de los roles del equipo de plataforma (Admin S1):
 * superadmin (todo) / finance (números) / tech (operación).
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

let profileRow: Record<string, unknown> | null
let authedUser: { id: string } | null

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: vi.fn(async () => ({ data: { user: authedUser } })) },
        from: () => {
            const chain: Record<string, unknown> = {}
            chain.select = vi.fn(() => chain)
            chain.eq = vi.fn(() => chain)
            chain.single = vi.fn(async () => ({ data: profileRow }))
            return chain
        },
    })),
    createServiceClient: vi.fn(),
}))

import { getCurrentAdminRole, requireAdminRole, canAccessSection } from "@/lib/admin/roles"

beforeEach(() => {
    authedUser = { id: "u1" }
    profileRow = { is_superadmin: false, admin_role: null }
})

describe("getCurrentAdminRole", () => {
    it("is_superadmin=true manda sobre admin_role (compat legacy)", async () => {
        profileRow = { is_superadmin: true, admin_role: null }
        expect(await getCurrentAdminRole()).toBe("superadmin")
    })

    it("admin_role finance/tech sin superadmin", async () => {
        profileRow = { is_superadmin: false, admin_role: "finance" }
        expect(await getCurrentAdminRole()).toBe("finance")
    })

    it("sin rol → null (sin acceso al panel)", async () => {
        expect(await getCurrentAdminRole()).toBeNull()
    })

    it("sin sesión → null", async () => {
        authedUser = null
        expect(await getCurrentAdminRole()).toBeNull()
    })

    it("rol corrupto en DB → null", async () => {
        profileRow = { is_superadmin: false, admin_role: "hacker" }
        expect(await getCurrentAdminRole()).toBeNull()
    })
})

describe("requireAdminRole", () => {
    it("superadmin pasa cualquier gate, incluso lista vacía", async () => {
        profileRow = { is_superadmin: true, admin_role: "superadmin" }
        expect(await requireAdminRole([])).toBe(true)
        expect(await requireAdminRole(["finance"])).toBe(true)
    })

    it("finance pasa gates de finance pero no de tech ni superadmin-only", async () => {
        profileRow = { is_superadmin: false, admin_role: "finance" }
        expect(await requireAdminRole(["finance"])).toBe(true)
        expect(await requireAdminRole(["tech"])).toBe(false)
        expect(await requireAdminRole([])).toBe(false)
    })

    it("usuario normal no pasa ningún gate", async () => {
        expect(await requireAdminRole(["finance", "tech"])).toBe(false)
    })
})

describe("canAccessSection (sidebar)", () => {
    it("finance ve números, no configs técnicas ni usuarios", () => {
        expect(canAccessSection("finance", "/admin/ai-usage")).toBe(true)
        expect(canAccessSection("finance", "/admin/operating-costs")).toBe(true)
        expect(canAccessSection("finance", "/admin/subscriptions")).toBe(true)
        expect(canAccessSection("finance", "/admin/settings/evolution")).toBe(false)
        expect(canAccessSection("finance", "/admin/users")).toBe(false)
        expect(canAccessSection("finance", "/admin/organizations")).toBe(false)
    })

    it("tech ve operación, no finanzas", () => {
        expect(canAccessSection("tech", "/admin/settings/platform-notifications")).toBe(true)
        expect(canAccessSection("tech", "/admin/whatsapp")).toBe(true)
        expect(canAccessSection("tech", "/admin/organizations")).toBe(true)
        expect(canAccessSection("tech", "/admin/operating-costs")).toBe(false)
        expect(canAccessSection("tech", "/admin/subscriptions")).toBe(false)
        expect(canAccessSection("tech", "/admin/users")).toBe(false)
    })

    it("superadmin ve todo, incluso rutas no mapeadas", () => {
        expect(canAccessSection("superadmin", "/admin/users")).toBe(true)
        expect(canAccessSection("superadmin", "/admin/ruta-nueva")).toBe(true)
    })

    it("ruta no mapeada → denegada para roles no-superadmin (default seguro)", () => {
        expect(canAccessSection("finance", "/admin/ruta-nueva")).toBe(false)
        expect(canAccessSection("tech", "/admin/ruta-nueva")).toBe(false)
    })
})
