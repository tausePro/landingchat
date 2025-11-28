import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params

    try {
        const body = await request.json()
        const { name, phone } = body

        if (!name?.trim()) {
            return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
        }

        if (!phone?.trim()) {
            return NextResponse.json({ error: "El WhatsApp es requerido" }, { status: 400 })
        }

        const cleanPhone = phone.replace(/[^\d+]/g, "")

        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error("SUPABASE_SERVICE_ROLE_KEY is missing")
            return NextResponse.json({ error: "Falta configuración del servidor" }, { status: 500 })
        }

        // Use service role key to bypass RLS
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        )

        // Obtener organización
        const { data: organization, error: orgError } = await supabase
            .from("organizations")
            .select("id, name")
            .eq("slug", slug)
            .single()

        if (orgError || !organization) {
            return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 })
        }

        // Buscar cliente existente
        const { data: existingCustomer } = await supabase
            .from("customers")
            .select("id, full_name, phone, email")
            .eq("organization_id", organization.id)
            .eq("phone", cleanPhone)
            .single()

        if (existingCustomer) {
            await supabase
                .from("customers")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", existingCustomer.id)

            return NextResponse.json({
                customer: {
                    id: existingCustomer.id,
                    full_name: existingCustomer.full_name,
                    phone: existingCustomer.phone,
                    email: existingCustomer.email,
                    totalOrders: 0,
                    totalSpent: 0
                },
                isNew: false,
                isReturning: true
            })
        }

        // Crear nuevo cliente
        const { data: newCustomer, error: createError } = await supabase
            .from("customers")
            .insert({
                organization_id: organization.id,
                full_name: name.trim(),
                phone: cleanPhone,
                metadata: {
                    source: "chat_gate",
                    first_visit: new Date().toISOString()
                }
            })
            .select("id, full_name, phone, email")
            .single()

        if (createError) {
            console.error("Error creating customer - Full Error:", JSON.stringify(createError, null, 2))
            return NextResponse.json({ error: "Error al registrar: " + createError.message }, { status: 500 })
        }

        return NextResponse.json({
            customer: {
                id: newCustomer.id,
                full_name: newCustomer.full_name,
                phone: newCustomer.phone,
                email: newCustomer.email,
                totalOrders: 0,
                totalSpent: 0
            },
            isNew: true,
            isReturning: false
        })

    } catch (error: any) {
        console.error("Error in identify:", error)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}
