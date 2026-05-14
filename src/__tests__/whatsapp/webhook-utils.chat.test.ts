/**
 * Tests focales de findOrCreateChat - persistencia de whatsapp_jid (v1.12.7).
 *
 * Contexto: el v1.12.5 limpio el sufijo @lid del remoteJid antes de guardar
 * el chat. Eso arreglo los comandos del operador (matching), pero rompio
 * el envio: Evolution API necesita el JID completo para entregar mensajes
 * a contactos con Linked ID. El v1.12.7 introduce la columna
 * `chats.whatsapp_jid` que persiste el JID original con su sufijo, y el
 * sender lo prefiere sobre `phone_number` para construir el destinatario.
 *
 * Estos tests verifican que findOrCreateChat:
 *   - Persiste el remoteJid en whatsapp_jid al crear chat nuevo.
 *   - Reconstruye heuristicamente el JID si el caller no pasa remoteJid.
 *   - Pobla whatsapp_jid en chats existentes legacy que aun no lo tienen.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { findOrCreateChat } from "@/lib/whatsapp/webhook-utils"

interface ExistingChat {
    id: string
    whatsapp_jid: string | null
}

function buildSupabaseMock(existingChat: ExistingChat | null) {
    const updateCall = vi.fn().mockResolvedValue({ data: null, error: null })
    const insertCall = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
                data: { id: "new-chat-id" },
                error: null,
            }),
        }),
    })
    const rpcCall = vi.fn().mockResolvedValue({ data: null, error: null })

    const fromCall = vi.fn().mockImplementation((table: string) => {
        if (table !== "chats") throw new Error(`Unexpected table: ${table}`)

        return {
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            gte: vi.fn().mockReturnValue({
                                order: vi.fn().mockReturnValue({
                                    limit: vi.fn().mockReturnValue({
                                        single: vi.fn().mockResolvedValue({
                                            data: existingChat,
                                            error: existingChat ? null : { code: "PGRST116" },
                                        }),
                                    }),
                                }),
                            }),
                        }),
                    }),
                }),
            }),
            update: vi.fn().mockImplementation((updates: Record<string, string>) => {
                updateCall(updates)
                return {
                    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
                }
            }),
            insert: vi.fn().mockImplementation((row: Record<string, unknown>) => {
                insertCall(row)
                return {
                    select: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                            data: { id: "new-chat-id" },
                            error: null,
                        }),
                    }),
                }
            }),
        }
    })

    return {
        supabase: {
            from: fromCall,
            rpc: rpcCall,
        },
        updateCall,
        insertCall,
    }
}

describe("findOrCreateChat - persistencia de whatsapp_jid (v1.12.7)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe("chat nuevo: persiste el remoteJid original", () => {
        it("Linked ID @lid -> insert con whatsapp_jid completo", async () => {
            const { supabase, insertCall } = buildSupabaseMock(null)

            await findOrCreateChat(
                supabase as never,
                "org-1",
                "customer-1",
                "65820390633601",
                "65820390633601@lid",
            )

            expect(insertCall).toHaveBeenCalledWith(
                expect.objectContaining({
                    phone_number: "65820390633601",
                    whatsapp_jid: "65820390633601@lid",
                }),
            )
        })

        it("MSISDN clasico @s.whatsapp.net -> insert con whatsapp_jid completo", async () => {
            const { supabase, insertCall } = buildSupabaseMock(null)

            await findOrCreateChat(
                supabase as never,
                "org-1",
                "customer-1",
                "573001234567",
                "573001234567@s.whatsapp.net",
            )

            expect(insertCall).toHaveBeenCalledWith(
                expect.objectContaining({
                    phone_number: "573001234567",
                    whatsapp_jid: "573001234567@s.whatsapp.net",
                }),
            )
        })

        it("sin remoteJid (caller legacy) -> reconstruye heuristicamente con buildWhatsAppJid", async () => {
            const { supabase, insertCall } = buildSupabaseMock(null)

            await findOrCreateChat(
                supabase as never,
                "org-1",
                "customer-1",
                "573001234567",
            )

            expect(insertCall).toHaveBeenCalledWith(
                expect.objectContaining({
                    phone_number: "573001234567",
                    whatsapp_jid: "573001234567@s.whatsapp.net",
                }),
            )
        })

        it("sin remoteJid + phone opaco (>=14 digitos) -> reconstruye como @lid", async () => {
            const { supabase, insertCall } = buildSupabaseMock(null)

            await findOrCreateChat(
                supabase as never,
                "org-1",
                "customer-1",
                "65820390633601",
            )

            expect(insertCall).toHaveBeenCalledWith(
                expect.objectContaining({
                    phone_number: "65820390633601",
                    whatsapp_jid: "65820390633601@lid",
                }),
            )
        })
    })

    describe("chat existente sin whatsapp_jid: backfill on-the-fly", () => {
        it("legacy sin whatsapp_jid + remoteJid disponible -> update lo pobla", async () => {
            const { supabase, updateCall } = buildSupabaseMock({
                id: "existing-chat-id",
                whatsapp_jid: null,
            })

            await findOrCreateChat(
                supabase as never,
                "org-1",
                "customer-1",
                "65820390633601",
                "65820390633601@lid",
            )

            expect(updateCall).toHaveBeenCalledWith(
                expect.objectContaining({
                    whatsapp_jid: "65820390633601@lid",
                }),
            )
        })

        it("legacy con whatsapp_jid ya poblado -> NO sobrescribe", async () => {
            const { supabase, updateCall } = buildSupabaseMock({
                id: "existing-chat-id",
                whatsapp_jid: "65820390633601@lid",
            })

            await findOrCreateChat(
                supabase as never,
                "org-1",
                "customer-1",
                "65820390633601",
                "65820390633601@lid",
            )

            // El update se llama solo para refrescar updated_at, no whatsapp_jid
            for (const call of updateCall.mock.calls) {
                expect(call[0]).not.toHaveProperty("whatsapp_jid")
            }
        })
    })
})
