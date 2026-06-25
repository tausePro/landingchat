"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { applyPaymentStatusToOrder } from "@/lib/payments/payment-confirmation"
import { reconcileOrderPayment } from "@/lib/payments/epayco-reconciliation"
import { revalidatePath } from "next/cache"

interface DashboardCustomerInfo {
    name?: string | null
    full_name?: string | null
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    payment_method_fee?: number | null
    discount_amount?: number | null
    coupon_code?: string | null
    document_type?: string | null
    document_number?: string | null
    person_type?: string | null
    business_name?: string | null
    [key: string]: unknown
}

export interface OrderDetail {
    id: string
    order_number: string
    created_at: string
    updated_at: string
    status: string
    total: number
    subtotal: number
    tax: number
    shipping_cost: number
    notes: string | null
    customer: {
        id: string
        full_name: string
        email: string | null
        phone: string | null
    } | null
    items: Array<{
        id: string
        product_id: string
        product_name: string
        quantity: number
        unit_price: number
        total_price: number
        variant_info: unknown
        image_url?: string
    }>
    shipping_address: Record<string, unknown> | null
    billing_address: Record<string, unknown> | null
    customer_info: DashboardCustomerInfo | null
    // Payment fields
    payment_method: string
    payment_status: string
    // Tracking fields
    source_channel?: string
    chat_id?: string
    utm_data?: {
        utm_source?: string
        utm_medium?: string
        utm_campaign?: string
        utm_content?: string
        utm_term?: string
        referrer?: string
    }
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError) {
            console.error("[getOrderDetail] Auth error:", authError.message)
            return null // Retornar null en lugar de throw para evitar crash
        }

        if (!user) {
            console.error("[getOrderDetail] No user found")
            return null
        }

        // Get organization_id
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()

        if (profileError) {
            console.error("[getOrderDetail] Profile error:", profileError.message)
            return null
        }

        if (!profile?.organization_id) {
            console.error("[getOrderDetail] No organization found for user")
            return null
        }

        // Fetch order - don't join customers, use customer_info instead
        const { data: order, error } = await supabase
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .eq("organization_id", profile.organization_id)
            .maybeSingle()

        if (error) {
            console.error("[getOrderDetail] Query error:", error.message)
            return null
        }

        if (!order) {
            return null
        }

        console.log("[getOrderDetail] Order found:", {
            id: order.id,
            status: order.status,
            total: order.total,
            hasItems: Array.isArray(order.items),
            itemsCount: Array.isArray(order.items) ? order.items.length : 0,
            hasCustomerInfo: !!order.customer_info
        })

        const customerInfo = order.customer_info as DashboardCustomerInfo | null

        return {
            id: order.id,
            order_number: order.order_number || `#${order.id.slice(0, 8)}`,
            created_at: order.created_at,
            updated_at: order.updated_at || order.created_at,
            status: order.status,
            total: order.total || 0,
            subtotal: order.subtotal || 0,
            tax: order.tax || 0,
            shipping_cost: order.shipping_cost || 0,
            notes: order.notes || null,
            payment_method: order.payment_method || 'manual',
            payment_status: order.payment_status || 'pending',
            customer: customerInfo ? {
                id: order.customer_id || 'anonymous',
                full_name: customerInfo.name || customerInfo.full_name || 'Cliente anónimo',
                email: customerInfo.email || null,
                phone: customerInfo.phone || null
            } : null,
            items: Array.isArray(order.items) ? order.items : [],
            shipping_address: order.shipping_address || (customerInfo ? {
                street: customerInfo.address,
                city: customerInfo.city,
                state: 'Colombia', // Default/Fallback
                postal_code: '',
                country: 'Colombia'
            } : null),
            billing_address: null,
            customer_info: customerInfo,
            // Tracking fields
            source_channel: order.source_channel || 'web',
            chat_id: order.chat_id || undefined,
            utm_data: order.utm_data || undefined,
        }
    } catch (error) {
        console.error("[getOrderDetail] Unexpected error:", error)
        return null
    }
}

