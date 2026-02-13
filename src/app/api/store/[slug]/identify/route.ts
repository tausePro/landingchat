import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { z } from "zod"
import { normalizePhone, getPhoneVariants } from "@/lib/utils/phone"

const identifySchema = z.object({
    name: z.string().min(1, "El nombre es requerido").max(100, "Nombre muy largo"),
    phone: z.string().min(1, "El WhatsApp es requerido").max(20, "Teléfono muy largo")
})

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params

    try {
        const body = await request.json()

        // Validate request body with Zod
        const validation = identifySchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400 }
            )
        }

        const { name, phone } = validation.data

        // Normalizar teléfono usando util compartido (mismo que WhatsApp webhook)
        const canonicalPhone = normalizePhone(phone)
        const phoneVariants = getPhoneVariants(phone)

        // Use service role key to bypass RLS
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
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

        // Buscar cliente existente con cualquiera de las variantes de teléfono
        const { data: existingCustomers } = await supabase
            .from("customers")
            .select("id, full_name, phone, email, total_orders, total_spent, created_at")
            .eq("organization_id", organization.id)
            .in("phone", phoneVariants)
            .order("created_at", { ascending: true })
            .limit(1)

        const existingCustomer = existingCustomers?.[0]

        if (existingCustomer) {
            // Normalizar teléfono almacenado al formato canónico
            const updates: Record<string, string> = {
                updated_at: new Date().toISOString()
            }
            if (existingCustomer.phone !== canonicalPhone) {
                updates.phone = canonicalPhone
            }

            await supabase
                .from("customers")
                .update(updates)
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

        // Crear nuevo cliente con teléfono normalizado
        const { data: newCustomer, error: createError } = await supabase
            .from("customers")
            .insert({
                organization_id: organization.id,
                full_name: name.trim(),
                phone: canonicalPhone,
                metadata: {
                    source: "chat_gate",
                    first_visit: new Date().toISOString()
                }
            })
            .select("id, full_name, phone, email")
            .single()

        if (createError) {
            console.error("Error creating customer:", createError)
            return NextResponse.json({ error: "Error al registrar" }, { status: 500 })
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
