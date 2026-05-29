/**
 * Test de regresión (hotfix v1.16.3) — `reconcileOrderPaymentFromGateway`
 * ahora acepta y reenvía un `providerTransactionId` (x_ref_payco de ePayco)
 * al reconciliador.
 *
 * Contexto: ePayco no permite consultar transacciones por factura; necesita
 * el x_ref_payco interno. Cuando la conciliación automática falla porque no
 * hay x_ref_payco en webhook_logs, el merchant puede pegarlo manualmente desde
 * el dashboard de ePayco. Esta server action es el puente: debe forwardear ese
 * ref (trimmeado) para que el reconciliador use getTransaction(x_ref_payco) en
 * lugar de getTransactionByReference (que lanza el error del screenshot).
 *
 * RED antes del fix: la firma ignora el 2º arg → reconcileOrderPayment se llama
 * sin providerTransactionId. GREEN después: se llama con el ref trimmeado.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthGetUser = vi.fn()
const mockProfilesSingle = vi.fn()
const mockProfilesEq = vi.fn()
const mockProfilesSelect = vi.fn()
const mockClientFrom = vi.fn()
const mockReconcile = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockAuthGetUser },
        from: mockClientFrom,
    })),
    createServiceClient: vi.fn(() => ({ from: vi.fn() })),
}))

vi.mock("@/lib/payments/epayco-reconciliation", () => ({
    reconcileOrderPayment: (...args: unknown[]) => mockReconcile(...args),
}))

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}))

interface ReconcileState {
    userId?: string | null
    profileOrgId?: string | null
    reconcileResult?: Record<string, unknown>
}

function setupMocks(state: ReconcileState = {}) {
    vi.clearAllMocks()

    const userId = state.userId === undefined ? "user-123" : state.userId
    const profileOrgId = state.profileOrgId === undefined ? "org-456" : state.profileOrgId

    mockAuthGetUser.mockResolvedValue({ data: { user: userId ? { id: userId } : null } })

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

    mockReconcile.mockResolvedValue(
        state.reconcileResult ?? {
            reconciled: true,
            provider: "epayco",
            status: "approved",
            orderUpdated: true,
            transactionUpdated: true,
            sideEffectsRan: true,
        },
    )
}

describe("reconcileOrderPaymentFromGateway — forwarding de x_ref_payco (hotfix v1.16.3)", () => {
    beforeEach(() => setupMocks())

    it("reenvía el providerTransactionId trimmeado al reconciliador", async () => {
        setupMocks()
        const { reconcileOrderPaymentFromGateway } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        await reconcileOrderPaymentFromGateway("order-1", "  9876543  ")

        expect(mockReconcile).toHaveBeenCalledTimes(1)
        expect(mockReconcile).toHaveBeenCalledWith({
            organizationId: "org-456",
            orderId: "order-1",
            providerTransactionId: "9876543",
        })
    })

    it("pasa providerTransactionId undefined cuando se omite (Wompi/auto)", async () => {
        setupMocks()
        const { reconcileOrderPaymentFromGateway } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        await reconcileOrderPaymentFromGateway("order-1")

        expect(mockReconcile).toHaveBeenCalledWith({
            organizationId: "org-456",
            orderId: "order-1",
            providerTransactionId: undefined,
        })
    })

    it("trata un ref en blanco como undefined (no reintenta con ref vacío)", async () => {
        setupMocks()
        const { reconcileOrderPaymentFromGateway } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        await reconcileOrderPaymentFromGateway("order-1", "   ")

        expect(mockReconcile).toHaveBeenCalledWith({
            organizationId: "org-456",
            orderId: "order-1",
            providerTransactionId: undefined,
        })
    })

    it("retorna success cuando el reconciliador concilia", async () => {
        setupMocks()
        const { reconcileOrderPaymentFromGateway } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        const result = await reconcileOrderPaymentFromGateway("order-1", "9876543")
        expect(result.success).toBe(true)
        expect(result.provider).toBe("epayco")
    })

    it("retorna failure con el error de ePayco cuando no concilia", async () => {
        setupMocks({
            reconcileResult: {
                reconciled: false,
                reason: "provider_lookup_failed",
                error: "ePayco no permite consultar transacciones por factura. Necesita el x_ref_payco interno (lo entrega el webhook automático o el dashboard ePayco)",
            },
        })
        const { reconcileOrderPaymentFromGateway } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        const result = await reconcileOrderPaymentFromGateway("order-1")
        expect(result.success).toBe(false)
        expect(result.error).toContain("ePayco no permite")
    })

    it("lanza Unauthorized sin usuario autenticado", async () => {
        setupMocks({ userId: null })
        const { reconcileOrderPaymentFromGateway } = await import(
            "@/app/dashboard/orders/[id]/actions"
        )
        await expect(reconcileOrderPaymentFromGateway("order-1")).rejects.toThrow("Unauthorized")
    })
})
