/**
 * Emisor de platform_events (backbone event-sourced del copilot).
 *
 * `createServiceClient()` justificado: los eventos se emiten desde paths
 * server-side donde no siempre hay contexto de usuario (cron, webhook).
 * El `organization_id` SIEMPRE llega explícito del caller — nunca
 * hardcodeado — y la tabla solo expone SELECT vía RLS por org.
 *
 * Spec: .kiro/specs/copilot-merchant-loop-v0/design.md §2.3
 */

import { createServiceClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import type { PlatformEventType, PlatformEventSource } from "./platform-event-types"

const log = logger("platform_events")

export interface EmitPlatformEventInput {
    organizationId: string
    eventType: PlatformEventType
    source: PlatformEventSource
    payload?: Record<string, unknown>
    actorId?: string
    idempotencyKey?: string
    occurredAt?: Date
}

export interface EmitPlatformEventResult {
    ok: boolean
    /** true si el idempotency_key ya existía (el caller puede deduplicar). */
    duplicate?: boolean
    error?: string
}

/**
 * Emite un platform_event. Best-effort: NO falla el flow del caller si la
 * inserción falla (loguea y retorna `{ ok: false }`); el caller decide si
 * reintenta. Un conflicto de idempotencia (23505) se trata como éxito.
 */
export async function emitPlatformEvent(input: EmitPlatformEventInput): Promise<EmitPlatformEventResult> {
    try {
        const supabase = createServiceClient()
        const { error } = await supabase.from("platform_events").insert({
            organization_id: input.organizationId,
            event_type: input.eventType,
            source: input.source,
            payload: input.payload ?? {},
            actor_id: input.actorId ?? "system",
            idempotency_key: input.idempotencyKey ?? null,
            occurred_at: (input.occurredAt ?? new Date()).toISOString(),
        })

        if (error) {
            // Conflicto de idempotencia: el evento ya existe — no es error real
            if (error.code === "23505") return { ok: true, duplicate: true }

            log.error("insert failed", { eventType: input.eventType, error: error.message })
            return { ok: false, error: error.message }
        }

        return { ok: true }
    } catch (e) {
        const message = e instanceof Error ? e.message : "unknown"
        log.error("unexpected error", { eventType: input.eventType, message })
        return { ok: false, error: message }
    }
}
