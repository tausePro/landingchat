import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params

    try {
        const body = await request.json()
        const { name, phone } = body

        // Validación
        if (!name?.trim()) {
            return NextResponse.json(
                { error: "El nombre es requerido" },
                { status: 400 }
            )
        }

        if (!phone?.trim()) {
            return NextResponse.json(
                { error: "El WhatsApp es requerido" },
                { status: 400 }
            )
        }

        // Limpiar teléfono (solo números y +)
        const cleanPhone = phone.replace(/[^\d+]/g, "")

        const supabase = await createClient()

        // Obtener organización
        const { data: organization, error: orgError } = await supabase
            .from("organizations")
            .select("id, name")
            .eq("slug", slug)
            .single()

        if (orgError || !organization) {
            return NextResponse.json(
                { error: "Tienda no encontrada" },
                { status: 404 }
            )
        }

        // Buscar cliente existente por teléfono
        const { data: existingCustomer } = await supabase
            .from("customers")
            .select("id, full_name, phone, email, metadata, total_orders, total_spent")
            .eq("organization_id", organization.id)
            .eq("phone", cleanPhone)
            .single()

        if (existingCustomer) {
            // Cliente existente - actualizar última interacción
            await supabase
                .from("customers")
                .update({
                    updated_at: new Date().toISOString(),
                    // Opcionalmente actualizar el nombre si es diferente
                    // full_name: name.trim()
                })
                .eq("id", existingCustomer.id)

            return NextResponse.json({
                customer: {
                    id: existingCustomer.id,
                    full_name: existingCustomer.full_name,
                    phone: existingCustomer.phone,
                    email: existingCustomer.email,
                    totalOrders: existingCustomer.total_orders || 0,
                    totalSpent: existingCustomer.total_spent || 0
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
            console.error("Error creating customer:", createError)
            return NextResponse.json(
                { error: "Error al registrar. Intenta de nuevo." },
                { status: 500 }
            )
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
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        )
    }
}
