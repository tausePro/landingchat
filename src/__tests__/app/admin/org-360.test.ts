/**
 * Tests de la ficha 360 del cliente (Admin S3): asignación de módulos
 * validada contra catálogo y gating por rol.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

let allowedRole = true
const updates: Array<Record<string, unknown>> = []

vi.mock("@/lib/admin/roles", () => ({
    requireAdminRole: vi.fn(async () => allowedRole),
}))

vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: vi.fn(async () => ({
        from: () => ({
            update: vi.fn((payload: Record<string, unknown>) => {
                updates.push(payload)
                return { eq: vi.fn(async () => ({ error: null })) }
            }),
        }),
    })),
    createClient: vi.fn(),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { updateOrganizationModules, updateOrgNotificationPhone } from "@/app/admin/organizations/[id]/actions"

beforeEach(() => {
    allowedRole = true
    updates.length = 0
})

describe("updateOrganizationModules", () => {
    it("asigna módulos del catálogo", async () => {
        const result = await updateOrganizationModules("org-1", ["products", "orders", "appointments"])

        expect(result.success).toBe(true)
        expect(updates[0]).toEqual({ enabled_modules: ["products", "orders", "appointments"] })
    })

    it("rechaza módulos fuera del catálogo (el input viene del cliente)", async () => {
        const result = await updateOrganizationModules("org-1", ["products", "superpowers"])

        expect(result.success).toBe(false)
        if (!result.success) expect(result.error).toContain("superpowers")
        expect(updates).toEqual([])
    })

    it("sin rol tech/superadmin → no autorizado", async () => {
        allowedRole = false
        const result = await updateOrganizationModules("org-1", ["products"])

        expect(result.success).toBe(false)
        expect(updates).toEqual([])
    })
})

describe("updateOrgNotificationPhone", () => {
    it("normaliza y guarda el teléfono", async () => {
        const result = await updateOrgNotificationPhone("org-1", "+57 300 111-2233")

        expect(result.success).toBe(true)
        expect(updates[0]).toEqual({ notification_phone: "573001112233" })
    })

    it("vacío → limpia el teléfono (null)", async () => {
        const result = await updateOrgNotificationPhone("org-1", "")

        expect(result.success).toBe(true)
        expect(updates[0]).toEqual({ notification_phone: null })
    })

    it("teléfono inválido → rechazado", async () => {
        const result = await updateOrgNotificationPhone("org-1", "123")

        expect(result.success).toBe(false)
        expect(updates).toEqual([])
    })
})
