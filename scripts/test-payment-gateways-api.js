// Test script to debug payment gateways API
// Run with: node scripts/test-payment-gateways-api.js

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-key'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testGetAvailablePaymentGateways(slug) {
    try {
        console.log(`Testing getAvailablePaymentGateways for slug: ${slug}`)
        
        // Get organization ID from slug
        const { data: org, error: orgError } = await supabase
            .from("organizations")
            .select("id, slug")
            .eq("slug", slug)
            .single()

        if (orgError || !org) {
            console.error("Organization error:", orgError)
            return { success: false, error: "Organización no encontrada", gateways: [] }
        }

        console.log("Organization found:", org)

        // Get active payment gateways
        const { data: gateways, error: gatewaysError } = await supabase
            .from("payment_gateway_configs")
            .select("provider, is_active, is_test_mode, public_key, created_at, updated_at")
            .eq("organization_id", org.id)

        console.log("All gateways for org:", gateways)

        // Get only active gateways
        const { data: activeGateways, error: activeGatewaysError } = await supabase
            .from("payment_gateway_configs")
            .select("provider, is_active, is_test_mode")
            .eq("organization_id", org.id)
            .eq("is_active", true)

        if (gatewaysError || activeGatewaysError) {
            console.error("Gateways error:", gatewaysError || activeGatewaysError)
            return { success: false, error: "Error al obtener pasarelas", gateways: [] }
        }

        console.log("Active gateways:", activeGateways)

        return { 
            success: true, 
            gateways: activeGateways || []
        }
    } catch (error) {
        console.error("Unexpected error:", error)
        return { success: false, error: "Error inesperado", gateways: [] }
    }
}

// Test with 'tez' slug
testGetAvailablePaymentGateways('tez').then(result => {
    console.log("Final result:", JSON.stringify(result, null, 2))
    process.exit(0)
}).catch(error => {
    console.error("Script error:", error)
    process.exit(1)
})