export async function updateOrderStatus(orderId: string, newStatus: string) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    console.log("[updateOrderStatus] Auth check:", {
        userId: user?.id,
        authError: authError?.message
    })

    if (!user) throw new Error("Unauthorized")

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    console.log("[updateOrderStatus] Profile check:", {
        userId: user.id,
        organizationId: profile?.organization_id,
        profileError: profileError?.message
    })

    if (!profile?.organization_id) throw new Error("No organization found")

    console.log("[updateOrderStatus] Attempting update:", {
        orderId,
        newStatus,
        userId: user.id,
        organizationId: profile.organization_id
    })

    const { data, error } = await supabase
        .from("orders")
        .update({
            status: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq("id", orderId)
        .eq("organization_id", profile.organization_id)
        .select()

    if (error) {
        console.error("[updateOrderStatus] Error:", error)
        throw new Error("Failed to update order status: " + error.message)
    }

    if (!data || data.length === 0) {
        console.error("[updateOrderStatus] No order found to update")
        throw new Error("Order not found or you don't have permission to update it")
    }

    console.log("[updateOrderStatus] Successfully updated:", data[0])

    // Notificar al COMPRADOR del cambio de estado (email). No bloquea la acción;
    // sendOrderStatusEmail ignora estados sin notificación (pending/confirmed/…).
    try {
        await notifyBuyerOrderStatus(supabase, data[0], profile.organization_id, newStatus)
    } catch (e) {
        console.error("[updateOrderStatus] buyer notification failed:", e)
    }

    return { success: true }
}

/**
 * Envía al comprador el email de cambio de estado del pedido (enviado/entregado/
 * cancelado/en preparación). Reúne org + locale + link tokenizado del pedido.
 */
async function notifyBuyerOrderStatus(
    supabase: Awaited<ReturnType<typeof createClient>>,
    order: { id: string; order_number?: string | null; customer_id?: string | null; customer_info?: unknown },
    organizationId: string,
    status: string,
): Promise<void> {
    if (!["processing", "shipped", "delivered", "cancelled"].includes(status)) return
    const ci = (order.customer_info ?? null) as { email?: string; name?: string; phone?: string } | null
    const customerEmail = typeof ci?.email === "string" ? ci.email : ""
    const customerPhone = typeof ci?.phone === "string" ? ci.phone : ""
    if (!customerEmail && !customerPhone) return

    const { data: org } = await supabase
        .from("organizations")
        .select("name, slug, custom_domain, locale, currency_code, country_code")
        .eq("id", organizationId)
        .single()
    if (!org) return

    const { getTenantLocale } = await import("@/lib/i18n/tenant-locale")
    const { createStorefrontOrderAccessToken, appendStorefrontAccessParam } = await import("@/lib/storefrontAccess")
    const { sendOrderStatusEmail } = await import("@/lib/notifications/email")

    const tenantLocale = getTenantLocale(org)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://landingchat.co"
    const storeUrl = org.custom_domain
        ? `https://${org.custom_domain}`
        : appUrl.includes("localhost")
            ? `${appUrl}/store/${org.slug}`
            : `https://${org.slug}.landingchat.co`
    const token = createStorefrontOrderAccessToken({
        slug: org.slug,
        organizationId,
        orderId: order.id,
        customerId: order.customer_id ?? null,
    })
    const orderUrl = appendStorefrontAccessParam(`${storeUrl}/order/${order.id}`, token)

    const { logNotification } = await import("@/lib/notifications/log")

    if (customerEmail) {
        const emailOk = await sendOrderStatusEmail({
            orderNumber: order.order_number || order.id,
            customerName: ci?.name || "Cliente",
            customerEmail,
            status,
            organizationName: org.name || "",
            orderUrl,
            locale: tenantLocale.locale,
            currency: tenantLocale.currency,
        })
        await logNotification({
            organizationId,
            orderId: order.id,
            kind: "order_status",
            channel: "email",
            recipientType: "buyer",
            status: emailOk ? "sent" : "failed",
            channelUsed: "resend",
            metadata: { orderStatus: status },
        })
    }

    // WhatsApp al comprador (mismo patrón que el cron de reseñas: sendWhatsAppMessage
    // resuelve la instancia 'corporate' del tenant). Texto libre; en Meta fuera de
    // la ventana de 24h podría requerir plantilla (gap conocido, igual que reseñas).
    // Best-effort: no rompe la actualización de estado.
    const { t } = await import("@/lib/i18n/storefront-strings")
    const waParams = { customerName: ci?.name || "", orderNumber: order.order_number || order.id, orderUrl }
    let waMsg: string | null = null
    switch (status) {
        case "processing": waMsg = t("store.order_status.wa_processing", tenantLocale.locale, waParams); break
        case "shipped": waMsg = t("store.order_status.wa_shipped", tenantLocale.locale, waParams); break
        case "delivered": waMsg = t("store.order_status.wa_delivered", tenantLocale.locale, waParams); break
        case "cancelled": waMsg = t("store.order_status.wa_cancelled", tenantLocale.locale, waParams); break
    }
    if (customerPhone && waMsg) {
        let waOk = false
        let waError: string | null = null
        try {
            const { sendWhatsAppMessage } = await import("@/lib/whatsapp/provider")
            await sendWhatsAppMessage(organizationId, customerPhone, waMsg)
            waOk = true
        } catch (e) {
            waError = e instanceof Error ? e.message : "unknown"
            console.error("[notifyBuyerOrderStatus] whatsapp failed:", e)
        }
        await logNotification({
            organizationId,
            orderId: order.id,
            kind: "order_status",
            channel: "whatsapp",
            recipientType: "buyer",
            status: waOk ? "sent" : "failed",
            error: waError,
            metadata: { orderStatus: status },
        })
    }
}

/**
 * Marca manualmente una orden como pagada desde el dashboard.
 *
 * T1.6 — server action principal de confirmación manual de pago. Reemplaza
 * el `confirmOrderPayment` legacy (que sigue exportado como alias para no
 * romper imports existentes).
 *
 * Comportamiento:
 *   1. Valida que el usuario actual pertenece a una organization.
 *   2. Carga la orden + su organization (currency_code) en paralelo.
 *   3. Si la orden ya está `payment_status='paid'` lanza error (idempotencia
 *      a nivel de UX — el side-effect interno también es idempotente).
 *   4. Crea o actualiza la `store_transactions` correspondiente con la
 *      moneda real del tenant (no más 'COP' hardcoded).
 *   5. Escribe las columnas audit en `orders`:
 *      - `payment_confirmed_at` (now)
 *      - `payment_confirmed_by` (user.id)
 *      - `payment_confirmation_note` (param opcional)
 *   6. Invoca `applyPaymentStatusToOrder` que se encarga de:
 *      - Actualizar `payment_status='paid'` + `status='confirmed'`.
 *      - Decrementar stock idempotentemente (`stock_decremented_at` flag).
 *      - Enviar email order-paid al cliente locale-aware.
 *      - Notificar al merchant por WhatsApp.
 *      - Trackear server-side Meta CAPI Purchase.
 *
 * @param orderId UUID de la orden a confirmar.
 * @param note Nota opcional del operator (ej: "transferencia verificada
 *             con captura en WhatsApp 21:43"). Persiste en
 *             `orders.payment_confirmation_note` + `store_transactions.provider_response.note`.
 */
export async function markOrderAsPaid(orderId: string, note?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) throw new Error("No organization found")

    const serviceSupabase = createServiceClient()

    // Cargar orden + organization en paralelo. La org la necesitamos para
    // resolver la moneda real (Tantor=USD, QP/Tez=COP) en lugar del COP
    // hardcoded del legacy.
    const [orderResult, orgResult] = await Promise.all([
        serviceSupabase
            .from("orders")
            .select("id, organization_id, total, payment_method, payment_status, customer_id")
            .eq("id", orderId)
            .eq("organization_id", profile.organization_id)
            .maybeSingle(),
        serviceSupabase
            .from("organizations")
            .select("currency_code")
            .eq("id", profile.organization_id)
            .single(),
    ])

    if (orderResult.error || !orderResult.data) {
        throw new Error("Orden no encontrada o no tienes permisos para actualizarla")
    }

    const order = orderResult.data
    const currency = typeof orgResult.data?.currency_code === "string"
        ? orgResult.data.currency_code
        : "COP"

    // Idempotencia a nivel UX: la lógica interna ya es idempotente, pero
    // queremos fallar rápido si el operator hace doble-click o re-confirma.
    if (order.payment_status === "paid") {
        throw new Error("La orden ya está marcada como pagada")
    }

    const paymentMethod = typeof order.payment_method === "string" ? order.payment_method : "manual"
    const provider = paymentMethod === "wompi" || paymentMethod === "epayco"
        ? paymentMethod
        : paymentMethod === "contraentrega" || paymentMethod === "cash_on_delivery"
            ? "cash_on_delivery"
            : "manual"

    const { data: existingTransaction } = await serviceSupabase
        .from("store_transactions")
        .select("id, status")
        .eq("organization_id", profile.organization_id)
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    const completedAt = new Date().toISOString()
    const trimmedNote = typeof note === "string" && note.trim().length > 0
        ? note.trim().slice(0, 1000)  // hard cap defensivo contra abuse
        : null

    if (existingTransaction) {
        const { error: transactionUpdateError } = await serviceSupabase
            .from("store_transactions")
            .update({
                status: "approved",
                completed_at: completedAt,
                updated_at: completedAt,
                provider_response: {
                    source: "dashboard_manual_confirmation",
                    confirmed_by: user.id,
                    previous_status: existingTransaction.status,
                    ...(trimmedNote ? { note: trimmedNote } : {}),
                },
            })
            .eq("id", existingTransaction.id)

        if (transactionUpdateError) {
            throw new Error("No se pudo actualizar la transacción de pago")
        }
    } else {
        const { error: transactionInsertError } = await serviceSupabase
            .from("store_transactions")
            .insert({
                organization_id: profile.organization_id,
                order_id: orderId,
                customer_id: order.customer_id || null,
                amount: Math.round(Number(order.total || 0) * 100),
                currency,  // T1.6 — moneda real del tenant (no más COP hardcoded)
                status: "approved",
                provider,
                provider_transaction_id: null,
                provider_reference: orderId,
                provider_response: {
                    source: "dashboard_manual_confirmation",
                    confirmed_by: user.id,
                    ...(trimmedNote ? { note: trimmedNote } : {}),
                },
                payment_method: paymentMethod,
                completed_at: completedAt,
            })

        if (transactionInsertError) {
            throw new Error("No se pudo crear la transacción de pago")
        }
    }

    // T1.6 — Audit log directo en orders: queryable + 1 query menos para
    // mostrar "quién y cuándo" en la UI dashboard. Si futuro necesita
    // histórico (revertir paid → pending), migración aparte sin pérdida.
    const { error: auditError } = await serviceSupabase
        .from("orders")
        .update({
            payment_confirmed_at: completedAt,
            payment_confirmed_by: user.id,
            payment_confirmation_note: trimmedNote,
            updated_at: completedAt,
        })
        .eq("id", orderId)
        .eq("organization_id", profile.organization_id)

    if (auditError) {
        // No bloqueamos: las columnas audit son complementarias. Si fallan,
        // el pago igual se marca como paid (next step). Loggeamos para
        // reconciliar manualmente.
        console.error("[markOrderAsPaid] Failed to write audit columns:", auditError.message)
    }

    const result = await applyPaymentStatusToOrder({
        supabase: serviceSupabase,
        organizationId: profile.organization_id,
        orderId,
        transactionStatus: "approved",
        source: "dashboard_manual_confirmation",
    })

    if (!result.success) {
        throw new Error(result.error || "No se pudo confirmar el pago")
    }

    revalidatePath("/dashboard/orders")
    revalidatePath(`/dashboard/orders/${orderId}`)

    return { success: true, sideEffectsRan: result.sideEffectsRan }
}

