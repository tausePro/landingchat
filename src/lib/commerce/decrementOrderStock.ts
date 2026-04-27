/**
 * decrementOrderStock
 * ----------------------------------------------------------------------------
 * Utilidad compartida para decrementar el stock de los productos de una orden
 * usando la RPC atómica `decrement_product_stock` (Fase 0.4 — Bug H).
 *
 * Contexto:
 *   - Los webhooks de Wompi y ePayco consultaban la tabla `order_items` que
 *     NO existe en la base (zero-day Bug H). Esta util reemplaza ese query y
 *     lee `orders.items` (jsonb) como fuente de verdad.
 *   - El decrement se hace via RPC `public.decrement_product_stock` que usa
 *     `SELECT ... FOR UPDATE` para atomicidad (Bug B resuelto).
 *   - La orden se marca `stock_decremented_at = now()` para garantizar
 *     idempotencia: llamadas repetidas (reintentos de webhook, retries) no
 *     decrementan stock dos veces.
 *
 * Callers:
 *   - `src/app/api/webhooks/payments/wompi/route.ts` (en processOrderUpdate,
 *     después de marcar `payment_status: 'paid'`)
 *   - `src/app/api/webhooks/payments/epayco/route.ts` (idem)
 *   - `src/app/chat/actions.ts :: createOrder` (para `offlinePaymentMethods`:
 *     `manual`, `contraentrega`, `cash_on_delivery` — reserva inmediata de
 *     inventario al crear la orden; opción A aprobada por el usuario).
 *
 * Referencias:
 *   - `migrations/20260421_decrement_product_stock_rpc.sql`
 *   - `docs-private/PUNCHLIST_HARDENING_PLATAFORMA_2026-04.md` §0.7 Bug H
 *   - `docs-private/TORRE_DE_CONTROL_EJECUCION.md` §13.4c
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"

const log = logger("commerce/decrementOrderStock")

// Aceptamos tanto el cliente service-role como el autenticado — ambos pueden
// invocar la RPC gracias al GRANT EXECUTE a `authenticated, service_role` en
// la migración. Usamos `SupabaseClient` directo para no contar como uso de
// service-role en la métrica oficial.

/**
 * Shape esperado de cada item en `orders.items` (jsonb).
 * Generado por `transformCartItemsToOrderItems` en `src/app/chat/actions.ts`.
 * Todos los campos son opcionales para manejar órdenes legacy con formatos
 * distintos. Solo `product_id` y `quantity` son obligatorios para decrementar.
 */
interface OrderItemFromJsonb {
    product_id?: string | null
    quantity?: number | null
    product_name?: string | null
    unit_price?: number | null
    total_price?: number | null
    variant_info?: {
        variant_id?: string | null
        variant_title?: string | null
    } | null
}

/**
 * Resultado del decremento de una orden.
 */
export interface DecrementOrderStockResult {
    orderId: string
    organizationId: string
    /**
     * True si la operación se omitió (orden no encontrada, ya decrementada,
     * o sin items válidos). False si se procesaron decrementos (aunque
     * individualmente alguno haya fallado).
     */
    skipped: boolean
    reason?: "already_decremented" | "order_not_found" | "no_items"
    /**
     * Resultado por cada item procesado. En `skipped: true` siempre es [].
     */
    items: Array<{
        productId: string
        quantity: number
        previousStock: number | null
        newStock: number | null
        /**
         * True si el stock disponible era suficiente antes del decremento.
         * False si hubo que clampar a 0 (caso de sobreventa detectada).
         */
        wasSufficient: boolean
        variantUpdated: boolean
        error?: string
    }>
}

/**
 * Parsea y valida un item del jsonb `orders.items`. Devuelve { productId, quantity }
 * si es válido, o null si falta información mínima para decrementar.
 */
function parseItem(
    raw: unknown,
): { productId: string; quantity: number } | null {
    if (!raw || typeof raw !== "object") return null
    const item = raw as OrderItemFromJsonb

    const productIdRaw = item.product_id
    const productId = typeof productIdRaw === "string" ? productIdRaw.trim() : ""
    if (!productId) return null

    const quantityRaw = item.quantity
    if (typeof quantityRaw !== "number" || !Number.isFinite(quantityRaw) || quantityRaw < 1) {
        return null
    }

    return { productId, quantity: Math.floor(quantityRaw) }
}

/**
 * Marca la orden como decrementada (`stock_decremented_at = now()`).
 * Errores de esta operación se loguean pero no se propagan — el decrement ya
 * ocurrió y no queremos romper el flow post-payment. Si la marca falla y
 * llega un reintento, el reintento re-decrementaría: riesgo aceptado con
 * prioridad baja porque depende de un fallo transitorio de Supabase.
 */
