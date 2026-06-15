/**
 * Vertical del negocio para el copilot (fix 2026-06-15, reporte Casa
 * Inmobiliaria): Atlas medía a TODOS con vara de e-commerce ("semana sin
 * ventas") cuando inmobiliarias y servicios se miden por ATENCIÓN +
 * CITAS, no por órdenes/ingresos.
 *
 * Señal: organizations.industry + enabled_modules.
 */

export type CopilotVertical = "commerce" | "real_estate" | "services"

interface VerticalSignal {
    industry?: string | null
    enabled_modules?: string[] | null
}

/**
 * Deriva el vertical primario:
 * - real_estate: industry real_estate, o módulo properties (visitas a inmuebles).
 * - services: agenda citas pero NO vende productos (servicios puros).
 * - commerce: vende productos (default). Híbridos (ej. Tantor: ecommerce +
 *   citas) quedan en commerce, pero las métricas incluyen citas igual.
 */
export function deriveVertical(org: VerticalSignal): CopilotVertical {
    const industry = (org.industry ?? "").toLowerCase()
    const modules = org.enabled_modules ?? []
    const has = (m: string) => modules.includes(m)

    if (industry.includes("real_estate") || industry.includes("inmobil") || has("properties")) {
        return "real_estate"
    }
    const sellsProducts = has("products") || has("orders")
    if (has("appointments") && !sellsProducts) {
        return "services"
    }
    return "commerce"
}

/** true si el vertical se mide por atención + citas (no por ventas). */
export function isAppointmentFirst(vertical: CopilotVertical): boolean {
    return vertical === "real_estate" || vertical === "services"
}
