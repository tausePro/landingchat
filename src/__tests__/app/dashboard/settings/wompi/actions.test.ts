/**
 * Tests de regresión para `saveWompiConfig`.
 *
 * Bug histórico (hotfix v1.11.56):
 *   El UI del form de Wompi settings promete "Secreto de Integridad (opcional —
 *   deja vacío para mantener)" y lo mismo para Secreto de Eventos. Pero el
 *   server convertía esos campos vacíos en `null` y los sobreescribía en DB vía
 *   upsert, borrando configuraciones válidas previas. Después del fix, los
 *   campos solo se incluyen en el upsert cuando vienen con valor; si llegan
 *   vacíos, se omiten y el valor previo en DB se preserva.
 *
 * Además validamos los prefijos de las llaves para evitar el error clásico de
 * pegar el secret de Eventos donde va el de Integridad (o viceversa).
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// --- Mocks ------------------------------------------------------------------

const mockUpsert = vi.fn()
const mockSelectAfterUpsert = vi.fn()
const mockSingleAfterUpsert = vi.fn()

const mockOrgSelect = vi.fn()
const mockOrgEq = vi.fn()
const mockOrgSingle = vi.fn()

const mockProfilesSelect = vi.fn()
const mockProfilesEq = vi.fn()
const mockProfilesSingle = vi.fn()

const mockAuthGetUser = vi.fn()

const mockFrom = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockAuthGetUser },
        from: mockFrom,
    })),
}))

vi.mock("@/lib/utils/encryption", () => ({
    encrypt: vi.fn((value: string) => `enc:${value}`),
    decrypt: vi.fn((value: string) => value.replace(/^enc:/, "")),
}))

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}))

beforeEach(() => {
    vi.clearAllMocks()

    // Auth: usuario válido.
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } })

    // Profile: organización resuelta.
    mockProfilesSingle.mockResolvedValue({
        data: { organization_id: "org-456" },
        error: null,
    })
    mockProfilesEq.mockReturnValue({ single: mockProfilesSingle })
    mockProfilesSelect.mockReturnValue({ eq: mockProfilesEq })

    // Organization: slug para webhook URL.
    mockOrgSingle.mockResolvedValue({
        data: { slug: "tenant-slug" },
        error: null,
    })
    mockOrgEq.mockReturnValue({ single: mockOrgSingle })
    mockOrgSelect.mockReturnValue({ eq: mockOrgEq })

    // payment_gateway_configs.upsert(...).select().single()
    mockSingleAfterUpsert.mockResolvedValue({ data: { id: "config-1" }, error: null })
    mockSelectAfterUpsert.mockReturnValue({ single: mockSingleAfterUpsert })
    mockUpsert.mockReturnValue({ select: mockSelectAfterUpsert })

    mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") return { select: mockProfilesSelect }
        if (table === "organizations") return { select: mockOrgSelect }
        if (table === "payment_gateway_configs") return { upsert: mockUpsert }
        throw new Error(`Unexpected table in mock: ${table}`)
    })

    process.env.NEXT_PUBLIC_APP_URL = "https://landingchat.co"
})

// --- Helpers ----------------------------------------------------------------

interface SaveWompiConfigInput {
    provider: "wompi"
    is_active: boolean
    is_test_mode: boolean
    public_key: string
    private_key: string
    integrity_secret: string
    events_secret?: string
}

function baseInput(overrides: Partial<SaveWompiConfigInput> = {}): SaveWompiConfigInput {
    return {
        provider: "wompi",
        is_active: true,
        is_test_mode: true,
        public_key: "pub_test_xxx",
        private_key: "prv_test_xxx",
        integrity_secret: "test_integrity_xxx",
        events_secret: "test_events_xxx",
        ...overrides,
    }
}

function getUpsertPayload() {
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    return mockUpsert.mock.calls[0][0] as Record<string, unknown>
}

// --- Tests ------------------------------------------------------------------

describe("saveWompiConfig — preservación de secretos cuando input vacío (hotfix v1.11.56)", () => {
    it("NO incluye `integrity_secret_encrypted` en el upsert cuando integrity_secret llega vacío", async () => {
        const { saveWompiConfig } = await import("@/app/dashboard/settings/wompi/actions")

        const result = await saveWompiConfig(baseInput({ integrity_secret: "" }))

        expect(result.success).toBe(true)
        const payload = getUpsertPayload()
        expect(payload).not.toHaveProperty("integrity_secret_encrypted")
        // Pero los demás campos sí están presentes.
        expect(payload).toHaveProperty("private_key_encrypted", "enc:prv_test_xxx")
        expect(payload).toHaveProperty("events_secret_encrypted", "enc:test_events_xxx")
        expect(payload).toHaveProperty("public_key", "pub_test_xxx")
    })

    it("NO incluye `events_secret_encrypted` en el upsert cuando events_secret llega vacío", async () => {
        const { saveWompiConfig } = await import("@/app/dashboard/settings/wompi/actions")

        const result = await saveWompiConfig(baseInput({ events_secret: "" }))

        expect(result.success).toBe(true)
        const payload = getUpsertPayload()
        expect(payload).not.toHaveProperty("events_secret_encrypted")
        expect(payload).toHaveProperty("integrity_secret_encrypted", "enc:test_integrity_xxx")
    })

    it("NO incluye ningún secreto en el upsert cuando ambos vienen vacíos", async () => {
        const { saveWompiConfig } = await import("@/app/dashboard/settings/wompi/actions")

        const result = await saveWompiConfig(
            baseInput({ integrity_secret: "", events_secret: "" })
        )

        expect(result.success).toBe(true)
        const payload = getUpsertPayload()
        expect(payload).not.toHaveProperty("integrity_secret_encrypted")
        expect(payload).not.toHaveProperty("events_secret_encrypted")
        // private_key sigue siendo obligatoria.
        expect(payload).toHaveProperty("private_key_encrypted", "enc:prv_test_xxx")
    })

    it("incluye los secretos encriptados cuando vienen con valor", async () => {
        const { saveWompiConfig } = await import("@/app/dashboard/settings/wompi/actions")

        const result = await saveWompiConfig(baseInput())

        expect(result.success).toBe(true)
        const payload = getUpsertPayload()
        expect(payload).toHaveProperty("integrity_secret_encrypted", "enc:test_integrity_xxx")
        expect(payload).toHaveProperty("events_secret_encrypted", "enc:test_events_xxx")
    })
})

describe("saveWompiConfig — validación de prefijos (defensive UX)", () => {
    it("rechaza un Secreto de Integridad con prefijo `test_events_` (error clásico)", async () => {
        const { saveWompiConfig } = await import("@/app/dashboard/settings/wompi/actions")

        const result = await saveWompiConfig(
            baseInput({ integrity_secret: "test_events_xxx" })
        )

        expect(result.success).toBe(false)
        expect(mockUpsert).not.toHaveBeenCalled()
        if (!result.success) {
            expect(result.error).toMatch(/Integridad/i)
            expect(result.error).toMatch(/test_integrity_/)
        }
    })

    it("rechaza un Secreto de Eventos con prefijo `test_integrity_`", async () => {
        const { saveWompiConfig } = await import("@/app/dashboard/settings/wompi/actions")

        const result = await saveWompiConfig(
            baseInput({ events_secret: "test_integrity_xxx" })
        )

        expect(result.success).toBe(false)
        expect(mockUpsert).not.toHaveBeenCalled()
        if (!result.success) {
            expect(result.error).toMatch(/Eventos/i)
        }
    })

    it("rechaza una llave privada con prefijo incorrecto", async () => {
        const { saveWompiConfig } = await import("@/app/dashboard/settings/wompi/actions")

        const result = await saveWompiConfig(
            baseInput({ private_key: "pub_test_xxx" })
        )

        expect(result.success).toBe(false)
        expect(mockUpsert).not.toHaveBeenCalled()
        if (!result.success) {
            expect(result.error).toMatch(/llave privada/i)
        }
    })

    it("rechaza incoherencia entre `is_test_mode=true` y llave pública de producción", async () => {
        const { saveWompiConfig } = await import("@/app/dashboard/settings/wompi/actions")

        const result = await saveWompiConfig(
            baseInput({
                is_test_mode: true,
                public_key: "pub_prod_xxx",
                private_key: "prv_prod_xxx",
            })
        )

        expect(result.success).toBe(false)
        expect(mockUpsert).not.toHaveBeenCalled()
        if (!result.success) {
            expect(result.error).toMatch(/producción/i)
        }
    })

    it("acepta credenciales 100% sandbox cuando is_test_mode=true", async () => {
        const { saveWompiConfig } = await import("@/app/dashboard/settings/wompi/actions")

        const result = await saveWompiConfig(baseInput())

        expect(result.success).toBe(true)
        expect(mockUpsert).toHaveBeenCalledTimes(1)
    })

    it("acepta credenciales 100% producción cuando is_test_mode=false", async () => {
        const { saveWompiConfig } = await import("@/app/dashboard/settings/wompi/actions")

        const result = await saveWompiConfig(
            baseInput({
                is_test_mode: false,
                public_key: "pub_prod_xxx",
                private_key: "prv_prod_xxx",
                integrity_secret: "prod_integrity_xxx",
                events_secret: "prod_events_xxx",
            })
        )

        expect(result.success).toBe(true)
        expect(mockUpsert).toHaveBeenCalledTimes(1)
    })
})
