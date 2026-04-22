import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/server"

const eventSchema = z.object({
    eventType: z.enum(["page_view", "view_content", "add_to_cart", "initiate_checkout", "purchase"]).default("page_view"),
    visitorId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    sourcePath: z.string().max(500).optional(),
    referrer: z.string().max(1000).optional(),
    metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
})

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string; productId: string }> }
) {
    try {
        const { slug, productId } = await params
        const parsedBody = eventSchema.safeParse(await request.json())

        if (!parsedBody.success) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
        }

        const supabase = createServiceClient()

        const [{ data: organization, error: organizationError }, { data: product, error: productError }] = await Promise.all([
            supabase
                .from("organizations")
                .select("id")
                .eq("slug", slug)
                .single(),
            supabase
                .from("products")
                .select("id, organization_id")
                .eq("id", productId)
                .single(),
        ])

        if (
            organizationError ||
            !organization ||
            productError ||
            !product ||
            product.organization_id !== organization.id
        ) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 })
        }

        const { error: insertError } = await supabase
            .from("product_engagement_events")
            .insert({
                organization_id: organization.id,
                product_id: product.id,
                customer_id: parsedBody.data.customerId,
                visitor_id: parsedBody.data.visitorId,
                event_type: parsedBody.data.eventType,
                source_path: parsedBody.data.sourcePath,
                referrer: parsedBody.data.referrer,
                metadata: parsedBody.data.metadata || {},
            })

        if (insertError) {
            if (insertError.code === "42P01") {
                return NextResponse.json({ ok: false, skipped: true }, { status: 202 })
            }

            console.error("[product-events] insert error", insertError)
            return NextResponse.json({ error: "Could not track event" }, { status: 500 })
        }

        return NextResponse.json({ ok: true }, { status: 201 })
    } catch (error) {
        console.error("[product-events] unexpected error", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
