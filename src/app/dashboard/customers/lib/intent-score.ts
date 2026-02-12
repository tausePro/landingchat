export type IntentScore = "alta" | "media" | "baja" | "riesgo"

interface IntentScoreInput {
    category: string | null
    total_orders: number
    total_spent: number
    last_interaction_at?: string | null
}

/**
 * Calcula el score de intención de compra basado en categoría,
 * historial de compras y actividad reciente.
 */
export function computeIntentScore(customer: IntentScoreInput): IntentScore {
    const cat = customer.category?.toLowerCase() || ""

    // Riesgo: explícitamente marcados o inactivos
    if (cat === "riesgo" || cat === "inactivo" || cat.includes("recuperar")) return "riesgo"

    // Alta: VIP, fieles 3-4, o alto gasto con actividad
    if (cat === "vip" || cat.includes("fieles 4") || cat.includes("fieles 3")) return "alta"
    if (customer.total_orders >= 5 && customer.total_spent > 500000) return "alta"

    // Media: recurrente, fieles 1-2, o con historial de compras
    if (cat === "recurrente" || cat.includes("fieles 2") || cat.includes("fieles 1")) return "media"
    if (customer.total_orders >= 2) return "media"

    // Baja: nuevo o sin historial
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
