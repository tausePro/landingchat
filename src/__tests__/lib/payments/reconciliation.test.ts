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
