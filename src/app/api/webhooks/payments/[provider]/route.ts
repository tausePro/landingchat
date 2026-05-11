/**
 * Handler dinámico de webhooks de pagos.
 *
 * Una sola ruta atiende a todos los providers vía el segmento `[provider]`.
 *
 * Flujo:
 *   1. Identifica el provider del path (`/api/webhooks/payments/{wompi|epayco|bold|addi}`)
 *   2. Lee `?org=<slug>` del query string
 *   3. Carga la organización y su `payment_gateway_configs` para ese provider
 *   4. Construye el gateway via `PROVIDER_REGISTRY` con los secrets desencriptados
 *   5. Delega a `gateway.parseWebhook(request)` para obtener el `WebhookEvent`
 *   6. Si el evento es válido, llama a `processWebhookEvent(...)` que persiste y aplica el estado
 *
 * Para agregar un nuevo provider basta con registrarlo en `PROVIDER_REGISTRY`.
 *
 * Soporta GET y POST:
 *   - ePayco usa GET o POST dependiendo de `method_confirmation`
 *   - Wompi y Bold usan POST
 */

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { decrypt } from "@/lib/utils/encryption"
import { logger } from "@/lib/logger"
import { getProviderInfo } from "@/lib/payments/registry"
import { processWebhookEvent, logWebhook } from "@/lib/payments/webhook-processor"
import type { GatewayConfig, PaymentGateway } from "@/lib/payments/types"

const log = logger("webhooks/payments/dynamic")

interface RouteContext {
    params: Promise<{ provider: string }>
}

async function loadGatewayForOrg(
    supabase: ReturnType<typeof createServiceClient>,
    providerId: string,
    orgSlug: string,
): Promise<{ gateway: PaymentGateway | null; orgId: string | null; error?: string; httpStatus?: number }> {
    const providerInfo = getProviderInfo(providerId)
    if (!providerInfo) {
        return { gateway: null, orgId: null, error: `Unknown provider: ${providerId}`, httpStatus: 404 }
    }

    const { data: org } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", orgSlug)
        .single()

    if (!org) {
        return { gateway: null, orgId: null, error: "Organization not found", httpStatus: 404 }
    }

    const { data: config } = await supabase
        .from("payment_gateway_configs")
        .select("*")
        .eq("organization_id", org.id)
        .eq("provider", providerId)
        .single()

    if (!config) {
        return { gateway: null, orgId: org.id, error: "Payment gateway not configured", httpStatus: 400 }
    }

    // Para Wompi: usamos `events_secret` como el secret de validación de firmas (no el de integridad)
    let webhookSecret = ""
    if (providerId === "wompi") {
        const eventsSecretEncrypted = (config as Record<string, unknown>).events_secret_encrypted as string | null | undefined
        if (eventsSecretEncrypted) {
            try {
                webhookSecret = decrypt(eventsSecretEncrypted)
            } catch (error) {
                log.error("Failed to decrypt Wompi events_secret", { orgId: org.id, error: error instanceof Error ? error.message : String(error) })
            }
        }
    } else {
        // ePayco y Bold usan integrity_secret_encrypted como secret principal del webhook
        if (config.integrity_secret_encrypted) {
            try {
                webhookSecret = decrypt(config.integrity_secret_encrypted)
            } catch (error) {
                log.error("Failed to decrypt integrity secret", { provider: providerId, orgId: org.id, error: error instanceof Error ? error.message : String(error) })
            }
        }
    }

    let privateKey = ""
    if (config.private_key_encrypted) {
        try {
            privateKey = decrypt(config.private_key_encrypted)
        } catch {
            // No bloquea el webhook: privateKey solo se usa para llamadas server-to-server
        }
    }

    const gatewayConfig: GatewayConfig = {
        provider: providerInfo.id,
        publicKey: config.public_key || "",
        privateKey,
        integritySecret: webhookSecret,
        isTestMode: Boolean(config.is_test_mode),
    }

    return { gateway: providerInfo.create(gatewayConfig), orgId: org.id }
}

async function handleWebhook(request: Request, providerId: string): Promise<NextResponse> {
    const startedAt = Date.now()
    const supabase = createServiceClient()

    const url = new URL(request.url)
    const orgSlug = url.searchParams.get("org")

    if (!orgSlug) {
        await logWebhook(supabase, providerId, "error", null, { error: "Missing org parameter" })
        return NextResponse.json({ error: "Missing org parameter" }, { status: 400 })
    }

    const { gateway, orgId, error, httpStatus } = await loadGatewayForOrg(supabase, providerId, orgSlug)
    if (!gateway || !orgId) {
        await logWebhook(supabase, providerId, "error", null, { error, orgSlug })
        return NextResponse.json({ error }, { status: httpStatus || 400 })
    }

    let parsed
    try {
        parsed = await gateway.parseWebhook(request)
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown parseWebhook error"
        log.error("parseWebhook threw", { provider: providerId, orgSlug, error: message })
        await logWebhook(supabase, providerId, "error", null, { error: message })
        return NextResponse.json({ error: message }, { status: 500 })
    }

    if (!parsed.isValid || !parsed.event) {
        await logWebhook(supabase, providerId, "error", null, {
            error: parsed.error || "Invalid webhook",
            orgSlug,
        })
        return NextResponse.json({ error: parsed.error || "Invalid webhook" }, { status: parsed.httpStatus || 400 })
    }

    return processWebhookEvent({
        supabase,
        provider: parsed.event.provider,
        organizationId: orgId,
        event: parsed.event,
        rawPayload: parsed.event.rawPayload,
        startedAt,
    })
}

export async function POST(request: Request, context: RouteContext) {
    const { provider } = await context.params
    return handleWebhook(request, provider)
}

export async function GET(request: Request, context: RouteContext) {
    const { provider } = await context.params
    return handleWebhook(request, provider)
}
