import { NextResponse, NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET() {
    return NextResponse.json({ message: "Test route working (GET)" })
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { productId, slug } = body
        
        const supabase = createServiceClient()
        
        // Get org
        const { data: org, error: orgError } = await supabase
            .from("organizations")
            .select("id, name")
            .eq("slug", slug || "qp")
            .single()
        
        if (orgError) {
            return NextResponse.json({ error: "Org error", details: orgError })
        }
        
        // Get product
        const { data: product, error: productError } = await supabase
            .from("products")
            .select("id, name, price, organization_id")
            .eq("id", productId)
            .single()
        
        return NextResponse.json({
            org,
            product,
            productError,
            match: product?.organization_id === org?.id
        })
    } catch (e: any) {
        return NextResponse.json({ error: e.message })
    }
}
