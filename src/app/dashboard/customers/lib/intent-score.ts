export type IntentScore = "alta" | "media" | "baja" | "riesgo"

interface IntentScoreInput {
    category: string | null
    total_orders: number
    total_spent: number
    last_interaction_at?: string | null
}

// Días sin interacción para considerar a un comprador "en riesgo" (recuperación)
const INACTIVE_DAYS_THRESHOLD = 60

/**
 * Score de intención basado en COMPORTAMIENTO real (compras, gasto, recencia)
 * más la categoría si el merchant la usa. Principio clave: un cliente que YA
 * compró nunca es "baja" — eso se reserva para leads sin compras.
 *
 *  - Riesgo: categoría de riesgo, o comprador que se enfrió (>60 días sin interactuar)
 *  - Alta:   recurrente con valor (≥3 pedidos, o ≥2 con buen gasto) o VIP/fieles 3-4
 *  - Media:  comprador activo (≥1 pedido) o categoría recurrente/fieles 1-2
 *  - Baja:   lead sin compras (aún no convierte)
 */
export function computeIntentScore(customer: IntentScoreInput): IntentScore {
    const cat = customer.category?.toLowerCase() || ""
    const orders = customer.total_orders
    const spent = customer.total_spent

    // Riesgo: marcado explícito, o comprador inactivo (sin interacción reciente)
    if (cat === "riesgo" || cat === "inactivo" || cat.includes("recuperar")) return "riesgo"
    if (orders >= 1 && customer.last_interaction_at) {
        const daysSince = (Date.now() - new Date(customer.last_interaction_at).getTime()) / 86_400_000
        if (Number.isFinite(daysSince) && daysSince > INACTIVE_DAYS_THRESHOLD) return "riesgo"
    }

    // Alta: recurrente con valor o VIP
    if (cat === "vip" || cat.includes("fieles 4") || cat.includes("fieles 3")) return "alta"
    if (orders >= 3) return "alta"
    if (orders >= 2 && spent > 300000) return "alta"

    // Media: comprador activo (al menos 1 compra) — un cliente NO es "baja"
    if (orders >= 1) return "media"
    if (cat === "recurrente" || cat.includes("fieles 2") || cat.includes("fieles 1")) return "media"

    // Baja: lead sin compras
    return "baja"
}

export function getIntentScoreLabel(score: IntentScore): string {
    const labels: Record<IntentScore, string> = {
        alta: "Alta",
        media: "Media",
        baja: "Baja",
        riesgo: "Riesgo",
    }
    return labels[score]
}

export function getIntentScoreColor(score: IntentScore): string {
    const colors: Record<IntentScore, string> = {
        alta: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800",
        media: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
        baja: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800",
        riesgo: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800",
    }
    return colors[score]
}

export function getIntentScoreIcon(score: IntentScore): string {
    const icons: Record<IntentScore, string> = {
        alta: "local_fire_department",
        media: "trending_flat",
        baja: "remove",
        riesgo: "priority_high",
    }
    return icons[score]
}
