import { describe, expect, it } from "vitest"
import { applyConversationCreditPayment } from "@/lib/payments/conversation-credit-payment"
import type { WompiTransactionStatus } from "@/lib/wompi/types"

// =============================================================================
// Acreditación de packs de créditos (billing-critical). Verifica el flujo
// idempotente: aprobado → acredita una vez; ya acreditado / claim perdido → no
// duplica; declinado → marca estado sin acreditar; RPC falla → revierte + 500.
// =============================================================================

interface Purchase {
    id: string
    organization_id: string
    credit_amount: number
    credited_at: string | null
}

function makeSupabase(opts: {
    purchase: Purchase | null
    purchaseError?: boolean
    claimResult?: { id: string } | null
    creditError?: { message: string } | null
}) {
    const updates: Array<Record<string, unknown>> = []
    const rpcCalls: Array<{ fn: string; args: unknown }> = []

    const client = {
        from() {
            return {
                select() {
                    return {
                        eq() {
                            return {
                                maybeSingle: () =>
                                    Promise.resolve({
                                        data: opts.purchase,
                                        error: opts.purchaseError ? { message: "db error" } : null,
                                    }),
                            }
                        },
                    }
                },
                update(vals: Record<string, unknown>) {
                    updates.push(vals)
                    const eqResult = {
                        // Awaited directamente (update de estado / revert)
                        then: <T>(resolve: (v: { error: null }) => T) =>
                            Promise.resolve({ error: null as null }).then(resolve),
                        // Cadena del claim atómico
                        is() {
                            return {
                                select() {
                                    return {
                                        maybeSingle: () =>
                                            Promise.resolve({ data: opts.claimResult ?? null, error: null }),
                                    }
                                },
                            }
                        },
                    }
                    return { eq: () => eqResult }
                },
            }
        },
        rpc(fn: string, args: unknown) {
            rpcCalls.push({ fn, args })
            return Promise.resolve({ error: opts.creditError ?? null })
        },
    }

    return { client, updates, rpcCalls }
}

type SupabaseArg = Parameters<typeof applyConversationCreditPayment>[0]

const tx = (status: WompiTransactionStatus, reference = "credits_abc") => ({
    id: "wompi-tx-1",
    status,
    reference,
})

describe("applyConversationCreditPayment", () => {
    it("404 si la compra no existe", async () => {
        const { client, rpcCalls } = makeSupabase({ purchase: null })
        const r = await applyConversationCreditPayment(client as unknown as SupabaseArg, tx("APPROVED"))
        expect(r.httpStatus).toBe(404)
        expect(rpcCalls).toEqual([])
    })

    it("aprobado: acredita una vez y devuelve 200 con el monto", async () => {
        const { client, rpcCalls } = makeSupabase({
            purchase: { id: "p1", organization_id: "org-1", credit_amount: 500, credited_at: null },
            claimResult: { id: "p1" },
        })
        const r = await applyConversationCreditPayment(client as unknown as SupabaseArg, tx("APPROVED"))
        expect(r.httpStatus).toBe(200)
        expect(r.body).toMatchObject({ received: true, credited: 500 })
        expect(rpcCalls).toEqual([
            { fn: "add_conversation_credits", args: { org_id: "org-1", amount: 500 } },
        ])
    })

    it("idempotente: si ya está acreditado, no vuelve a acreditar", async () => {
        const { client, rpcCalls } = makeSupabase({
            purchase: { id: "p1", organization_id: "org-1", credit_amount: 500, credited_at: "2026-06-17T00:00:00Z" },
        })
        const r = await applyConversationCreditPayment(client as unknown as SupabaseArg, tx("APPROVED"))
        expect(r.httpStatus).toBe(200)
        expect(r.body).toMatchObject({ alreadyCredited: true })
        expect(rpcCalls).toEqual([])
    })

    it("claim perdido (otro webhook ganó): no duplica", async () => {
        const { client, rpcCalls } = makeSupabase({
            purchase: { id: "p1", organization_id: "org-1", credit_amount: 500, credited_at: null },
            claimResult: null,
        })
        const r = await applyConversationCreditPayment(client as unknown as SupabaseArg, tx("APPROVED"))
        expect(r.httpStatus).toBe(200)
        expect(r.body).toMatchObject({ alreadyCredited: true })
        expect(rpcCalls).toEqual([])
    })

    it("declinado: marca estado sin acreditar", async () => {
        const { client, rpcCalls, updates } = makeSupabase({
            purchase: { id: "p1", organization_id: "org-1", credit_amount: 500, credited_at: null },
        })
        const r = await applyConversationCreditPayment(client as unknown as SupabaseArg, tx("DECLINED"))
        expect(r.httpStatus).toBe(200)
        expect(rpcCalls).toEqual([])
        expect(updates.some((u) => u.status === "declined")).toBe(true)
    })

    it("si el RPC de acreditación falla, revierte el claim y devuelve 500", async () => {
        const { client, rpcCalls, updates } = makeSupabase({
            purchase: { id: "p1", organization_id: "org-1", credit_amount: 500, credited_at: null },
            claimResult: { id: "p1" },
            creditError: { message: "rpc boom" },
        })
        const r = await applyConversationCreditPayment(client as unknown as SupabaseArg, tx("APPROVED"))
        expect(r.httpStatus).toBe(500)
        expect(rpcCalls.length).toBe(1)
        // revert: deja credited_at en null y estado error
        expect(updates.some((u) => u.status === "error" && u.credited_at === null)).toBe(true)
    })
})
