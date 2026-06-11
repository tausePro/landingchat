/**
 * Prompt del insight semanal (locale-aware).
 *
 * El LLM recibe SOLO métricas agregadas deterministas — nunca PII más allá
 * de nombres de producto. La instrucción anti-alucinación es explícita:
 * no inventar nombres que no estén en el contexto.
 *
 * Spec: .kiro/specs/copilot-merchant-loop-v0/design.md §3.3
 */

import type { SupportedLocale } from "@/types/organization"
import type { WeeklyMetrics } from "../weeklyMetrics"

export function buildWeeklyInsightPrompt(metrics: WeeklyMetrics, locale: SupportedLocale): string {
    const lang = locale === "en-US" ? "English" : "Spanish (LATAM)"
    const topViewed = metrics.topProductsViewed[0]

    return `
You are Atlas Copilot, an e-commerce operator assistant for LATAM merchants.
Respond ONLY in ${lang}.

CONTEXT — week ${metrics.weekStart.toISOString().slice(0, 10)} to ${metrics.weekEnd.toISOString().slice(0, 10)}:
- Orders: ${metrics.orders.count} (prev week: ${metrics.ordersPrev.count})
- Revenue: ${metrics.orders.revenue} (prev week: ${metrics.ordersPrev.revenue})
- Avg ticket (paid orders): ${metrics.orders.ticketAvg}
- Conversations: ${metrics.conversations.count} (${metrics.conversations.whatsappPct}% via WhatsApp; prev week: ${metrics.conversationsPrev.count})
- Abandoned carts: ${metrics.cartsAbandoned.length}
- Inactive customers (>21d since last order): ${metrics.inactiveCustomers.length}
- Top viewed product: ${topViewed?.name ?? "n/a"} (${topViewed?.views ?? 0} views, ${topViewed?.conversions ?? 0} conversions)
- Top converted products: ${metrics.topProductsConverted.map((product) => `${product.name} (${product.orders} orders, ${product.revenue})`).join("; ") || "n/a"}

TASK:
Produce a JSON object with shape:
{
  "title": "<≤80 chars headline>",
  "body": "<markdown summary, ≤500 words, with bullet points>",
  "proposed_actions": [
    { "kind": "<one of send_coupon_to_customers|pause_product|enable_product|notify_owner>",
      "human_label": "<≤120 chars action description>",
      "requires_approval": true,
      "params": { ... params shape per kind ... }
    }
  ],
  "metrics_snapshot": { ... echo of key metrics ... }
}

CONSTRAINTS:
- 3 to 5 proposed_actions max, each on a distinct insight.
- Use only the action kinds listed.
- Do not invent customer names or product names that are not in the context.
- If the data is too thin (e.g. <5 orders), output a single insight asking the merchant for context, no actions.

Return JSON only, no markdown fences.
`.trim()
}
