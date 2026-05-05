import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import crypto from "node:crypto"
import {
    hashData,
    normalizeMetaPhone,
    prepareUserData,
    sendMetaCapiEvent,
    type MetaCapiEventData,
    type UserData,
} from "@/lib/analytics/meta-conversions-api"

function sha256(value: string) {
    return crypto.createHash("sha256").update(value.toLowerCase().trim()).digest("hex")
}

describe("meta-conversions-api", () => {
    describe("hashData", () => {
        it("hashea SHA256 lowercased y trimmed", () => {
            expect(hashData("Foo@Bar.com ")).toBe(sha256("foo@bar.com"))
            expect(hashData("  HELLO  ")).toBe(sha256("hello"))
        })
    })

    describe("normalizeMetaPhone (Colombia)", () => {
        it("agrega prefijo 57 a celulares CO de 10 dígitos que empiezan con 3", () => {
            expect(normalizeMetaPhone("3001234567")).toBe("573001234567")
            expect(normalizeMetaPhone("(300) 123-4567")).toBe("573001234567")
        })

        it("respeta números que ya tienen prefijo 57", () => {
            expect(normalizeMetaPhone("573001234567")).toBe("573001234567")
        })

        it("solo limpia dígitos cuando no aplica regla CO", () => {
            expect(normalizeMetaPhone("12345")).toBe("12345")
            expect(normalizeMetaPhone("+1 (415) 555-0100")).toBe("14155550100")
        })
    })

    describe("prepareUserData", () => {
        it("hashea email, phone, firstName, lastName, city, state, externalId", () => {
            const data: UserData = {
                email: "Test@Example.com",
                phone: "3001234567",
                firstName: "Juan",
                lastName: "Pérez",
                city: "Bogotá",
                state: "Cundinamarca",
                externalId: "order-123",
            }

            const prepared = prepareUserData(data)

            expect(prepared.em).toBe(sha256("test@example.com"))
            expect(prepared.ph).toBe(sha256("573001234567"))
            expect(prepared.fn).toBe(sha256("juan"))
            expect(prepared.ln).toBe(sha256("pérez"))
            expect(prepared.ct).toBe(sha256("bogotá"))
            expect(prepared.st).toBe(sha256("cundinamarca"))
            expect(prepared.external_id).toBe(sha256("order-123"))
        })

        it("normaliza country a ISO-2 lowercase antes de hashear (CO mayúsculas)", () => {
            const prepared = prepareUserData({ country: "CO" })
            expect(prepared.country).toBe(sha256("co"))
        })

        it("normaliza country a ISO-2 lowercase antes de hashear (nombre completo)", () => {
            const prepared = prepareUserData({ country: "Colombia" })
            expect(prepared.country).toBe(sha256("co"))
        })

        it("normaliza country a ISO-2 lowercase antes de hashear (ya lowercase)", () => {
            const prepared = prepareUserData({ country: "co" })
            expect(prepared.country).toBe(sha256("co"))
        })

        it("NO hashea fbc, fbp, client_ip_address ni client_user_agent", () => {
            const data: UserData = {
                fbc: "fb.1.1700000000.AbCdEf",
                fbp: "fb.1.1700000000.999",
                clientIpAddress: "190.85.10.20",
                clientUserAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)",
            }

            const prepared = prepareUserData(data)

            expect(prepared.fbc).toBe("fb.1.1700000000.AbCdEf")
            expect(prepared.fbp).toBe("fb.1.1700000000.999")
            expect(prepared.client_ip_address).toBe("190.85.10.20")
            expect(prepared.client_user_agent).toBe("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")
        })

        it("omite campos undefined sin contaminar el matching", () => {
            const prepared = prepareUserData({
                email: "test@example.com",
            })

            expect(prepared.em).toBeDefined()
            expect(prepared.ph).toBeUndefined()
            expect(prepared.fn).toBeUndefined()
            expect(prepared.country).toBeUndefined()
            expect(prepared.fbc).toBeUndefined()
            expect(prepared.client_ip_address).toBeUndefined()
        })
    })

    describe("sendMetaCapiEvent", () => {
        const originalFetch = globalThis.fetch
        let fetchMock: ReturnType<typeof vi.fn>

        beforeEach(() => {
            fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ events_received: 1, fbtrace_id: "abc" }),
            })
            globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
        })

        afterEach(() => {
            globalThis.fetch = originalFetch
        })

        it("usa Graph API v24.0 contra el endpoint /events del pixel", async () => {
            const result = await sendMetaCapiEvent(
                { pixelId: "123456789", accessToken: "token" },
                buildPurchaseEventData(),
            )

            expect(result.success).toBe(true)
            expect(fetchMock).toHaveBeenCalledTimes(1)
            const url = fetchMock.mock.calls[0][0] as string
            expect(url).toContain("https://graph.facebook.com/v24.0/123456789/events")
            expect(url).toContain("access_token=token")
        })

        it("envía eventId estable y datos hasheados/no hasheados según especificación de Meta", async () => {
            await sendMetaCapiEvent(
                { pixelId: "123456789", accessToken: "token" },
                buildPurchaseEventData(),
            )

            const init = fetchMock.mock.calls[0][1] as RequestInit
            const body = JSON.parse(init.body as string) as {
                data: Array<{
                    event_name: string
                    event_id: string
                    event_time: number
                    action_source: string
                    user_data: Record<string, string>
                    custom_data: Record<string, unknown>
                }>
            }
            const event = body.data[0]

            expect(event.event_name).toBe("Purchase")
            expect(event.event_id).toBe("purchase_order-uuid-1")
            expect(event.action_source).toBe("website")

            // Hasheados
            expect(event.user_data.em).toBe(sha256("buyer@example.com"))
            expect(event.user_data.ph).toBe(sha256("573001234567"))
            expect(event.user_data.country).toBe(sha256("co"))
            expect(event.user_data.external_id).toBe(sha256("order-uuid-1"))

            // NO hasheados
            expect(event.user_data.client_ip_address).toBe("190.85.10.20")
            expect(event.user_data.client_user_agent).toBe("Mozilla/5.0")
            expect(event.user_data.fbc).toBe("fb.1.1700000000.AbCdEf")
            expect(event.user_data.fbp).toBe("fb.1.1700000000.999")

            // Custom data Purchase
            expect(event.custom_data.currency).toBe("COP")
            expect(event.custom_data.value).toBe(150000)
            expect(event.custom_data.order_id).toBe("ORD-123")
        })

        it("retorna error sin fetch si falta pixelId o accessToken", async () => {
            const result = await sendMetaCapiEvent(
                { pixelId: "", accessToken: "" },
                buildPurchaseEventData(),
            )
            expect(result.success).toBe(false)
            expect(fetchMock).not.toHaveBeenCalled()
        })
    })
})

function buildPurchaseEventData(): MetaCapiEventData {
    return {
        eventName: "Purchase",
        eventId: "purchase_order-uuid-1",
        eventTime: 1700000123,
        eventSourceUrl: "https://tienda.example.com/order/order-uuid-1",
        userData: {
            email: "buyer@example.com",
            phone: "3001234567",
            firstName: "Juan",
            lastName: "Pérez",
            city: "Bogotá",
            state: "Cundinamarca",
            country: "CO",
            externalId: "order-uuid-1",
            fbc: "fb.1.1700000000.AbCdEf",
            fbp: "fb.1.1700000000.999",
            clientIpAddress: "190.85.10.20",
            clientUserAgent: "Mozilla/5.0",
        },
        customData: {
            currency: "COP",
            value: 150000,
            contentIds: ["prod-1"],
            contents: [{ id: "prod-1", quantity: 1, item_price: 150000 }],
            contentType: "product",
            orderId: "ORD-123",
            numItems: 1,
        },
    }
}
