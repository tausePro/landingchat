/**
 * Tests de los avisos de suspensión/reactivación al merchant.
 * - Copy puro (buildSuspensionCopy) por tipo × locale + fecha en hora de Colombia.
 * - Orquestación (notifyMerchantSuspension): email + WhatsApp + log, best-effort.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const singleMock = vi.fn()
vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: () => ({
        from: () => ({
            select: () => ({
                eq: () => ({ single: singleMock }),
            }),
        }),
    }),
}))

const sendEmailMock = vi.fn()
vi.mock("@/lib/notifications/email", () => ({
    sendSuspensionNoticeEmail: (...args: unknown[]) => sendEmailMock(...args),
}))

const notifyMerchantMock = vi.fn()
vi.mock("@/lib/notifications/notify-merchant", () => ({
    notifyMerchant: (...args: unknown[]) => notifyMerchantMock(...args),
}))

const logMock = vi.fn()
vi.mock("@/lib/notifications/log", () => ({
    logNotification: (...args: unknown[]) => logMock(...args),
}))

import {
    buildSuspensionCopy,
    formatSuspensionDate,
    notifyMerchantSuspension,
} from "@/lib/notifications/suspension-notices"

describe("buildSuspensionCopy", () => {
    const vars = { name: "Quality Pets", dateText: "14 de julio de 2026" }

    it("scheduled/es: incluye la fecha y CTA al panel", () => {
        const c = buildSuspensionCopy("scheduled", "es-CO", vars)
        expect(c.emailSubject).toContain("14 de julio de 2026")
        expect(c.body).toContain("Quality Pets")
        expect(c.whatsapp).toContain("14 de julio de 2026")
        expect(c.ctaUrl).toContain("/dashboard")
    })

    it("executed/es: CTA a reactivar + habla de suspensión", () => {
        const c = buildSuspensionCopy("executed", "es-CO", vars)
        expect(c.ctaUrl).toContain("/reactivate")
        expect(c.body.toLowerCase()).toContain("suspendida")
    })

    it("reactivated/es: mensaje positivo de cuenta activa", () => {
        const c = buildSuspensionCopy("reactivated", "es-CO", vars)
        expect(c.body).toContain("activa de nuevo")
        expect(c.ctaUrl).toContain("/dashboard")
    })

    it("en-US: copy en inglés", () => {
        const c = buildSuspensionCopy("scheduled", "en-US", vars)
        expect(c.emailSubject).toContain("suspended")
        expect(c.ctaLabel).toBe("Go to my dashboard")
    })
})

describe("formatSuspensionDate", () => {
    it("formatea en hora de Colombia (no UTC)", () => {
        // 2026-07-15T04:59Z = 2026-07-14 23:59 en Bogotá (UTC-5) → día 14, no 15
        const s = formatSuspensionDate("2026-07-15T04:59:00Z", "es-CO")
        expect(s).toContain("14")
        expect(s).toContain("julio")
    })
})

describe("notifyMerchantSuspension", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        singleMock.mockResolvedValue({
            data: { name: "Quality Pets", contact_email: "owner@qp.co", notification_emails: ["extra@qp.co"], locale: "es-CO" },
        })
        sendEmailMock.mockResolvedValue({ status: "sent" })
        notifyMerchantMock.mockResolvedValue({ delivered: true, channel: "platform" })
    })

    it("scheduled: envía email (con recipientes) + WhatsApp system + loguea el email", async () => {
        await notifyMerchantSuspension({ organizationId: "org-1", type: "scheduled", suspendAt: "2026-07-15T04:59:00Z" })

        expect(sendEmailMock).toHaveBeenCalledOnce()
        const emailArg = sendEmailMock.mock.calls[0][0] as { ownerEmail: string; additionalEmails: string[]; subject: string }
        expect(emailArg.ownerEmail).toBe("owner@qp.co")
        expect(emailArg.additionalEmails).toEqual(["extra@qp.co"])
        expect(emailArg.subject.toLowerCase()).toContain("suspender")

        expect(notifyMerchantMock).toHaveBeenCalledWith(
            expect.objectContaining({ organizationId: "org-1", kind: "system" })
        )
        expect(logMock).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "suspension_scheduled", channel: "email", status: "sent" })
        )
    })

    it("org inexistente: no envía nada y no lanza", async () => {
        singleMock.mockResolvedValue({ data: null })
        await expect(
            notifyMerchantSuspension({ organizationId: "missing", type: "executed" })
        ).resolves.toBeUndefined()
        expect(sendEmailMock).not.toHaveBeenCalled()
        expect(notifyMerchantMock).not.toHaveBeenCalled()
    })
})
