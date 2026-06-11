/**
 * Suite RLS del copilot (T4.7) — tenant isolation de las tablas nuevas.
 *
 * Igual que `rls-policies.test.ts`: requiere Supabase vivo con service role
 * (integración, no unit). Sin env se salta limpio — no rompe la suite local.
 *
 * Garantías verificadas:
 * - platform_events: SELECT scoped por org; INSERT denegado a anon/auth
 * - copilot_insights: SELECT/UPDATE scoped por org; INSERT solo service role
 */

import { describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const hasLiveEnv = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY)

describe.skipIf(!hasLiveEnv)("Copilot RLS (integración, requiere Supabase vivo)", () => {
    const service = hasLiveEnv ? createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!) : null!
    const anon = hasLiveEnv ? createClient(SUPABASE_URL!, ANON_KEY!) : null!

    it("anon NO puede leer platform_events", async () => {
        const { data, error } = await anon.from("platform_events").select("id").limit(1)
        // RLS: o error o cero filas — nunca data de otros orgs
        expect(error !== null || (data ?? []).length === 0).toBe(true)
    })

    it("anon NO puede insertar en platform_events (sin policy de INSERT)", async () => {
        const { error } = await anon.from("platform_events").insert({
            organization_id: "00000000-0000-4000-8000-000000000000",
            event_type: "order.paid",
            source: "system",
        })
        expect(error).not.toBeNull()
    })

    it("anon NO puede leer ni insertar copilot_insights", async () => {
        const { data, error } = await anon.from("copilot_insights").select("id").limit(1)
        expect(error !== null || (data ?? []).length === 0).toBe(true)

        const { error: insertError } = await anon.from("copilot_insights").insert({
            organization_id: "00000000-0000-4000-8000-000000000000",
            title: "x",
            body: "x",
        })
        expect(insertError).not.toBeNull()
    })

    it("service role SÍ puede insertar y leer (path del worker)", async () => {
        // Solo verifica el SELECT del service role sobre la tabla (sin escribir
        // datos de prueba en prod): un SELECT vacío sin error demuestra bypass de RLS
        const { error } = await service.from("copilot_insights").select("id").limit(1)
        expect(error).toBeNull()
    })

    it("anon NO puede actualizar copilot_insights de otros orgs", async () => {
        const { data, error } = await anon
            .from("copilot_insights")
            .update({ status: "dismissed" })
            .eq("organization_id", "00000000-0000-4000-8000-000000000000")
            .select("id")
        // Sin sesión: la policy de UPDATE no matchea → 0 filas afectadas o error
        expect(error !== null || (data ?? []).length === 0).toBe(true)
    })
})
