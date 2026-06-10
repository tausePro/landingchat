/**
 * Tests de `updateLocaleSettings` (dashboard del dueño).
 *
 * Garantías:
 * - Solo valores soportados en Fase 1 (COP/USD, es-CO/en-US, CO/US) llegan a DB.
 * - El UPDATE se aplica a la organización del perfil autenticado (RLS-friendly).
 * - Sin sesión no se toca la base.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// --- Mocks ------------------------------------------------------------------

const mockAuthGetUser = vi.fn()

const mockProfilesSelect = vi.fn()
const mockProfilesEq = vi.fn()
const mockProfilesSingle = vi.fn()

const mockOrgUpdate = vi.fn()
const mockOrgUpdateEq = vi.fn()

const mockFrom = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockAuthGetUser },
        from: mockFrom,
    })),
    createServiceClient: vi.fn(),
}))

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}))

beforeEach(() => {
    vi.clearAllMocks()

    mockAuthGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } })

    mockProfilesSingle.mockResolvedValue({
        data: { organization_id: "org-456" },
        error: null,
    })
    mockProfilesEq.mockReturnValue({ single: mockProfilesSingle })
    mockProfilesSelect.mockReturnValue({ eq: mockProfilesEq })

    mockOrgUpdateEq.mockResolvedValue({ error: null })
    mockOrgUpdate.mockReturnValue({ eq: mockOrgUpdateEq })

    mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") return { select: mockProfilesSelect }
        if (table === "organizations") return { update: mockOrgUpdate }
        throw new Error(`Tabla inesperada: ${table}`)
    })
})

import { updateLocaleSettings } from "@/app/dashboard/settings/actions"

describe("updateLocaleSettings", () => {
    it("actualiza la organización del perfil con valores soportados", async () => {
        const result = await updateLocaleSettings({
            currency_code: "USD",
            locale: "en-US",
            country_code: "US",
        })

        expect(result.success).toBe(true)
        expect(mockOrgUpdate).toHaveBeenCalledWith({
            currency_code: "USD",
            locale: "en-US",
            country_code: "US",
        })
        expect(mockOrgUpdateEq).toHaveBeenCalledWith("id", "org-456")
    })

    it("rechaza una moneda no soportada sin tocar la base", async () => {
        const result = await updateLocaleSettings({
            // EUR no está en Fase 1 — el CHECK constraint tampoco lo permitiría
            currency_code: "EUR",
            locale: "es-CO",
            country_code: "CO",
        } as unknown as Parameters<typeof updateLocaleSettings>[0])

        expect(result.success).toBe(false)
        expect(mockOrgUpdate).not.toHaveBeenCalled()
    })

    it("falla sin sesión y no toca la base", async () => {
        mockAuthGetUser.mockResolvedValue({ data: { user: null } })

        const result = await updateLocaleSettings({
            currency_code: "COP",
            locale: "es-CO",
            country_code: "CO",
        })

        expect(result.success).toBe(false)
        expect(mockOrgUpdate).not.toHaveBeenCalled()
    })

    it("falla si el perfil no tiene organización", async () => {
        mockProfilesSingle.mockResolvedValue({ data: null, error: null })

        const result = await updateLocaleSettings({
            currency_code: "COP",
            locale: "es-CO",
            country_code: "CO",
        })

        expect(result.success).toBe(false)
        expect(mockOrgUpdate).not.toHaveBeenCalled()
    })
})
