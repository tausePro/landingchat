/**
 * Avisos al merchant en los 3 momentos del ciclo de suspensión:
 *  - "scheduled":   se programó una suspensión → se avisa la fecha.
 *  - "executed":    la suspensión ocurrió → la tienda quedó fuera.
 *  - "reactivated": el pago reactivó la cuenta.
 *
 * Un único entry point `notifyMerchantSuspension` que resuelve la org por id,
 * arma el copy (es/en) y despacha email (Resend) + WhatsApp (notifyMerchant).
 *
 * Contrato: BEST-EFFORT — NUNCA lanza (no debe romper el flujo que lo invoca:
 * server action de admin, cron, webhook de pago).
 *
 * `createServiceClient` justificado: corre sin sesión de usuario (cron/webhook/
 * admin action) y solo lee campos de la org por el id recibido.
 */

import { createServiceClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { notifyMerchant } from "./notify-merchant"
import { logNotification } from "./log"
import { sendSuspensionNoticeEmail } from "./email"
import type { SupportedLocale } from "@/types/organization"

const log = logger("suspension-notices")

export type SuspensionNoticeType = "scheduled" | "executed" | "reactivated"

const DASHBOARD_URL = "https://landingchat.co/dashboard"
const REACTIVATE_URL = "https://landingchat.co/dashboard/subscription/reactivate"

export interface SuspensionNoticeCopy {
    emailSubject: string
    heading: string
    body: string
    ctaLabel: string
    ctaUrl: string
    whatsapp: string
}

/** Formatea la fecha de suspensión en hora de Colombia (evita el bug de TZ). */
export function formatSuspensionDate(iso: string, locale: SupportedLocale): string {
    try {
        return new Intl.DateTimeFormat(locale === "en-US" ? "en-US" : "es-CO", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "America/Bogota",
        }).format(new Date(iso))
    } catch {
        return iso
    }
}

/** Copy centralizado (email + WhatsApp comparten el mismo mensaje por tipo/locale). */
export function buildSuspensionCopy(
    type: SuspensionNoticeType,
    locale: SupportedLocale,
    vars: { name: string; dateText: string }
): SuspensionNoticeCopy {
    const en = locale === "en-US"
    const { name, dateText } = vars

    if (type === "scheduled") {
        return en
            ? {
                emailSubject: `Your account will be suspended on ${dateText}`,
                heading: `Your account will be suspended on ${dateText}`,
                body: `Hi, ${name}. Your LandingChat account is scheduled to be suspended on ${dateText} due to a pending payment. To keep your store online, please settle it before that date from your dashboard.`,
                ctaLabel: "Go to my dashboard",
                ctaUrl: DASHBOARD_URL,
                whatsapp: `Hi ${name} 👋 Your LandingChat account will be suspended on ${dateText} due to a pending payment. Settle it before then from your dashboard to avoid interruption: ${DASHBOARD_URL}`,
            }
            : {
                emailSubject: `Tu cuenta se suspenderá el ${dateText}`,
                heading: `Tu cuenta se suspenderá el ${dateText}`,
                body: `Hola, ${name}. Tu cuenta en LandingChat quedará suspendida el ${dateText} por un pago pendiente. Para que tu tienda siga disponible, ponte al día antes de esa fecha desde tu panel.`,
                ctaLabel: "Ir a mi panel",
                ctaUrl: DASHBOARD_URL,
                whatsapp: `Hola ${name} 👋 Tu cuenta en LandingChat se suspenderá el ${dateText} por un pago pendiente. Ponte al día antes de esa fecha desde tu panel para evitar la interrupción: ${DASHBOARD_URL}`,
            }
    }

    if (type === "executed") {
        return en
            ? {
                emailSubject: "Your account has been suspended",
                heading: "Your account has been suspended",
                body: `Hi, ${name}. Your LandingChat account has been suspended due to a pending payment, so your store is currently unavailable. You can reactivate it right away by paying from your dashboard.`,
                ctaLabel: "Reactivate my account",
                ctaUrl: REACTIVATE_URL,
                whatsapp: `Hi ${name}. Your LandingChat account has been suspended due to a pending payment and your store is offline for now. You can reactivate it instantly by paying here: ${REACTIVATE_URL}`,
            }
            : {
                emailSubject: "Tu cuenta fue suspendida",
                heading: "Tu cuenta fue suspendida",
                body: `Hola, ${name}. Tu cuenta en LandingChat fue suspendida por un pago pendiente, así que tu tienda no está disponible por ahora. Puedes reactivarla al instante pagando desde tu panel.`,
                ctaLabel: "Reactivar mi cuenta",
                ctaUrl: REACTIVATE_URL,
                whatsapp: `Hola ${name}. Tu cuenta en LandingChat fue suspendida por un pago pendiente y tu tienda está fuera por ahora. Puedes reactivarla al instante pagando aquí: ${REACTIVATE_URL}`,
            }
    }

    // reactivated
    return en
        ? {
            emailSubject: "Your account is active again",
            heading: "Your account is active again 🎉",
            body: `All set, ${name}! We received your payment and your LandingChat account is active again. Your store is back online. Thanks for staying with us.`,
            ctaLabel: "Go to my dashboard",
            ctaUrl: DASHBOARD_URL,
            whatsapp: `All set, ${name}! 🎉 We received your payment and your LandingChat account is active again. Your store is back online. Thank you!`,
        }
        : {
            emailSubject: "Tu cuenta está activa de nuevo",
            heading: "¡Tu cuenta está activa de nuevo! 🎉",
            body: `¡Listo, ${name}! Recibimos tu pago y tu cuenta en LandingChat está activa de nuevo. Tu tienda ya volvió a estar disponible. Gracias por seguir con nosotros.`,
            ctaLabel: "Ir a mi panel",
            ctaUrl: DASHBOARD_URL,
            whatsapp: `¡Listo, ${name}! 🎉 Recibimos tu pago y tu cuenta en LandingChat está activa de nuevo. Tu tienda ya volvió a estar disponible. ¡Gracias!`,
        }
}

