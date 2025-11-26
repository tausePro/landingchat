import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
    try {
        const supabase = await createClient()
        const slug = "org-tause-main"

        // 1. Get organization
        const { data: org } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", slug)
            .single()

        if (!org) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 })
        }

        // 2. Check agent
        const { data: existingAgent } = await supabase
            .from("agents")
            .select("*")
            .eq("organization_id", org.id)
            .single()

        if (existingAgent) {
            // Update to be active just in case
            await supabase
                .from("agents")
                .update({ status: 'available' })
                .eq("id", existingAgent.id)

            return NextResponse.json({ message: "Agent already exists (activated)", agent: existingAgent })
        }

        // 3. Create agent
        const { data: newAgent, error } = await supabase
            .from("agents")
            .insert({
                organization_id: org.id,
                name: "Asistente de Compras",
                type: "bot",
                role: "sales",
                status: "available",
                system_prompt: "Eres un asistente de ventas amable y profesional.",
                configuration: {
                    greeting: "¡Hola! ¿En qué puedo ayudarte hoy?",
                    tone: "friendly",
                    personality: "helpful"
                }
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ message: "Agent created successfully", agent: newAgent })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
