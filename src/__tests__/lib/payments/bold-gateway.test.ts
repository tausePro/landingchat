/**
 * Tests de regresión para BoldGateway (API Link de pagos).
 *
 * Cubren los bugs corregidos en el hotfix v1.19.1:
 *   - Host SIEMPRE producción (Bold link de pagos no tiene host sandbox).
 *   - testConnection() consulta el endpoint correcto /online/link/v1/payment_methods.
 *   - createTransaction() envía `reference` top-level (no dentro de `metadata`).
 *   - parseWebhook() extrae la reference de `data.metadata.reference` y valida la firma.
 *
 * Docs: https://developers.bold.co/pagos-en-linea/api-link-de-pagos + /webhook
 */

import { describe, it, expect, vi, afterEach } from "vitest"
import crypto from "crypto"
import { BoldGateway } from "@/lib/payments/bold-gateway"
import type { GatewayConfig, TransactionInput } from "@/lib/payments/types"

const PROD_HOST = "https://integrations.api.bold.co"

// isTestMode: true es deliberado — confirma que el host sigue siendo producción.
const baseConfig: GatewayConfig = {
    provider: "bold",
    publicKey: "",
    privateKey: "identity-key-123",
    integritySecret: "secret-456",
    isTestMode: true,
}

function makeFetchMock() {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    return fetchMock
}

describe("BoldGateway", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    describe("testConnection", () => {
        it("consulta /online/link/v1/payment_methods en el host de producción aunque isTestMode=true", async () => {
            const fetchMock = makeFetchMock()
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ payload: { payment_methods: {} }, errors: [] }),
            })

            const gateway = new BoldGateway(baseConfig)
            const result = await gateway.testConnection()

            expect(result).toBe(true)
            expect(fetchMock).toHaveBeenCalledTimes(1)
            const [url, options] = fetchMock.mock.calls[0]
            expect(url).toBe(`${PROD_HOST}/online/link/v1/payment_methods`)
            expect((options.headers as Record<string, string>).Authorization).toBe(
                "x-api-key identity-key-123",
            )
        })

        it("retorna false cuando el endpoint responde no-ok", async () => {
            const fetchMock = makeFetchMock()
            fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
            const gateway = new BoldGateway(baseConfig)
            expect(await gateway.testConnection()).toBe(false)
        })

        it("retorna false si fetch lanza", async () => {
            const fetchMock = makeFetchMock()
            fetchMock.mockRejectedValueOnce(new Error("network"))
            const gateway = new BoldGateway(baseConfig)
            expect(await gateway.testConnection()).toBe(false)
        })
    })

    describe("createTransaction", () => {
        const input: TransactionInput = {
            amount: 1_000_000, // centavos -> 10000 pesos
            currency: "COP",
            reference: "ORD-20251021-00145",
            paymentMethod: "card",
            customerEmail: "cliente@example.com",
            customerName: "Juan Perez",
            redirectUrl: "https://tienda.example.com/return",
        }

        it("envía reference top-level (no en metadata), POST al host de producción y monto en pesos enteros", async () => {
            const fetchMock = makeFetchMock()
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    payload: { payment_link: "LNK_123", url: "https://checkout.bold.co/LNK_123" },
                    errors: [],
                }),
            })

            const gateway = new BoldGateway(baseConfig)
            const result = await gateway.createTransaction(input)

            expect(result.success).toBe(true)
            expect(result.redirectUrl).toBe("https://checkout.bold.co/LNK_123")
            expect(result.providerTransactionId).toBe("LNK_123")

            const [url, options] = fetchMock.mock.calls[0]
            expect(url).toBe(`${PROD_HOST}/online/link/v1`)
            expect(options.method).toBe("POST")

            const body = JSON.parse(options.body as string)
            expect(body.reference).toBe("ORD-20251021-00145") // top-level
            expect(body.metadata).toBeUndefined() // NO en metadata
            expect(body.amount.total_amount).toBe(10000) // pesos enteros, no centavos
            expect(body.amount.currency).toBe("COP")
            expect(body.amount_type).toBe("CLOSE")
        })

        it("devuelve error cuando Bold responde con errors", async () => {
            const fetchMock = makeFetchMock()
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({ errors: [{ code: "X", message: "monto invalido" }] }),
            })
            const gateway = new BoldGateway(baseConfig)
            const result = await gateway.createTransaction(input)
            expect(result.success).toBe(false)
            expect(result.status).toBe("error")
        })
    })

    describe("parseWebhook", () => {
        function signedRequest(payload: unknown, secret: string, signatureOverride?: string) {
            const rawBody = JSON.stringify(payload)
            const signature =
                signatureOverride ??
                crypto
                    .createHmac("sha256", secret)
                    .update(Buffer.from(rawBody, "utf8").toString("base64"))
                    .digest("hex")
            return new Request("https://app.example.com/api/webhooks/payments/bold?org=tez", {
                method: "POST",
                headers: { "x-bold-signature": signature, "content-type": "application/json" },
                body: rawBody,
            })
        }

        it("valida firma y extrae reference de data.metadata.reference (payload real de link de pagos)", async () => {
            const gateway = new BoldGateway(baseConfig)
            // Payload real de la doc (Tarjeta Web, source /payments/links)
            const payload = {
                id: "a9c1d0f5-3b7e-4d2a-9f6c-8e4b5d2f0a1b",
                type: "SALE_APPROVED",
                subject: "CNPCGSPS2WBA8",
                source: "/payments/links",
                data: {
                    payment_id: "CNPCGSPS2WBA8",
                    amount: { currency: "COP", total: 59900 },
                    metadata: { reference: "WEB-ORD-009876" },
                    payment_method: "CARD_WEB",
                },
            }

            const result = await gateway.parseWebhook(
                signedRequest(payload, baseConfig.integritySecret as string),
            )

            expect(result.isValid).toBe(true)
            expect(result.event?.reference).toBe("WEB-ORD-009876")
            expect(result.event?.transactionId).toBe("CNPCGSPS2WBA8")
            expect(result.event?.status).toBe("approved")
            expect(result.event?.amount).toBe(5_990_000) // 59900 pesos -> centavos
        })

        it("rechaza firma inválida con httpStatus 401", async () => {
            const gateway = new BoldGateway(baseConfig)
            const payload = { type: "SALE_APPROVED", data: { payment_id: "X", metadata: { reference: "R" } } }
            const result = await gateway.parseWebhook(
                signedRequest(payload, baseConfig.integritySecret as string, "deadbeef"),
            )
            expect(result.isValid).toBe(false)
            expect(result.httpStatus).toBe(401)
        })
    })
})
