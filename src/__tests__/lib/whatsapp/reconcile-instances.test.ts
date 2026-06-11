/**
 * Tests de reconcileEvolutionInstances (Platform Notifier v0 — T0).
 *
 * Caso real: server Evolution con 6 instancias, tabla whatsapp_instances
 * vacía. La reconciliación crea filas por convención org_<uuid> o match
 * de slug; lo irresoluble se reporta sin tocar DB; idempotente.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const ORG_CASA = "b592ff18-e678-462c-8bc0-ea38982c4889"
const ORG_TEZ = "7781cb03-271c-4b27-a23c-72b25632dd2b"

let serverInstances: Array<{ name: string; status: string; number: string | null }>
let existingRows: Array<Record<string, unknown>>
const inserts: Array<Record<string, unknown>> = []
const updates: Array<Record<string, unknown>> = []

vi.mock("@/lib/evolution", () => ({
    createEvolutionClient: vi.fn(async () => ({
        listInstances: vi.fn(async () => serverInstances),
    })),
}))

vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: vi.fn(() => ({
        from: (table: string) => {
            const chain: Record<string, unknown> = {}
            chain.select = vi.fn(() => chain)
            chain.eq = vi.fn(() => chain)
            chain.then = (resolve: (value: unknown) => void) => {
                if (table === "organizations") {
                    resolve({ data: [
                        { id: ORG_CASA, slug: "casainmobiliaria" },
                        { id: ORG_TEZ, slug: "tez" },
                    ] })
                } else {
                    resolve({ data: existingRows })
                }
            }
            chain.insert = vi.fn(async (payload: Record<string, unknown>) => {
                inserts.push(payload)
                return { error: null }
            })
            chain.update = vi.fn((payload: Record<string, unknown>) => ({
                eq: vi.fn(async () => {
                    updates.push(payload)
                    return { error: null }
                }),
            }))
            return chain
        },
    })),
    createClient: vi.fn(),
}))

import { reconcileEvolutionInstances } from "@/lib/whatsapp/reconcileInstances"

beforeEach(() => {
    vi.clearAllMocks()
    inserts.length = 0
    updates.length = 0
    existingRows = []
    serverInstances = [
        { name: `org_${ORG_CASA}`, status: "open", number: "573137809134" },
        { name: "tez", status: "close", number: "573174335074" },
        { name: "ali", status: "close", number: "573173637315" },
    ]
})

describe("reconcileEvolutionInstances", () => {
    it("crea filas por org_<uuid> y por slug; lo irresoluble queda en unmatched", async () => {
        const result = await reconcileEvolutionInstances()

        expect(result.created).toBe(2)
        expect(result.unmatched).toEqual(["ali"])
        expect(result.errors).toEqual([])

        const casa = inserts.find((row) => row.organization_id === ORG_CASA)
        expect(casa).toMatchObject({
            instance_name: `org_${ORG_CASA}`,
            instance_type: "corporate",
            provider: "evolution",
            status: "connected",
            phone_number: "573137809134",
            phone_number_display: "****9134",
        })
        expect(casa?.connected_at).toBeTruthy()

        const tez = inserts.find((row) => row.organization_id === ORG_TEZ)
        expect(tez).toMatchObject({ status: "disconnected", instance_name: "tez" })
    })

    it("mapea estados: open→connected, connecting→connecting, close→disconnected", async () => {
        serverInstances = [
            { name: `org_${ORG_CASA}`, status: "connecting", number: null },
        ]
        await reconcileEvolutionInstances()
        expect(inserts[0]).toMatchObject({ status: "connecting", phone_number: null })
    })

    it("idempotente: segunda corrida sin cambios → 0 created, 0 updated", async () => {
        existingRows = [
            { id: "w1", organization_id: ORG_CASA, instance_name: `org_${ORG_CASA}`, instance_type: "corporate", status: "connected", phone_number: "573137809134" },
            { id: "w2", organization_id: ORG_TEZ, instance_name: "tez", instance_type: "corporate", status: "disconnected", phone_number: "573174335074" },
        ]

        const result = await reconcileEvolutionInstances()

        expect(result.created).toBe(0)
        expect(result.updated).toBe(0)
        expect(result.unchanged).toBe(2)
        expect(inserts).toEqual([])
    })

    it("actualiza el estado cuando cambió en el server (close → open)", async () => {
        existingRows = [
            { id: "w2", organization_id: ORG_TEZ, instance_name: "tez", instance_type: "corporate", status: "disconnected", phone_number: "573174335074" },
        ]
        serverInstances = [{ name: "tez", status: "open", number: "573174335074" }]

        const result = await reconcileEvolutionInstances()

        expect(result.updated).toBe(1)
        expect(updates[0]).toMatchObject({ status: "connected" })
        expect(updates[0].connected_at).toBeTruthy()
    })

    it("conflicto UNIQUE: org con corporate existente de otro nombre no duplica", async () => {
        existingRows = [
            { id: "w9", organization_id: ORG_TEZ, instance_name: "tez-vieja", instance_type: "corporate", status: "disconnected", phone_number: null },
        ]
        serverInstances = [{ name: "tez", status: "open", number: "573174335074" }]

        const result = await reconcileEvolutionInstances()

        expect(result.created).toBe(0)
        expect(result.errors[0]).toContain("conflicto")
        expect(inserts).toEqual([])
    })

    it("la instancia platform_notifications se ignora", async () => {
        serverInstances = [{ name: "platform_notifications", status: "open", number: "573000000000" }]

        const result = await reconcileEvolutionInstances()

        expect(result.created).toBe(0)
        expect(result.unmatched).toEqual([])
    })
})
