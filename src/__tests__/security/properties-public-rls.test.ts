/**
 * RLS — properties_public_read_active
 *
 * Tests del slice T0.5.1.1 (refactor/reduce-service-client-surface).
 *
 * Garantiza que la policy creada por migración
 * `20260521a_properties_public_read.sql` se comporta como esperado:
 *   - `anon` puede SELECT propiedades con `status = 'active'`.
 *   - `anon` NO puede leer propiedades en otros status (inactive, sold, etc.).
 *   - `anon` NO puede INSERT/UPDATE/DELETE.
 *
 * NOTA: Estos tests son integration y requieren un Supabase real con la
 * migración aplicada + variables de entorno reales. No se corren en CI
 * (ver `.github/workflows/ci.yml`); se ejecutan manualmente durante el
 * smoke pre-merge en un entorno de QA.
 *
 * Ejecución local:
 *   npx vitest run src/__tests__/security/properties-public-rls.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Skip toda la suite si las credenciales reales no están disponibles
// (evita falsos negativos en entornos sin Supabase, como CI).
const hasCredentials = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY)
const describeIfReal = hasCredentials ? describe : describe.skip

describeIfReal("RLS — properties_public_read_active", () => {
    let serviceClient: SupabaseClient
    let anonClient: SupabaseClient
    let testOrgId: string
    let activePropertyId: string
    let inactivePropertyId: string

    beforeAll(async () => {
        serviceClient = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!)
        anonClient = createClient(SUPABASE_URL!, ANON_KEY!)

        // Crear org de prueba
        const { data: org, error: orgError } = await serviceClient
            .from("organizations")
            .insert({
                name: "RLS Test Org",
                slug: "rls-test-org-" + Math.random().toString(36).substring(2, 10),
            })
            .select("id")
            .single()
        if (orgError) throw orgError
        testOrgId = org.id

        // Insertar una propiedad activa y una inactiva
        const { data: active, error: activeErr } = await serviceClient
            .from("properties")
            .insert({
                organization_id: testOrgId,
                external_id: "rls-active-" + Date.now(),
                external_code: "RLS-ACTIVE",
                title: "Propiedad de prueba activa",
                property_type: "venta",
                status: "active",
            })
            .select("id")
            .single()
        if (activeErr) throw activeErr
        activePropertyId = active.id

        const { data: inactive, error: inactiveErr } = await serviceClient
            .from("properties")
            .insert({
                organization_id: testOrgId,
                external_id: "rls-inactive-" + Date.now(),
                external_code: "RLS-INACTIVE",
                title: "Propiedad de prueba inactiva",
                property_type: "venta",
                status: "inactive",
            })
            .select("id")
            .single()
        if (inactiveErr) throw inactiveErr
        inactivePropertyId = inactive.id
    })

    afterAll(async () => {
        if (!testOrgId) return
        await serviceClient.from("properties").delete().eq("organization_id", testOrgId)
        await serviceClient.from("organizations").delete().eq("id", testOrgId)
    })

    it("anon puede SELECT propiedad activa por id", async () => {
        const { data, error } = await anonClient
            .from("properties")
            .select("id, status")
            .eq("id", activePropertyId)
            .single()

        expect(error).toBeNull()
        expect(data).toBeDefined()
        expect(data?.status).toBe("active")
    })

    it("anon NO puede SELECT propiedad inactiva", async () => {
        const { data, error } = await anonClient
            .from("properties")
            .select("id")
            .eq("id", inactivePropertyId)
            .maybeSingle()

        // RLS filtra: la fila no es visible para anon
        expect(error).toBeNull()
        expect(data).toBeNull()
    })

    it("anon ve solo propiedades activas al listar la org", async () => {
        const { data, error } = await anonClient
            .from("properties")
            .select("id, status")
            .eq("organization_id", testOrgId)

        expect(error).toBeNull()
        expect(data).toBeDefined()
        expect(data?.every((row) => row.status === "active")).toBe(true)
        expect(data?.some((row) => row.id === activePropertyId)).toBe(true)
        expect(data?.some((row) => row.id === inactivePropertyId)).toBe(false)
    })

    it("anon NO puede INSERT en properties", async () => {
        const { error } = await anonClient.from("properties").insert({
            organization_id: testOrgId,
            external_id: "rls-anon-insert-attempt",
            external_code: "RLS-ANON-INSERT",
            title: "Intento anon",
            property_type: "venta",
            status: "active",
        })
        expect(error).not.toBeNull()
    })

    it("anon NO puede UPDATE propiedad activa", async () => {
        const { error } = await anonClient
            .from("properties")
            .update({ title: "Hack attempt" })
            .eq("id", activePropertyId)

        // En RLS, UPDATE sin policy aplicable retorna 0 filas modificadas
        // o un error de permisos según la config. Validamos que no haya
        // cambio efectivo verificando el título después.
        if (!error) {
            const { data: after } = await serviceClient
                .from("properties")
                .select("title")
                .eq("id", activePropertyId)
                .single()
            expect(after?.title).toBe("Propiedad de prueba activa")
        }
    })

    it("anon NO puede DELETE propiedad activa", async () => {
        const { error } = await anonClient
            .from("properties")
            .delete()
            .eq("id", activePropertyId)

        if (!error) {
            const { data: after } = await serviceClient
                .from("properties")
                .select("id")
                .eq("id", activePropertyId)
                .maybeSingle()
            expect(after).not.toBeNull()
        }
    })
})
