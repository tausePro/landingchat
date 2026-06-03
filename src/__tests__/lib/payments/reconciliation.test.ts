/**
 * Tests del core de reconciliación de pagos (Slice 1 — Bold end-to-end).
 *
 * Cubren la generalización registry-driven del provider (Gap A) y la
 * validación de monto por provider (Gap D). Se enfocan en las funciones puras
 * extraídas para evitar mocks frágiles del cliente Supabase; el flujo completo
 * del reconcile se valida en smoke prod cuando Bold tenga credenciales.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: vi.fn(),
}))

import {
    resolveReconcilableProvider,
    getProviderTransaction,
} from "@/lib/payments/epayco-reconciliation"
import { requiresAmountValidation } from "@/lib/payments/webhook-processor"
import type { PaymentGateway, TransactionDetails } from "@/lib/payments/types"

function makeGatewayMock(overrides: Partial<PaymentGateway>): PaymentGateway {
    return {
        getTransaction: vi.fn(),
        getTransactionByReference: vi.fn(),
        ...overrides,
    } as unknown as PaymentGateway
}

const FAKE_TX = {
    providerTransactionId: "LNK_123",
    reference: "order-1",
    status: "approved",
    amount: 50000,
    currency: "COP",
} as unknown as TransactionDetails

beforeEach(() => {
    vi.clearAllMocks()
})

describe("resolveReconcilableProvider (Gap A — registry-driven)", () => {
    it("acepta los providers habilitados: wompi, epayco, bold", () => {
        expect(resolveReconcilableProvider("wompi")).toBe("wompi")
        expect(resolveReconcilableProvider("epayco")).toBe("epayco")
        expect(resolveReconcilableProvider("bold")).toBe("bold")
    })

    it("rechaza un provider deshabilitado (addi stub) → null", () => {
        expect(resolveReconcilableProvider("addi")).toBeNull()
    })

    it("rechaza provider desconocido / vacío / nulo → null", () => {
        expect(resolveReconcilableProvider("mercadopago")).toBeNull()
        expect(resolveReconcilableProvider("")).toBeNull()
        expect(resolveReconcilableProvider(null)).toBeNull()
        expect(resolveReconcilableProvider(undefined)).toBeNull()
    })
})

describe("getProviderTransaction (Gap A — usa el id cuando es usable)", () => {
    it("Bold con LNK_x usable → usa getTransaction(LNK_x), NO by-reference", async () => {
        const getTransaction = vi.fn().mockResolvedValue(FAKE_TX)
        const getTransactionByReference = vi.fn().mockResolvedValue(FAKE_TX)
        const gateway = makeGatewayMock({ getTransaction, getTransactionByReference })

        await getProviderTransaction({
            gateway,
            provider: "bold",
            orderId: "order-1",
            providerTransactionId: "LNK_x",
        })

        expect(getTransaction).toHaveBeenCalledWith("LNK_x")
        expect(getTransactionByReference).not.toHaveBeenCalled()
    })

    it("wompi sin id usable → usa getTransactionByReference(orderId)", async () => {
        const getTransaction = vi.fn().mockResolvedValue(FAKE_TX)
        const getTransactionByReference = vi.fn().mockResolvedValue(FAKE_TX)
        const gateway = makeGatewayMock({ getTransaction, getTransactionByReference })

        await getProviderTransaction({
            gateway,
            provider: "wompi",
            orderId: "order-1",
            providerTransactionId: null,
        })

        expect(getTransactionByReference).toHaveBeenCalledWith("order-1")
        expect(getTransaction).not.toHaveBeenCalled()
    })

    it("REGRESIÓN Wompi (qp): con provider_transaction_id usable IGNORA el id y consulta por reference", async () => {
        // Escenario real (qp): el cliente reintentó el pago. El primer intento quedó
        // guardado como provider_transaction_id (status declined); el segundo intento
        // (approved) comparte la MISMA reference=orderId. Wompi debe resolverse SIEMPRE
        // por reference para traer el intento aprobado, no por el id del intento viejo.
        // Antes de v1.17.0 Wompi siempre consultaba por reference; la generalización
        // registry-driven (Gap A) lo rompió al consultar por id. Este test fija el
        // contrato: la estrategia de conciliación es metadata del provider (registry).
        const declinedById = { ...FAKE_TX, providerTransactionId: "wompi-old-attempt", status: "declined" } as unknown as TransactionDetails
        const approvedByReference = { ...FAKE_TX, providerTransactionId: "wompi-paid-attempt", status: "approved" } as unknown as TransactionDetails
        const getTransaction = vi.fn().mockResolvedValue(declinedById)
        const getTransactionByReference = vi.fn().mockResolvedValue(approvedByReference)
        const gateway = makeGatewayMock({ getTransaction, getTransactionByReference })

        const tx = await getProviderTransaction({
            gateway,
            provider: "wompi",
            orderId: "order-1",
            providerTransactionId: "wompi-old-attempt",
        })

        expect(getTransactionByReference).toHaveBeenCalledWith("order-1")
        expect(getTransaction).not.toHaveBeenCalled()
        expect(tx.status).toBe("approved")
    })

    it("id === orderId no se considera usable → cae a by-reference", async () => {
        const getTransaction = vi.fn().mockResolvedValue(FAKE_TX)
        const getTransactionByReference = vi.fn().mockResolvedValue(FAKE_TX)
        const gateway = makeGatewayMock({ getTransaction, getTransactionByReference })

        await getProviderTransaction({
            gateway,
            provider: "epayco",
            orderId: "order-1",
            providerTransactionId: "order-1",
        })

        expect(getTransactionByReference).toHaveBeenCalledWith("order-1")
        expect(getTransaction).not.toHaveBeenCalled()
    })

    it("sin id usable y by-reference no soportado (Bold) → propaga el error", async () => {
        const getTransactionByReference = vi.fn().mockRejectedValue(new Error("not supported"))
        const gateway = makeGatewayMock({ getTransactionByReference })

        await expect(
            getProviderTransaction({
                gateway,
                provider: "bold",
                orderId: "order-1",
                providerTransactionId: null,
            }),
        ).rejects.toThrow("not supported")
    })
})

describe("requiresAmountValidation (Gap D)", () => {
    it("epayco y bold requieren validación de monto/moneda", () => {
        expect(requiresAmountValidation("epayco")).toBe(true)
        expect(requiresAmountValidation("bold")).toBe(true)
    })

    it("wompi y addi no la requieren (wompi valida en el core; addi es stub)", () => {
        expect(requiresAmountValidation("wompi")).toBe(false)
        expect(requiresAmountValidation("addi")).toBe(false)
    })
})
