export interface AffiliateStats {
    referralsTotal: number
    referralsConverted: number
    pendingCount: number
    pendingAmount: number
    approvedCount: number
    approvedAmount: number
    paidCount: number
    paidAmount: number
}

/** Agrega referidos (total/convertidos) y comisiones (conteo + monto por estado). */
export function aggregateAffiliateStats(
    referrals: Array<{ status: string }>,
    commissions: Array<{ status: string; amount: number | string }>,
): AffiliateStats {
    const stats: AffiliateStats = {
        referralsTotal: referrals.length,
        referralsConverted: referrals.filter((r) => r.status === "converted").length,
        pendingCount: 0,
        pendingAmount: 0,
        approvedCount: 0,
        approvedAmount: 0,
        paidCount: 0,
        paidAmount: 0,
    }
    for (const commission of commissions) {
        const amount = Number(commission.amount) || 0
        if (commission.status === "pending") {
            stats.pendingCount++
            stats.pendingAmount += amount
        } else if (commission.status === "approved") {
            stats.approvedCount++
            stats.approvedAmount += amount
        } else if (commission.status === "paid") {
            stats.paidCount++
            stats.paidAmount += amount
        }
    }
    return stats
}
