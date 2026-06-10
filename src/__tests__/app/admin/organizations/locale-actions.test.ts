/**
 * Tests de `updateOrganizationLocale` (superadmin).
 *
 * Garantías:
 * - El guard de `is_superadmin` corre ANTES de usar el service client
 *   (las server actions son invocables por fuera del layout de /admin).
 * - Solo valores soportados en Fase 1 llegan a DB.
 * - El UPDATE se aplica a la organización indicada.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// --- Mocks ------------------------------------------------------------------

const mockAuthGetUser = vi.fn()

const mockProfilesSelect = vi.fn()
const mockProfilesEq = vi.fn()
const mockProfilesSingle = vi.fn()

const mockAuthFrom = vi.fn()

const mockOrgUpdate = vi.fn()
const mockOrgUpdateEq = vi.fn()

const mockServiceFrom = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockAuthGetUser },
        from: mockAuthFrom,
    })),
    createServiceClient: vi.fn(() => ({
        from: mockServiceFrom,
    })),
}))

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}))

beforeEach(() => {
    vi.clearAllMocks()

    mockAuthGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } })

    mockProfilesSingle.mockResolvedValue({
        data: { is_superadmin: true },
        error: null,
    })
    mockProfilesEq.mockReturnValue({ single: mockProfilesSingle })
    mockProfilesSelect.mockReturnValue({ eq: mockProfilesEq })
    mockAuthFrom.mockImplementation((table: string) => {
        if (table === "profiles") return { select: mockProfilesSelect }
        throw new Error(`Tabla inesperada en auth client: ${table}`)
    })

    mockOrgUpdateEq.mockResolvedValue({ error: null })
    mockOrgUpdate.mockReturnValue({ eq: mockOrgUpdateEq })
    mockServiceFrom.mockImplementation((table: string) => {
        if (table === "organizations") return { update: mockOrgUpdate }
        throw new Error(`Tabla inesperada en service client: ${table}`)
    })
})

import { updateOrganizationLocale } from "@/app/admin/organizations/actions"

const VALID_INPUT = {
    currency_code: "USD",
    locale: "en-US",
    country_code: "US",
} as const

describe("updateOrganizationLocale", () => {
    it("actualiza la organización indicada cuando el usuario es superadmin", async () => {
        const result = await updateOrganizationLocale("org-789", VALID_INPUT)

        expect(result.success).toBe(true)
        expect(mockOrgUpdate).toHaveBeenCalledWith({
            currency_code: "USD",
            locale: "en-US",
            country_code: "US",
        })
        expect(mockOrgUpdateEq).toHaveBeenCalledWith("id", "org-789")
    })

    it("rechaza a un usuario que no es superadmin sin usar el service client", async () => {
        mockProfilesSingle.mockResolvedValue({
            data: { is_superadmin: false },
            error: null,
        })

        const result = await updateOrganizationLocale("org-789", VALID_INPUT)

        expect(result.success).toBe(false)
        expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it("falla sin sesión y no usa el service client", async () => {
        mockAuthGetUser.mockResolvedValue({ data: { user: null } })

        const result = await updateOrganizationLocale("org-789", VALID_INPUT)

        expect(result.success).toBe(false)
        expect(mockServiceFrom).not.toHaveBeenCalled()
    })

    it("rechaza un locale no soportado sin tocar la base", async () => {
        const result = await updateOrganizationLocale("org-789", {
            currency_code: "COP",
            // pt-BR no está en Fase 1
            locale: "pt-BR",
            country_code: "CO",
        } as unknown as Parameters<typeof updateOrganizationLocale>[1])

        expect(result.success).toBe(false)
        expect(mockOrgUpdate).not.toHaveBeenCalled()
    })
})