/**
 * Alias legacy de `markOrderAsPaid` para no romper imports existentes en la
 * UI (`order-actions.tsx`). En PRs futuros se puede migrar el caller y
 * eliminar este alias.
 *
 * @deprecated T1.6 — usar `markOrderAsPaid(orderId, note?)` directamente.
 */
export async function confirmOrderPayment(orderId: string) {
    return markOrderAsPaid(orderId)
}

export async function reconcileOrderPaymentFromGateway(orderId: string, providerTransactionId?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) throw new Error("No organization found")

    // ePayco no permite consultar por factura: si el merchant pega el x_ref_payco
    // interno (desde el dashboard de ePayco), lo reenviamos para que el
    // reconciliador use getTransaction(x_ref_payco) en lugar de la consulta por
    // reference que lanza error. Trim defensivo; blanco → undefined.
    const trimmedProviderTransactionId =
        typeof providerTransactionId === "string" && providerTransactionId.trim().length > 0
            ? providerTransactionId.trim()
            : undefined

    const result = await reconcileOrderPayment({
        organizationId: profile.organization_id,
        orderId,
        providerTransactionId: trimmedProviderTransactionId,
    })

    revalidatePath("/dashboard/orders")
    revalidatePath(`/dashboard/orders/${orderId}`)

    if (!result.reconciled) {
        return {
            success: false,
            provider: result.provider,
            status: result.status,
            reason: result.reason || "not_reconciled",
            error: result.error,
        }
    }

    return {
        success: true,
        provider: result.provider,
        status: result.status,
        orderUpdated: result.orderUpdated,
        transactionUpdated: result.transactionUpdated,
        sideEffectsRan: result.sideEffectsRan,
    }
}

