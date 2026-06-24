import { describe, it, expect } from "vitest"
import { aggregateAffiliateStats } from "@/lib/affiliates/stats"

describe("aggregateAffiliateStats", () => {
    it("cuenta referidos totales y convertidos", () => {
        const stats = aggregateAffiliateStats(
            [{ status: "pending" }, { status: "converted" }, { status: "converted" }],
            [],
        )
        expect(stats.referralsTotal).toBe(3)
        expect(stats.referralsConverted).toBe(2)
    })

    it("suma comisiones por estado", () => {
        const stats = aggregateAffiliateStats(
            [],
            [
                { status: "pending", amount: 20000 },
                { status: "pending", amount: 5000 },
                { status: "approved", amount: 10000 },
                { status: "paid", amount: "7500" },
            ],
        )
        expect(stats.pendingCount).toBe(2)
        expect(stats.pendingAmount).toBe(25000)
        expect(stats.approvedAmount).toBe(10000)
        expect(stats.paidCount).toBe(1)
        expect(stats.paidAmount).toBe(7500)
    })

    it("maneja listas vacías", () => {
        const stats = aggregateAffiliateStats([], [])
        expect(stats.referralsTotal).toBe(0)
        expect(stats.pendingAmount).toBe(0)
    })
})
