import crypto from "crypto"
import { describe, expect, it } from "vitest"
import { WompiGateway } from "@/lib/payments/wompi-gateway"

function createWompiGateway() {
    return new WompiGateway({
        provider: "wompi",
        publicKey: "public-key",
        privateKey: "private-key",
        integritySecret: "integrity-secret",
        isTestMode: true,
    })
}

describe("Wompi signature validation", () => {
    it("accepts uppercase event checksums", () => {
        const gateway = createWompiGateway()
        const timestamp = 1530291411
        const payload = {
            data: {
                transaction: {
                    id: "1234-1610641025-49201",
                    status: "APPROVED",
                    amount_in_cents: 4490000,
                },
            },
            signature: {
                properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
                checksum: crypto
                    .createHash("sha256")
                    .update("1234-1610641025-49201APPROVED44900001530291411integrity-secret")
                    .digest("hex")
                    .toUpperCase(),
            },
            timestamp,
        }

        expect(gateway.validateWebhookSignature(payload, "")).toBe(true)
    })
})
