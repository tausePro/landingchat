/**
 * Tests de `markOrderAsPaid` (T1.6 — confirmación manual de pago desde dashboard).
 *
 * Cubre:
 *   - Permisos: usuario no autenticado → "Unauthorized".
 *   - Permisos: sin organization → "No organization found".
 *   - Orden no encontrada → error.
 *   - Idempotencia UX: orden ya `payment_status='paid'` → error.
 *   - Happy path manual: crea store_transactions con currency del tenant
 *     (no COP hardcoded), persiste audit columns (`payment_confirmed_at/_by/_note`)
 *     en `orders`, invoca `applyPaymentStatusToOrder`.
 *   - Note opcional: se trim/cap y se guarda en `payment_confirmation_note` +
 *     `store_transactions.provider_response.note`.
 *   - Currency dinámica: tenant USD (Tantor) usa USD en store_transactions,
 *     tenant COP (Quality Pets) usa COP, tenant sin currency_code cae a COP.
 *
 * NO testeamos `applyPaymentStatusToOrder` aquí (esa lógica vive en
 * `@/lib/payments/payment-confirmation.ts` y se cubre con sus propios tests
 * y se valida indirectamente en webhooks Wompi/ePayco).
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// --- Mocks ------------------------------------------------------------------

const mockAuthGetUser = vi.fn()
const mockProfilesSelect = vi.fn()
const mockProfilesEq = vi.fn()
const mockProfilesSingle = vi.fn()
const mockClientFrom = vi.fn()

const mockOrdersSelect = vi.fn()
const mockOrdersSelectEq1 = vi.fn()
const mockOrdersSelectEq2 = vi.fn()
const mockOrdersSelectMaybeSingle = vi.fn()

const mockOrgSelect = vi.fn()
const mockOrgSelectEq = vi.fn()
const mockOrgSelectSingle = vi.fn()

const mockTransSelect = vi.fn()
const mockTransSelectEq1 = vi.fn()
const mockTransSelectEq2 = vi.fn()
const mockTransSelectOrder = vi.fn()
const mockTransSelectLimit = vi.fn()
const mockTransSelectMaybeSingle = vi.fn()

const mockTransInsert = vi.fn()
const mockTransUpdate = vi.fn()
const mockTransUpdateEq = vi.fn()

const mockOrdersUpdate = vi.fn()
const mockOrdersUpdateEq1 = vi.fn()
const mockOrdersUpdateEq2 = vi.fn()

const mockServiceFrom = vi.fn()

const mockApplyPaymentStatus = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockAuthGetUser },
        from: mockClientFrom,
    })),
    createServiceClient: vi.fn(() => ({
        from: mockServiceFrom,
    })),
}))

vi.mock("@/lib/payments/payment-confirmation", () => ({
    applyPaymentStatusToOrder: (...args: unknown[]) => mockApplyPaymentStatus(...args),
}))

vi.mock("@/lib/payments/epayco-reconciliation", () => ({
    reconcileOrderPayment: vi.fn(),
}))

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}))

// --- Setup default state ----------------------------------------------------

interface MockState {
    userId?: string
    profileOrgId?: string | null
    order?: {
        id: string
        organization_id: string
        total: number
        payment_method: string
        payment_status: string
        customer_id: string | null
    } | null
    orderError?: { message: string } | null
    orgCurrencyCode?: string | null
    existingTransaction?: { id: string; status: string } | null
    applyResult?: { success: boolean; sideEffectsRan: boolean; error?: string }
}

function setupMocks(state: MockState = {}) {
    vi.clearAllMocks()

    const userId = state.userId ?? "user-123"
    const profileOrgId = state.profileOrgId === undefined ? "org-456" : state.profileOrgId

    // Auth
    mockAuthGetUser.mockResolvedValue({ data: { user: userId ? { id: userId } : null } })

    // Profile lookup (uses createClient, not service)
    mockProfilesSingle.mockResolvedValue({
        data: profileOrgId ? { organization_id: profileOrgId } : null,
        error: null,
    })
    mockProfilesEq.mockReturnValue({ single: mockProfilesSingle })
    mockProfilesSelect.mockReturnValue({ eq: mockProfilesEq })

    mockClientFrom.mockImplementation((table: string) => {
        if (table === "profiles") return { select: mockProfilesSelect }
        throw new Error(`Unexpected createClient table: ${table}`)
    })

    // Orders SELECT (service client)
    mockOrdersSelectMaybeSingle.mockResolvedValue({
        data: state.order === undefined ? {
            id: "order-1",
            organization_id: profileOrgId,
            total: 100000,
            payment_method: "manual",
            payment_status: "pending",
            customer_id: "cust-1",
        } : state.order,
        error: state.orderError ?? null,
    })
    mockOrdersSelectEq2.mockReturnValue({ maybeSingle: mockOrdersSelectMaybeSingle })
    mockOrdersSelectEq1.mockReturnValue({ eq: mockOrdersSelectEq2 })
    mockOrdersSelect.mockReturnValue({ eq: mockOrdersSelectEq1 })

    // Organizations SELECT (service client)
    mockOrgSelectSingle.mockResolvedValue({
        data: { currency_code: state.orgCurrencyCode === undefined ? "COP" : state.orgCurrencyCode },
        error: null,
    })
    mockOrgSelectEq.mockReturnValue({ single: mockOrgSelectSingle })
    mockOrgSelect.mockReturnValue({ eq: mockOrgSelectEq })

    // Existing transaction SELECT chain
    mockTransSelectMaybeSingle.mockResolvedValue({
        data: state.existingTransaction === undefined ? null : state.existingTransaction,
        error: null,
    })
    mockTransSelectLimit.mockReturnValue({ maybeSingle: mockTransSelectMaybeSingle })
    mockTransSelectOrder.mockReturnValue({ limit: mockTransSelectLimit })
    mockTransSelectEq2.mockReturnValue({ order: mockTransSelectOrder })
    mockTransSelectEq1.mockReturnValue({ eq: mockTransSelectEq2 })
    mockTransSelect.mockReturnValue({ eq: mockTransSelectEq1 })

    // Transaction INSERT/UPDATE
    mockTransInsert.mockResolvedValue({ error: null })
    mockTransUpdateEq.mockResolvedValue({ error: null })
    mockTransUpdate.mockReturnValue({ eq: mockTransUpdateEq })

    // Orders UPDATE (audit columns)
    mockOrdersUpdateEq2.mockResolvedValue({ error: null })
    mockOrdersUpdateEq1.mockReturnValue({ eq: mockOrdersUpdateEq2 })
    mockOrdersUpdate.mockReturnValue({ eq: mockOrdersUpdateEq1 })

    mockServiceFrom.mockImplementation((table: string) => {
        if (table === "orders") {
            return {
                select: mockOrdersSelect,
                update: mockOrdersUpdate,
            }
        }
        if (table === "organizations") return { select: mockOrgSelect }
        if (table === "store_transactions") {
            return {
                select: mockTransSelect,
                insert: mockTransInsert,
                update: mockTransUpdate,
            }
        }
        throw new Error(`Unexpected serviceClient table: ${table}`)
    })

    mockApplyPaymentStatus.mockResolvedValue(state.applyResult ?? {
        success: true,
        sideEffectsRan: true,
    })
}

// --- Tests ------------------------------------------------------------------

describe("markOrderAsPaid — permisos", () => {
    beforeEach(() => setupMocks())

    it("throws Unauthorized si no hay usuario autenticado", async () => {
        setupMocks()
        // Override directo: simulamos un getUser() sin user (logout / sesión expirada).
        mockAuthGetUser.mockResolvedValue({ data: { user: null } })
        const { markOrderAsPaid } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        await expect(markOrderAsPaid("order-1")).rejects.toThrow("Unauthorized")
    })

    it("throws si el usuario no tiene organization", async () => {
        setupMocks({ profileOrgId: null })
        const { markOrderAsPaid } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        await expect(markOrderAsPaid("order-1")).rejects.toThrow("No organization found")
    })
})

describe("markOrderAsPaid — validaciones de orden", () => {
    it("throws si la orden no existe (anti cross-tenant)", async () => {
        setupMocks({ order: null })
        const { markOrderAsPaid } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        await expect(markOrderAsPaid("order-nope")).rejects.toThrow(
            "Orden no encontrada o no tienes permisos para actualizarla",
        )
    })

    it("throws si la orden ya está paid (idempotencia UX)", async () => {
        setupMocks({
            order: {
                id: "order-1",
                organization_id: "org-456",
                total: 100000,
                payment_method: "manual",
                payment_status: "paid",
                customer_id: "cust-1",
            },
        })
        const { markOrderAsPaid } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        await expect(markOrderAsPaid("order-1")).rejects.toThrow(
            "La orden ya está marcada como pagada",
        )
    })
})

describe("markOrderAsPaid — happy path manual", () => {
    beforeEach(() => setupMocks())

    it("crea store_transactions con currency del tenant (no COP hardcoded)", async () => {
        setupMocks({ orgCurrencyCode: "USD" })
        const { markOrderAsPaid } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        await markOrderAsPaid("order-1")

        expect(mockTransInsert).toHaveBeenCalledTimes(1)
        const inserted = mockTransInsert.mock.calls[0][0]
        expect(inserted.currency).toBe("USD")
        expect(inserted.amount).toBe(100000 * 100) // total * 100 a cents
        expect(inserted.status).toBe("approved")
        expect(inserted.provider).toBe("manual")
        expect(inserted.payment_method).toBe("manual")
        expect(inserted.provider_response).toMatchObject({
            source: "dashboard_manual_confirmation",
            confirmed_by: "user-123",
        })
    })

    it("guarda payment_confirmed_at/_by/_note en orders (audit columns)", async () => {
        setupMocks()
        const { markOrderAsPaid } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        await markOrderAsPaid("order-1", "Transferencia verificada en WhatsApp")

        expect(mockOrdersUpdate).toHaveBeenCalledTimes(1)
        const auditPayload = mockOrdersUpdate.mock.calls[0][0]
        expect(auditPayload.payment_confirmed_at).toMatch(/\d{4}-\d{2}-\d{2}T/)
        expect(auditPayload.payment_confirmed_by).toBe("user-123")
        expect(auditPayload.payment_confirmation_note).toBe(
            "Transferencia verificada en WhatsApp",
        )
        expect(auditPayload.updated_at).toMatch(/\d{4}-\d{2}-\d{2}T/)
    })

    it("invoca applyPaymentStatusToOrder con transactionStatus='approved'", async () => {
        setupMocks()
        const { markOrderAsPaid } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        await markOrderAsPaid("order-1")

        expect(mockApplyPaymentStatus).toHaveBeenCalledTimes(1)
        const args = mockApplyPaymentStatus.mock.calls[0][0]
        expect(args.organizationId).toBe("org-456")
        expect(args.orderId).toBe("order-1")
        expect(args.transactionStatus).toBe("approved")
        expect(args.source).toBe("dashboard_manual_confirmation")
    })

    it("retorna success + sideEffectsRan del applyPaymentStatusToOrder", async () => {
        setupMocks({ applyResult: { success: true, sideEffectsRan: true } })
        const { markOrderAsPaid } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        const result = await markOrderAsPaid("order-1")
        expect(result).toEqual({ success: true, sideEffectsRan: true })
    })
})

describe("markOrderAsPaid — note opcional", () => {
    it("trimea y guarda la nota (<=1000 chars)", async () => {
        setupMocks()
        const { markOrderAsPaid } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        await markOrderAsPaid("order-1", "   Hola con espacios   ")

        const auditPayload = mockOrdersUpdate.mock.calls[0][0]
        expect(auditPayload.payment_confirmation_note).toBe("Hola con espacios")

        const inserted = mockTransInsert.mock.calls[0][0]
        expect(inserted.provider_response.note).toBe("Hola con espacios")
    })

    it("aplica hard cap de 1000 chars en la nota", async () => {
        setupMocks()
        const longNote = "a".repeat(1500)
        const { markOrderAsPaid } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        await markOrderAsPaid("order-1", longNote)

        const auditPayload = mockOrdersUpdate.mock.calls[0][0]
        expect(auditPayload.payment_confirmation_note).toHaveLength(1000)
    })

    it("guarda null en payment_confirmation_note si la nota viene vacía o blanco", async () => {
        setupMocks()
        const { markOrderAsPaid } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        await markOrderAsPaid("order-1", "   ")

        const auditPayload = mockOrdersUpdate.mock.calls[0][0]
        expect(auditPayload.payment_confirmation_note).toBeNull()

        const inserted = mockTransInsert.mock.calls[0][0]
        // No incluye `note` en provider_response cuando la nota es blanco
        expect(inserted.provider_response.note).toBeUndefined()
    })

    it("guarda null si no se pasa note", async () => {
        setupMocks()
        const { markOrderAsPaid } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        await markOrderAsPaid("order-1")

        const auditPayload = mockOrdersUpdate.mock.calls[0][0]
        expect(auditPayload.payment_confirmation_note).toBeNull()
    })
})

describe("markOrderAsPaid — currency dinámica (T1.6)", () => {
    it("usa USD para tenants con currency_code='USD' (Tantor)", async () => {
        setupMocks({ orgCurrencyCode: "USD" })
        const { markOrderAsPaid } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        await markOrderAsPaid("order-1")
        expect(mockTransInsert.mock.calls[0][0].currency).toBe("USD")
    })

    it("usa COP para tenants con currency_code='COP' (Quality Pets, Tez)", async () => {
        setupMocks({ orgCurrencyCode: "COP" })
        const { markOrderAsPaid } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        await markOrderAsPaid("order-1")
        expect(mockTransInsert.mock.calls[0][0].currency).toBe("COP")
    })

    it("cae a COP si la organization no tiene currency_code (legacy)", async () => {
        setupMocks({ orgCurrencyCode: null })
        const { markOrderAsPaid } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        await markOrderAsPaid("order-1")
        expect(mockTransInsert.mock.calls[0][0].currency).toBe("COP")
    })
})

describe("markOrderAsPaid — transaction reuse", () => {
    it("actualiza la transaction existente en lugar de crear una nueva", async () => {
        setupMocks({
            existingTransaction: { id: "tx-existing-1", status: "pending" },
        })
        const { markOrderAsPaid } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        await markOrderAsPaid("order-1", "Note de update")

        expect(mockTransInsert).not.toHaveBeenCalled()
        expect(mockTransUpdate).toHaveBeenCalledTimes(1)
        const updatePayload = mockTransUpdate.mock.calls[0][0]
        expect(updatePayload.status).toBe("approved")
        expect(updatePayload.provider_response).toMatchObject({
            source: "dashboard_manual_confirmation",
            confirmed_by: "user-123",
            previous_status: "pending",
            note: "Note de update",
        })
    })
})

describe("confirmOrderPayment — alias legacy", () => {
    it("invoca markOrderAsPaid sin note", async () => {
        setupMocks()
        const { confirmOrderPayment } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        const result = await confirmOrderPayment("order-1")

        expect(result).toEqual({ success: true, sideEffectsRan: true })

        // Confirmamos que el path es el mismo: audit columns escritas sin note
        const auditPayload = mockOrdersUpdate.mock.calls[0][0]
        expect(auditPayload.payment_confirmation_note).toBeNull()
    })
})