export async function deleteOrder(orderId: string) {
    const supabase = await createClient()
    const serviceSupabase = createServiceClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    console.log("[deleteOrder] Auth check:", {
        userId: user?.id,
        authError: authError?.message
    })

    if (!user) throw new Error("Unauthorized")

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    console.log("[deleteOrder] Profile check:", {
        userId: user.id,
        organizationId: profile?.organization_id,
        profileError: profileError?.message
    })

    if (!profile?.organization_id) throw new Error("No organization found")

    console.log("[deleteOrder] Attempting delete:", {
        orderId,
        userId: user.id,
        organizationId: profile.organization_id
    })

    // Verificar que la orden existe y pertenece a la organización
    const { data: existingOrder, error: checkError } = await supabase
        .from("orders")
        .select("id, status, order_number")
        .eq("id", orderId)
        .eq("organization_id", profile.organization_id)
        .single()

    if (checkError || !existingOrder) {
        console.error("[deleteOrder] Order not found:", checkError?.message)
        throw new Error("Orden no encontrada o no tienes permisos para eliminarla")
    }

    const { error: transactionUnlinkError } = await serviceSupabase
        .from("store_transactions")
        .update({
            order_id: null,
            updated_at: new Date().toISOString(),
        })
        .eq("order_id", orderId)
        .eq("organization_id", profile.organization_id)

    if (transactionUnlinkError) {
        console.error("[deleteOrder] Error unlinking transactions:", transactionUnlinkError)
        throw new Error("Error al preparar la eliminación del pedido: " + transactionUnlinkError.message)
    }

    // Eliminar la orden
    const { data: deletedData, error: deleteError, count } = await serviceSupabase
        .from("orders")
        .delete()
        .eq("id", orderId)
        .eq("organization_id", profile.organization_id)
        .select()

    console.log("[deleteOrder] Delete operation result:", {
        deletedData,
        deleteError: deleteError?.message,
        count,
        orderId,
        organizationId: profile.organization_id
    })

    if (deleteError) {
        console.error("[deleteOrder] Error deleting order:", deleteError)
        throw new Error("Error al eliminar la orden: " + deleteError.message)
    }

    if (!deletedData || deletedData.length === 0) {
        console.error("[deleteOrder] No rows were deleted - order may not exist or permission denied")
        throw new Error("No se pudo eliminar la orden. Verifica que existe y tienes permisos.")
    }

    console.log("[deleteOrder] Successfully deleted order:", existingOrder.order_number, "Deleted rows:", deletedData.length)

    // Revalidar las páginas de órdenes para actualizar la cache
    revalidatePath("/dashboard/orders")
    revalidatePath(`/dashboard/orders/${orderId}`)

    return { success: true, orderNumber: existingOrder.order_number }
}
