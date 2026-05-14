/**
 * Tests focales de findOrCreateCustomer.
 *
 * Foco principal (v1.12.6): garantizar que clientes con nombre auto-generado
 * por el sistema ("WhatsApp 3601", "WhatsApp @lid") se actualizan al
 * pushName real cuando WhatsApp empieza a enviarlo en mensajes siguientes.
 *
 * Contexto: pregunta de Casa Inmobiliaria 2026-05-14 sobre si el agente
 * puede saludar a los clientes por su nombre. El sistema ya lo hace, pero
 * los customers "atascados" con nombre generico (porque su pushName llego
 * vacio la primera vez) nunca se autocorregian. Este slice arregla ese
 * gap usando el patron AUTO_GENERATED_NAME_PATTERN.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { findOrCreateCustomer } from "@/lib/whatsapp/webhook-utils"

// Factory helper para construir un mock de Supabase con un flujo predecible
// para findOrCreateCustomer: select + (update | insert).
function buildSupabaseMock(existingCustomer: { id: string; full_name: string | null; phone: string } | null) {
    const updateCall = vi.fn().mockResolvedValue({ data: null, error: null })
    const insertCall = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
                data: { id: "new-customer-id", full_name: "Nuevo", phone: "573001234567" },
                error: null,
            }),
        }),
    })

    const fromCall = vi.fn().mockImplementation((table: string) => {
        if (table !== "customers") throw new Error(`Unexpected table: ${table}`)

        return {
            // Select chain (busqueda inicial)
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    in: vi.fn().mockReturnValue({
                        order: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue({
                                data: existingCustomer ? [existingCustomer] : [],
                                error: null,
                            }),
                        }),
                    }),
                }),
            }),
            // Update chain
            update: vi.fn().mockImplementation((updates: Record<string, string>) => {
                updateCall(updates)
                return {
                    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
                }
            }),
            // Insert chain
            insert: insertCall,
        }
    })

    return {
        supabase: { from: fromCall },
        updateCall,
        insertCall,
    }
}

describe("findOrCreateCustomer - auto-update de nombre generico (v1.12.6)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe("actualiza nombres auto-generados cuando llega pushName real", () => {
        it("'WhatsApp 3601' + pushName 'Felipe' -> actualiza a Felipe", async () => {
            const { supabase, updateCall } = buildSupabaseMock({
                id: "c1",
                full_name: "WhatsApp 3601",
                phone: "573001233601",
            })

            await findOrCreateCustomer(supabase as never, "org-1", "573001233601", "Felipe")

            expect(updateCall).toHaveBeenCalledWith(
                expect.objectContaining({ full_name: "Felipe" }),
            )
        })

        it("'WhatsApp @lid' + pushName 'Maria' -> actualiza a Maria (legacy chats pre-fix v1.12.5)", async () => {
            const { supabase, updateCall } = buildSupabaseMock({
                id: "c1",
                full_name: "WhatsApp @lid",
                phone: "573001234567",
            })

            await findOrCreateCustomer(supabase as never, "org-1", "573001234567", "Maria")

            expect(updateCall).toHaveBeenCalledWith(
                expect.objectContaining({ full_name: "Maria" }),
            )
        })

        it("full_name=null + pushName 'Felipe' -> actualiza a Felipe", async () => {
            const { supabase, updateCall } = buildSupabaseMock({
                id: "c1",
                full_name: null,
                phone: "573001234567",
            })

            await findOrCreateCustomer(supabase as never, "org-1", "573001234567", "Felipe")

            expect(updateCall).toHaveBeenCalledWith(
                expect.objectContaining({ full_name: "Felipe" }),
            )
        })
    })

    describe("NO sobrescribe nombres reales del cliente", () => {
        it("'Felipe Garcia' + pushName 'Felipe' -> NO actualiza nombre", async () => {
            const { supabase, updateCall } = buildSupabaseMock({
                id: "c1",
                full_name: "Felipe Garcia",
                phone: "573001234567",
            })

            await findOrCreateCustomer(supabase as never, "org-1", "573001234567", "Felipe")

            // Si hubo update, no debe incluir full_name
            for (const call of updateCall.mock.calls) {
                expect(call[0]).not.toHaveProperty("full_name")
            }
        })

        it("'Felipe' (nombre corto pero real) + pushName 'Felipe G' -> NO actualiza", async () => {
            // "Felipe" no matchea el patron auto-generado (no empieza con "WhatsApp ")
            const { supabase, updateCall } = buildSupabaseMock({
                id: "c1",
                full_name: "Felipe",
                phone: "573001234567",
            })

            await findOrCreateCustomer(supabase as never, "org-1", "573001234567", "Felipe G")

            for (const call of updateCall.mock.calls) {
                expect(call[0]).not.toHaveProperty("full_name")
            }
        })

        it("'WhatsApp Pro Service' (nombre humano largo) + pushName -> NO actualiza", async () => {
            // El patron exige exactamente 4 caracteres despues de "WhatsApp ".
            // "Pro Service" tiene espacios y mas de 4 chars -> no matchea.
            const { supabase, updateCall } = buildSupabaseMock({
                id: "c1",
                full_name: "WhatsApp Pro Service",
                phone: "573001234567",
            })

            await findOrCreateCustomer(supabase as never, "org-1", "573001234567", "Felipe")

            for (const call of updateCall.mock.calls) {
                expect(call[0]).not.toHaveProperty("full_name")
            }
        })
    })

    describe("NO actualiza si no llega pushName", () => {
        it("'WhatsApp 3601' + pushName undefined -> NO toca el nombre", async () => {
            const { supabase, updateCall } = buildSupabaseMock({
                id: "c1",
                full_name: "WhatsApp 3601",
                phone: "573001234567",
            })

            await findOrCreateCustomer(supabase as never, "org-1", "573001234567", undefined)

            for (const call of updateCall.mock.calls) {
                expect(call[0]).not.toHaveProperty("full_name")
            }
        })

        it("'WhatsApp 3601' + pushName '' (string vacio) -> NO toca el nombre", async () => {
            const { supabase, updateCall } = buildSupabaseMock({
                id: "c1",
                full_name: "WhatsApp 3601",
                phone: "573001234567",
            })

            await findOrCreateCustomer(supabase as never, "org-1", "573001234567", "")

            for (const call of updateCall.mock.calls) {
                expect(call[0]).not.toHaveProperty("full_name")
            }
        })
    })

    describe("return value refleja el nombre actualizado", () => {
        it("devuelve el pushName en .name despues de actualizar nombre generico", async () => {
            const { supabase } = buildSupabaseMock({
                id: "c1",
                full_name: "WhatsApp 3601",
                phone: "573001234567",
            })

            const result = await findOrCreateCustomer(supabase as never, "org-1", "573001234567", "Felipe")

            expect(result.name).toBe("Felipe")
        })

        it("devuelve el full_name existente cuando no se actualizo", async () => {
            const { supabase } = buildSupabaseMock({
                id: "c1",
                full_name: "Felipe Garcia",
                phone: "573001234567",
            })

            const result = await findOrCreateCustomer(supabase as never, "org-1", "573001234567", "Felipe")

            expect(result.name).toBe("Felipe Garcia")
        })
    })

    describe("normalizacion de telefono (regresion - no romper comportamiento existente)", () => {
        it("normaliza phone si difiere del canonico", async () => {
            const { supabase, updateCall } = buildSupabaseMock({
                id: "c1",
                full_name: "Felipe",
                phone: "+57 300 123 4567", // formato no canonico
            })

            await findOrCreateCustomer(supabase as never, "org-1", "573001234567", "Felipe")

            expect(updateCall).toHaveBeenCalledWith(
                expect.objectContaining({ phone: "573001234567" }),
            )
        })
    })
})