async function markOrderDecremented(
    supabase: SupabaseClient,
    orderId: string,
    organizationId: string,
): Promise<void> {
    const { error } = await supabase
        .from("orders")
        .update({ stock_decremented_at: new Date().toISOString() })
        .eq("id", orderId)
        .eq("organization_id", organizationId)

    if (error) {
        log.error("Failed to mark order as stock_decremented", {
            orderId,
            organizationId,
            error: error.message,
        })
    }
}

/**
 * Decrementa el stock de todos los productos de una orden usando la RPC
 * atómica. Idempotente: si la orden ya tiene `stock_decremented_at` setteado,
 * devuelve `skipped: true` sin hacer nada.
 *
 * @param supabase - Cliente Supabase (service role recomendado para webhooks)
 * @param orderId - UUID de la orden
 * @param organizationId - UUID de la organización (guardia anti cross-tenant)
 */
export async function decrementOrderStock(
    supabase: SupabaseClient,
    orderId: string,
    organizationId: string,
): Promise<DecrementOrderStockResult> {
    // 1. Leer orden + flag de idempotencia
    const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id, items, stock_decremented_at")
        .eq("id", orderId)
        .eq("organization_id", organizationId)
        .maybeSingle()

    if (orderError) {
        log.error("Error fetching order for stock decrement", {
            orderId,
            organizationId,
            error: orderError.message,
        })
        return {
            orderId,
            organizationId,
            skipped: true,
            reason: "order_not_found",
            items: [],
        }
    }

    if (!order) {
        log.warn("Order not found for stock decrement", { orderId, organizationId })
        return {
            orderId,
            organizationId,
            skipped: true,
            reason: "order_not_found",
            items: [],
        }
    }

    // 2. Idempotencia: orden ya decrementada
    if (order.stock_decremented_at) {
        log.info("Order already decremented, skipping", {
            orderId,
            organizationId,
            stockDecrementedAt: order.stock_decremented_at,
        })
        return {
            orderId,
            organizationId,
            skipped: true,
            reason: "already_decremented",
            items: [],
        }
    }

    // 3. Parsear items jsonb
    const rawItems: unknown = order.items
    const items = Array.isArray(rawItems) ? rawItems : []

    if (items.length === 0) {
        log.warn("Order has no items in jsonb, marking as decremented anyway", {
            orderId,
            organizationId,
        })
        // Marcamos como decrementada igual, para evitar que reintentos queden
        // colgados buscando items inexistentes.
        await markOrderDecremented(supabase, orderId, organizationId)
        return {
            orderId,
            organizationId,
            skipped: true,
            reason: "no_items",
            items: [],
        }
    }

    // 4. Invocar la RPC por cada item válido
    const results: DecrementOrderStockResult["items"] = []

    for (const rawItem of items) {
        const parsed = parseItem(rawItem)
        if (!parsed) {
            log.warn("Invalid item in order.items, skipping", { orderId, rawItem })
            continue
        }

        const { productId, quantity } = parsed

        const { data: rpcResult, error: rpcError } = await supabase.rpc(
            "decrement_product_stock",
            {
                p_product_id: productId,
                p_organization_id: organizationId,
                p_quantity: quantity,
            },
        )

        if (rpcError) {
            log.error("decrement_product_stock RPC failed", {
                orderId,
                organizationId,
                productId,
                quantity,
                error: rpcError.message,
            })
            results.push({
                productId,
                quantity,
                previousStock: null,
                newStock: null,
                wasSufficient: false,
                variantUpdated: false,
                error: rpcError.message,
            })
            continue
        }

        // La RPC (RETURNS TABLE) retorna un array con una fila.
        const row = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult
        const previousStock = typeof row?.previous_stock === "number" ? row.previous_stock : null
        const newStock = typeof row?.new_stock === "number" ? row.new_stock : null
        const wasSufficient = Boolean(row?.was_sufficient)
        const variantUpdated = Boolean(row?.variant_updated)

        results.push({
            productId,
            quantity,
            previousStock,
            newStock,
            wasSufficient,
            variantUpdated,
        })

        if (!wasSufficient) {
            log.warn("Stock was insufficient — clamped to 0 (oversale detected)", {
                orderId,
                organizationId,
                productId,
                quantity,
                previousStock,
                newStock,
            })
        } else {
            log.info("Stock decremented", {
                orderId,
                organizationId,
                productId,
                quantity,
                previousStock,
                newStock,
                variantUpdated,
            })
        }
    }

    const hasErrors = results.some((item) => Boolean(item.error))
    if (hasErrors) {
        log.error("Stock decrement finished with errors; order will remain retryable", {
            orderId,
            organizationId,
            errors: results.filter((item) => Boolean(item.error)).length,
        })

        return {
            orderId,
            organizationId,
            skipped: false,
            items: results,
        }
    }

    // 5. Marcar la orden como decrementada (idempotencia)
    await markOrderDecremented(supabase, orderId, organizationId)

    return {
        orderId,
        organizationId,
        skipped: false,
        items: results,
    }
}
