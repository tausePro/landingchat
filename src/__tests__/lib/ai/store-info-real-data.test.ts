/**
 * Regresión del caso Zelle en el chat (2026-06-11): `get_store_info` devolvía
 * métodos de pago hardcodeados ("Tarjeta, PSE, Efectivo") ajenos al tenant y
 * el agente de Tantor terminó inventando una plantilla de datos Zelle con
 * placeholders. Ahora el tool lee la config REAL (pasarelas activas, métodos
 * manuales, envíos, devoluciones) y trae instrucciones anti-invención.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { sharedToolHandlers } from "@/lib/ai/executors/shared"
import type { ToolContext, ToolSupabaseClient } from "@/lib/ai/executors/types"

let orgRow: Record<string, unknown>
let gatewayRows: Array<{ provider: string }>
let manualRow: Record<string, unknown> | null
let shippingRow: Record<string, unknown> | null

function buildSupabaseMock(): ToolSupabaseClient {
    function chain(table: string) {
        const self: Record<string, unknown> = {}
        for (const method of ["select", "eq", "order", "limit", "in", "gte", "lt"]) {
            self[method] = vi.fn(() => self)
        }
        self.single = vi.fn(async () => ({ data: table === "organizations" ? orgRow : null }))
        self.maybeSingle = vi.fn(async () => ({
            data: table === "manual_payment_methods" ? manualRow : table === "shipping_settings" ? shippingRow : null,
        }))
        self.then = (resolve: (value: unknown) => void) =>
            resolve({ data: table === "payment_gateway_configs" ? gatewayRows : [] })
        return self
    }
    return { from: (table: string) => chain(table) } as unknown as ToolSupabaseClient
}

const context = { organizationId: "org-tantor" } as ToolContext
const getStoreInfo = sharedToolHandlers.get_store_info

beforeEach(() => {
    orgRow = { name: "Tantors House", settings: {}, contact_email: "hi@tantors.com" }
    gatewayRows = []
    manualRow = null
    shippingRow = null
})

describe("get_store_info — payment_methods con datos reales", () => {
    it("Zelle completo (label + value) → aparece con la cuenta real", async () => {
        manualRow = {
            bank_transfer_enabled: true,
            bank_name: "Bank of America",
            account_type: "checking",
            account_number: "5514046994",
            account_holder: "Tantors Houses",
            instant_payment_label: "Zelle",
            instant_payment_value: "pagos@tantorshouse.com",
            nequi_number: null,
            instructions: null,
            cod_enabled: false,
            cod_additional_cost: 0,
        }

        const result = await getStoreInfo(buildSupabaseMock(), { topic: "payment_methods" }, context)
        const paymentMethods = (result.data as Record<string, unknown>).paymentMethods as {
            methods: Array<Record<string, unknown>>
            instructions: string
        }

        const transfer = paymentMethods.methods.find((method) => method.type === "bank_transfer")
        expect(transfer?.instant_payment).toEqual({ service: "Zelle", account: "pagos@tantorshouse.com" })
        expect(paymentMethods.instructions).toContain("NUNCA inventes")
    })

    it("Zelle incompleto (label sin value, caso Tantor) → NO se incluye y se instruye honestidad", async () => {
        manualRow = {
            bank_transfer_enabled: true,
            bank_name: "Bank of America",
            account_type: "checking",
            account_number: "5514046994",
            account_holder: "Tantors Houses",
            instant_payment_label: "Zelle",
            instant_payment_value: null,
            nequi_number: null,
            instructions: null,
            cod_enabled: false,
            cod_additional_cost: 0,
        }

        const result = await getStoreInfo(buildSupabaseMock(), { topic: "payment_methods" }, context)
        const paymentMethods = (result.data as Record<string, unknown>).paymentMethods as {
            methods: Array<Record<string, unknown>>
            instructions: string
        }

        const transfer = paymentMethods.methods.find((method) => method.type === "bank_transfer")
        expect(transfer?.instant_payment).toBeUndefined()
        // Pero la transferencia bancaria SÍ aparece con sus datos reales
        expect(transfer?.bank).toBe("Bank of America")
        expect(paymentMethods.instructions).toContain("no lo tienes configurado")
    })

    it("pasarelas activas aparecen con su nombre real (provider-display)", async () => {
        gatewayRows = [{ provider: "bold" }, { provider: "wompi" }]

        const result = await getStoreInfo(buildSupabaseMock(), { topic: "payment_methods" }, context)
        const paymentMethods = (result.data as Record<string, unknown>).paymentMethods as {
            methods: Array<Record<string, unknown>>
        }

        expect(paymentMethods.methods.map((method) => method.name)).toEqual(["Bold", "Wompi"])
    })

    it("nada configurado → configured false y prohibición explícita de inventar", async () => {
        const result = await getStoreInfo(buildSupabaseMock(), { topic: "payment_methods" }, context)
        const paymentMethods = (result.data as Record<string, unknown>).paymentMethods as {
            configured: boolean
            instructions: string
        }

        expect(paymentMethods.configured).toBe(false)
        expect(paymentMethods.instructions).toContain("NUNCA inventes")
    })
})

describe("get_store_info — returns y shipping con datos reales", () => {
    it("política de devoluciones configurada (v1.23.0) → datos reales", async () => {
        shippingRow = {
            returns_accepted: true,
            return_window_days: 5,
            return_fees: "customer",
        }

        const result = await getStoreInfo(buildSupabaseMock(), { topic: "returns" }, context)
        expect((result.data as Record<string, unknown>).returns).toMatchObject({
            accepted: true,
            window_days: 5,
            return_shipping_paid_by: "el cliente",
        })
    })

    it("sin config de envíos → no inventa tarifas ('3-5 días' hardcodeado eliminado)", async () => {
        const result = await getStoreInfo(buildSupabaseMock(), { topic: "shipping" }, context)
        const shipping = (result.data as Record<string, unknown>).shipping as Record<string, unknown>

        expect(shipping.configured).toBe(false)
        expect(JSON.stringify(shipping)).not.toContain("3-5")
    })
})
