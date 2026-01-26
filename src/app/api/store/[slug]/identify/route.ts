import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { z } from "zod"

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

        // Normalizar teléfono y generar variantes para búsqueda
        const cleanPhone = phone.replace(/[^\d+]/g, "")

        // Extraer solo dígitos (sin +)
        const digitsOnly = phone.replace(/\D/g, "")

        // Generar variantes de búsqueda para encontrar clientes con diferentes formatos
        const phoneVariants: string[] = []

        // Si tiene prefijo de país (57), generar variantes
        if (digitsOnly.startsWith("57") && digitsOnly.length >= 12) {
            // Formato: 573001234567 -> también buscar como 3001234567 y +573001234567
            phoneVariants.push(digitsOnly)                    // 573001234567
            phoneVariants.push(digitsOnly.substring(2))       // 3001234567 (sin código de país)
            phoneVariants.push(`+${digitsOnly}`)             // +573001234567
        } else if (digitsOnly.length >= 10 && digitsOnly.length <= 11) {
            // Formato: 3001234567 -> también buscar como 573001234567 y +573001234567
            phoneVariants.push(digitsOnly)                    // 3001234567
            phoneVariants.push(`57${digitsOnly}`)            // 573001234567
            phoneVariants.push(`+57${digitsOnly}`)           // +573001234567
        } else {
            // Fallback: usar el número limpio como está
            phoneVariants.push(cleanPhone)
            phoneVariants.push(digitsOnly)
        }

        // Eliminar duplicados
        const uniqueVariants = [...new Set(phoneVariants.filter(p => p.length > 0))]

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
            .in("phone", uniqueVariants)
            .order("created_at", { ascending: true }) // El más antiguo primero (cliente original)
            .limit(1)

        const existingCustomer = existingCustomers?.[0]

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