export async function notifyMerchantSuspension(params: {
    organizationId: string
    type: SuspensionNoticeType
    /** Requerido para "scheduled" (la fecha que se comunica). */
    suspendAt?: string | null
}): Promise<void> {
    const { organizationId, type, suspendAt } = params
    try {
        const supabase = createServiceClient()
        const { data: org } = await supabase
            .from("organizations")
            .select("name, contact_email, notification_emails, locale")
            .eq("id", organizationId)
            .single()

        if (!org) {
            log.warn("org not found for suspension notice", { organizationId, type })
            return
        }

        const locale: SupportedLocale = org.locale === "en-US" ? "en-US" : "es-CO"
        const name = org.name ?? (locale === "en-US" ? "your store" : "tu tienda")
        const dateText = suspendAt ? formatSuspensionDate(suspendAt, locale) : ""
        const copy = buildSuspensionCopy(type, locale, { name, dateText })

        // Email (Resend) — log manual (no lo hace la fn de email).
        const emailResult = await sendSuspensionNoticeEmail({
            ownerEmail: org.contact_email ?? "",
            additionalEmails: org.notification_emails ?? [],
            subject: copy.emailSubject,
            heading: copy.heading,
            body: copy.body,
            ctaLabel: copy.ctaLabel,
            ctaUrl: copy.ctaUrl,
            organizationName: name,
        })
        await logNotification({
            organizationId,
            kind: `suspension_${type}`,
            channel: "email",
            recipientType: "owner",
            status: emailResult.status,
            channelUsed: "resend",
            error: emailResult.error ?? null,
            metadata: { type },
        })

        // WhatsApp — notifyMerchant persiste su propio log (kind "system").
        await notifyMerchant({
            organizationId,
            message: copy.whatsapp,
            kind: "system",
        })
    } catch (error) {
        log.error("notifyMerchantSuspension failed", {
            organizationId,
            type,
            error: error instanceof Error ? error.message : "unknown",
        })
    }
}
