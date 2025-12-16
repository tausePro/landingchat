import { NextRequest, NextResponse } from "next/server"
import { getShippingConfig } from "@/app/store/[slug]/actions"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params
        const shippingConfig = await getShippingConfig(slug)
        
        if (!shippingConfig) {
            return NextResponse.json(
                { error: "Store not found" },
                { status: 404 }
            )
        }

        return NextResponse.json(shippingConfig)
    } catch (error) {
        console.error("Error fetching shipping config:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}