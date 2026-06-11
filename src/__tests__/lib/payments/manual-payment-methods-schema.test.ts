/**
 * Regresión del caso Zelle (2026-06-11): el merchant guardó la etiqueta
 * "Zelle" sin el correo de la cuenta y el checkout no mostraba nada
 * (requiere ambos). El schema ahora exige ambos-o-ninguno con mensaje claro.
 */

import { describe, expect, it } from "vitest"
import { ManualPaymentMethodsInputSchema } from "@/types/payment"

const BASE = {
    bank_transfer_enabled: true,
    bank_name: "Bank of America",
    account_number: "5514046994",
    cod_enabled: false,
    cod_additional_cost: 0,
    cod_zones: [],
}

describe("ManualPaymentMethodsInputSchema — pago instantáneo", () => {
    it("etiqueta sin valor (caso Zelle real) → rechazado con mensaje útil", () => {
        const result = ManualPaymentMethodsInputSchema.safeParse({
            ...BASE,
            instant_payment_label: "Zelle",
            instant_payment_value: "",
        })

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues[0].message).toContain("Zelle")
            expect(result.error.issues[0].path).toEqual(["instant_payment_value"])
        }
    })

    it("valor sin etiqueta → rechazado", () => {
        const result = ManualPaymentMethodsInputSchema.safeParse({
            ...BASE,
            instant_payment_label: "  ",
            instant_payment_value: "pagos@tantorshouse.com",
        })

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues[0].path).toEqual(["instant_payment_label"])
        }
    })

    it("ambos campos completos → válido", () => {
        const result = ManualPaymentMethodsInputSchema.safeParse({
            ...BASE,
            instant_payment_label: "Zelle",
            instant_payment_value: "pagos@tantorshouse.com",
        })

        expect(result.success).toBe(true)
    })

    it("ninguno de los dos → válido (método instantáneo simplemente no configurado)", () => {
        const result = ManualPaymentMethodsInputSchema.safeParse({
            ...BASE,
            instant_payment_label: "",
            instant_payment_value: "",
        })

        expect(result.success).toBe(true)
    })
})
