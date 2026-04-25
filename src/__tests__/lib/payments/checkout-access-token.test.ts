import { describe, expect, it } from "vitest"
import crypto from "crypto"
import { EpaycoGateway } from "@/lib/payments/epayco-gateway"
import { WompiGateway } from "@/lib/payments/wompi-gateway"

const orderId = "order-123"
const accessToken = "signed-access-token"

function createEpaycoGateway() {
    return new EpaycoGateway({
        provider: "epayco",
        publicKey: "public-key",
        privateKey: "private-key",
        integritySecret: "customer-id",
        encryptionKey: "encryption-key",
        isTestMode: true,
    })
}

function createWompiGateway() {
    return new WompiGateway({
        provider: "wompi",
        publicKey: "public-key",
        privateKey: "private-key",
        integritySecret: "integrity-secret",
        isTestMode: true,
    })
}

describe("checkout access token propagation", () => {
    it("preserves access on checkout URLs for storefront paths", async () => {
        const redirectUrl = `https://landingchat.co/store/demo/order/${orderId}/success?access=${accessToken}`
        const gateways = [createEpaycoGateway(), createWompiGateway()]

        for (const gateway of gateways) {
            const result = await gateway.createTransaction({
                amount: 150000,
                currency: "COP",
                reference: orderId,
                paymentMethod: "card",
                customerEmail: "buyer@example.com",
                customerName: "Buyer Example",
                redirectUrl,
            })

            expect(result.success).toBe(true)
            expect(result.redirectUrl).toBeDefined()

            const checkoutUrl = new URL(result.redirectUrl!)
            expect(checkoutUrl.searchParams.get("access")).toBe(accessToken)
            expect(checkoutUrl.pathname).toMatch(new RegExp(`/store/demo/checkout/.+/${orderId}$`))
        }
    })

    it("preserves access on checkout URLs for custom domains", async () => {
        const redirectUrl = `https://demo.example.com/order/${orderId}/success?access=${accessToken}`
        const gateways = [createEpaycoGateway(), createWompiGateway()]

        for (const gateway of gateways) {
            const result = await gateway.createTransaction({
                amount: 150000,
                currency: "COP",
                reference: orderId,
                paymentMethod: "card",
                customerEmail: "buyer@example.com",
                customerName: "Buyer Example",
                redirectUrl,
            })

            expect(result.success).toBe(true)
            expect(result.redirectUrl).toBeDefined()

            const checkoutUrl = new URL(result.redirectUrl!)
            expect(checkoutUrl.host).toBe("demo.example.com")
            expect(checkoutUrl.searchParams.get("access")).toBe(accessToken)
            expect(checkoutUrl.pathname).toMatch(new RegExp(`/checkout/.+/${orderId}$`))
        }
    })
})

describe("ePayco signature validation", () => {
    it("validates x_signature with P_CUST_ID_CLIENTE and P_KEY separated by caret", () => {
        const gateway = createEpaycoGateway()
        const payload = {
            x_ref_payco: "ref-payco-123",
            x_transaction_id: "transaction-123",
            x_amount: "25000.00",
            x_currency_code: "COP",
        }
        const signature = crypto
            .createHash("sha256")
            .update([
                "customer-id",
                "private-key",
                payload.x_ref_payco,
                payload.x_transaction_id,
                payload.x_amount,
                payload.x_currency_code,
            ].join("^"))
            .digest("hex")

        expect(gateway.validateWebhookSignature(payload, signature)).toBe(true)
    })
})
