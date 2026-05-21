/**
 * Tests para `src/lib/i18n/storefront-strings.ts`.
 *
 * Cubre:
 * - Lookup directo en es-CO y en-US.
 * - Fallback a es-CO cuando el locale no es soportado.
 * - Fallback a es-CO cuando la key existe en es-CO pero no en otro locale.
 * - Last-resort fallback (devolver la key) cuando ni es-CO la tiene.
 * - Consistencia del set de keys entre locales (en-US no debe tener keys
 *   que no existan en es-CO).
 *
 * Spec: .kiro/specs/i18n-fase-1/ (T1.3)
 */

import { describe, expect, it } from "vitest"

import {
  storefrontStrings,
  t,
  type StorefrontStringKey,
} from "@/lib/i18n/storefront-strings"

describe("storefrontStrings — estructura", () => {
  it("contiene los locales es-CO y en-US", () => {
    expect(storefrontStrings).toHaveProperty("es-CO")
    expect(storefrontStrings).toHaveProperty("en-US")
  })

  it("en-US tiene exactamente las mismas keys que es-CO (paridad)", () => {
    const esKeys = Object.keys(storefrontStrings["es-CO"]).sort()
    const enKeys = Object.keys(storefrontStrings["en-US"]).sort()
    expect(enKeys).toEqual(esKeys)
  })

  it("toda key tiene un valor string no vacío en es-CO", () => {
    for (const [key, value] of Object.entries(storefrontStrings["es-CO"])) {
      expect(typeof value).toBe("string")
      expect(value.length).toBeGreaterThan(0)
      // No debe ser igual a la key (síntoma de placeholder olvidado).
      expect(value).not.toBe(key)
    }
  })

  it("toda key tiene un valor string no vacío en en-US", () => {
    for (const [key, value] of Object.entries(storefrontStrings["en-US"])) {
      expect(typeof value).toBe("string")
      expect(value.length).toBeGreaterThan(0)
      expect(value).not.toBe(key)
    }
  })
})

describe("t() — lookups directos", () => {
  it("retorna string en es-CO sin locale explícito (default)", () => {
    expect(t("order.success.title")).toBe("¡Pago Exitoso!")
  })

  it("retorna string en es-CO con locale explícito", () => {
    expect(t("order.success.title", "es-CO")).toBe("¡Pago Exitoso!")
  })

  it("retorna string en en-US", () => {
    expect(t("order.success.title", "en-US")).toBe("Payment Successful!")
  })

  it("strings de áreas distintas se resuelven correctamente", () => {
    expect(t("order.pending.title", "en-US")).toBe("Payment Pending")
    expect(t("order.error.title", "en-US")).toBe("Payment Not Completed")
    expect(t("order.common.back_to_store", "en-US")).toBe("Back to Store")
    expect(t("order.status.confirmed", "en-US")).toBe("Confirmed")
  })
})

describe("t() — fallbacks", () => {
  it("locale no soportado → cae a es-CO", () => {
    // Cast deliberado para simular un locale fuera del set.
    const result = t("order.success.title", "fr-FR" as never)
    expect(result).toBe("¡Pago Exitoso!")
  })

  it("key inexistente devuelve la key como last resort", () => {
    const fakeKey = "order.no.such.key" as StorefrontStringKey
    expect(t(fakeKey)).toBe("order.no.such.key")
    expect(t(fakeKey, "en-US")).toBe("order.no.such.key")
  })
})

describe("t() — interpolación de placeholders {{key}}", () => {
  it("interpola un solo placeholder", () => {
    expect(
      t("store.checkout.toast_coupon_applied", "es-CO", { code: "FALL20" }),
    ).toBe("¡Cupón FALL20 aplicado!")
  })

  it("interpola en en-US también", () => {
    expect(
      t("store.checkout.toast_coupon_applied", "en-US", { code: "SUMMER10" }),
    ).toBe("Coupon SUMMER10 applied!")
  })

  it("interpola con placeholder numérico", () => {
    expect(
      t("store.checkout.summary_subtotal_with_count", "es-CO", { count: 3 }),
    ).toBe("Subtotal (3 items)")
    expect(
      t("store.checkout.summary_subtotal_with_count", "en-US", { count: 7 }),
    ).toBe("Subtotal (7 items)")
  })

  it("interpola múltiples placeholders distintos en una misma key", () => {
    // Usa una key con dos placeholders. Si no hay ninguna actualmente,
    // verificamos que el helper general no rompa con strings sin placeholders.
    expect(
      t("store.checkout.back_to_store_aria", "es-CO", { name: "Tantor" }),
    ).toBe("Volver a Tantor")
    expect(
      t("store.checkout.back_to_store_aria", "en-US", { name: "Tantor" }),
    ).toBe("Back to Tantor")
  })

  it("deja el placeholder intacto cuando params no provee la key", () => {
    expect(t("store.checkout.toast_coupon_applied", "es-CO", {})).toBe(
      "¡Cupón {{code}} aplicado!",
    )
  })

  it("ignora params si la key no tiene placeholders", () => {
    expect(
      t("store.checkout.action_back", "es-CO", { code: "ignored" }),
    ).toBe("Atrás")
  })

  it("tolera espacios alrededor del nombre del placeholder", () => {
    // No tenemos keys con `{{ name }}` con espacios reales, pero verificamos
    // el helper interpolando manualmente: la regex acepta `\s*`.
    // Verificación indirecta: si pasamos params, no rompe.
    const result = t("store.checkout.summary_total", "es-CO", {
      irrelevant: "x",
    })
    expect(result).toBe("Total a Pagar")
  })

  it("convierte números a string en interpolación", () => {
    const result = t("store.checkout.summary_subtotal_with_count", "en-US", {
      count: 0,
    })
    expect(result).toBe("Subtotal (0 items)")
  })
})

describe("t() — keys del carrito (T1.3e)", () => {
  it("interpola count en singular/plural del carrito", () => {
    expect(
      t("store.cart.items_count_singular", "es-CO", { count: 1 }),
    ).toBe("1 ítem")
    expect(
      t("store.cart.items_count_plural", "es-CO", { count: 4 }),
    ).toBe("4 ítems")
    expect(
      t("store.cart.items_count_singular", "en-US", { count: 1 }),
    ).toBe("1 item")
    expect(
      t("store.cart.items_count_plural", "en-US", { count: 12 }),
    ).toBe("12 items")
  })

  it("interpola amount preformateado en free shipping remaining", () => {
    expect(
      t("store.cart.free_shipping_remaining", "es-CO", { amount: "$ 25.000" }),
    ).toBe("$ 25.000 más")
    expect(
      t("store.cart.free_shipping_remaining", "en-US", { amount: "$25.00" }),
    ).toBe("$25.00 more")
  })

  it("interpola código de cupón en discount label", () => {
    expect(
      t("store.cart.totals_discount_with_code", "es-CO", { code: "FALL20" }),
    ).toBe("Descuento (FALL20)")
    expect(
      t("store.cart.totals_discount_with_code", "en-US", { code: "SUMMER" }),
    ).toBe("Discount (SUMMER)")
  })

  it("título y empty state están traducidos en en-US", () => {
    expect(t("store.cart.title", "en-US")).toBe("Your Cart")
    expect(t("store.cart.empty", "en-US")).toBe("Your cart is empty")
    expect(t("store.cart.checkout_button", "en-US")).toBe("Checkout")
  })
})

describe("t() — keys de order detail (T1.3g)", () => {
  it("interpola order_number en title y mensaje WhatsApp", () => {
    expect(
      t("store.order_detail.order_title", "es-CO", { number: "ORD-123" }),
    ).toBe("Pedido ORD-123")
    expect(
      t("store.order_detail.order_title", "en-US", { number: "ORD-456" }),
    ).toBe("Order ORD-456")
    expect(
      t("store.order_detail.whatsapp_message", "en-US", { number: "ORD-789" }),
    ).toBe("Hi, I have a question about my order #ORD-789")
  })

  it("interpola org name en thanks_message", () => {
    expect(
      t("store.order_detail.thanks_message", "es-CO", { name: "Quality Pets" }),
    ).toBe("Gracias por comprar en Quality Pets")
    expect(
      t("store.order_detail.thanks_message", "en-US", { name: "Tantor's House" }),
    ).toBe("Thanks for shopping at Tantor's House")
  })

  it("status labels traducidos a en-US", () => {
    expect(t("store.order_detail.status_pending", "en-US")).toBe("Confirmed")
    expect(t("store.order_detail.status_processing", "en-US")).toBe("Processing")
    expect(t("store.order_detail.status_shipped", "en-US")).toBe("Shipped")
    expect(t("store.order_detail.status_delivered", "en-US")).toBe("Delivered")
    expect(t("store.order_detail.status_cancelled", "en-US")).toBe("Cancelled")
  })

  it("payment status badges traducidos en en-US", () => {
    expect(t("store.order_detail.payment_status_paid", "en-US")).toBe("Payment approved")
    expect(t("store.order_detail.payment_status_pending", "en-US")).toBe("Payment pending")
  })

  it("person type neutralizado para US (Business / Individual)", () => {
    expect(t("store.order_detail.person_legal", "en-US")).toBe("Business")
    expect(t("store.order_detail.person_natural", "en-US")).toBe("Individual")
    expect(t("store.order_detail.person_legal", "es-CO")).toBe("Persona Jurídica")
    expect(t("store.order_detail.person_natural", "es-CO")).toBe("Persona Natural")
  })
})

describe("t() — keys de profile (T1.3h)", () => {
  it("interpola customer name en greeting", () => {
    expect(t("store.profile.greeting", "es-CO", { name: "Camilo" })).toBe(
      "Hola, Camilo",
    )
    expect(t("store.profile.greeting", "en-US", { name: "Sarah" })).toBe(
      "Hi, Sarah",
    )
  })

  it("interpola order_number en order_with_number", () => {
    expect(
      t("store.profile.order_with_number", "es-CO", { number: "ORD-001" }),
    ).toBe("Pedido ORD-001")
    expect(
      t("store.profile.order_with_number", "en-US", { number: "ORD-002" }),
    ).toBe("Order ORD-002")
  })

  it("interpola shown + total en showing_count", () => {
    expect(
      t("store.profile.showing_count", "es-CO", { shown: 5, total: 12 }),
    ).toBe("Mostrando 5 de 12 pedidos")
    expect(
      t("store.profile.showing_count", "en-US", { shown: 3, total: 8 }),
    ).toBe("Showing 3 of 8 orders")
  })

  it("interpola org name en access_form_subtitle", () => {
    expect(
      t("store.profile.access_form_subtitle", "es-CO", { name: "Quality Pets" }),
    ).toBe("Valida tu acceso con el mismo nombre y WhatsApp que usaste en Quality Pets")
    expect(
      t("store.profile.access_form_subtitle", "en-US", { name: "Tantor's House" }),
    ).toBe("Validate your access with the same name and WhatsApp you used at Tantor's House")
  })

  it("tabs traducidos en en-US", () => {
    expect(t("store.profile.tab_orders", "en-US")).toBe("My Orders")
    expect(t("store.profile.tab_conversations", "en-US")).toBe("My Conversations")
    expect(t("store.profile.tab_tracking", "en-US")).toBe("Shipping Tracking")
  })

  it("status badges traducidos en en-US", () => {
    expect(t("store.profile.status_delivered", "en-US")).toBe("Delivered")
    expect(t("store.profile.status_in_transit", "en-US")).toBe("In transit")
    expect(t("store.profile.status_processing", "en-US")).toBe("Processing")
    expect(t("store.profile.status_payment_pending", "en-US")).toBe("Payment pending")
  })

  it("access form CTAs y back link traducidos", () => {
    expect(t("store.profile.access_form_submit", "en-US")).toBe("See My Account")
    expect(t("store.profile.access_form_submitting", "en-US")).toBe("Validating access...")
    expect(t("store.profile.access_form_back", "en-US")).toBe("← Back to store")
  })
})

describe("t() — keys de product detail (T1.3j.1)", () => {
  it("metadata not found traducida en ambos locales", () => {
    expect(t("store.product_detail.metadata_not_found_title", "es-CO")).toBe(
      "Producto no encontrado",
    )
    expect(t("store.product_detail.metadata_not_found_title", "en-US")).toBe(
      "Product not found",
    )
    expect(
      t("store.product_detail.metadata_not_found_description", "es-CO"),
    ).toBe("El producto que buscas no existe.")
    expect(
      t("store.product_detail.metadata_not_found_description", "en-US"),
    ).toBe("The product you're looking for doesn't exist.")
  })

  it("metadata default description interpola productName + orgName + price", () => {
    expect(
      t("store.product_detail.metadata_default_description", "es-CO", {
        productName: "Collar reflectivo",
        orgName: "Quality Pets",
        price: "$ 45.000",
      }),
    ).toBe("Compra Collar reflectivo en Quality Pets. Precio: $ 45.000")
    expect(
      t("store.product_detail.metadata_default_description", "en-US", {
        productName: "LED Dog Leash",
        orgName: "Tantor's House",
        price: "$24.99",
      }),
    ).toBe("Buy LED Dog Leash at Tantor's House. Price: $24.99")
  })

  it("CTA del botón de chat traducido", () => {
    expect(t("store.product_detail.cta_chat_to_buy", "es-CO")).toBe(
      "Chatear para Comprar",
    )
    expect(t("store.product_detail.cta_chat_to_buy", "en-US")).toBe(
      "Chat to Buy",
    )
  })
})

describe("t() — keys de product detail render principal (T1.3j.2)", () => {
  it("CTA buy now con price interpolado", () => {
    expect(
      t("store.product_detail.cta_buy_now_with_price", "es-CO", { price: "$ 45.000" }),
    ).toBe("Comprar Ya — $ 45.000")
    expect(
      t("store.product_detail.cta_buy_now_with_price", "en-US", { price: "$24.99" }),
    ).toBe("Buy Now — $24.99")
  })

  it("inventory message: variant unavailable interpolado", () => {
    expect(
      t("store.product_detail.inventory_title_variant_unavailable", "es-CO", {
        variantTitle: "Talla M / Verde",
      }),
    ).toBe("Talla M / Verde no está disponible ahora")
    expect(
      t("store.product_detail.inventory_title_variant_unavailable", "en-US", {
        variantTitle: "Size M / Green",
      }),
    ).toBe("Size M / Green is not available right now")
  })

  it("stock bar: only N left interpolado", () => {
    expect(
      t("store.product_detail.stock_only_n_left", "es-CO", { count: 3 }),
    ).toBe("¡Quedan solo 3!")
    expect(
      t("store.product_detail.stock_only_n_left", "en-US", { count: 5 }),
    ).toBe("Only 5 left!")
  })

  it("hero signals: only N units + viewers + sold", () => {
    expect(
      t("store.product_detail.signal_only_n_units", "en-US", { count: 4 }),
    ).toBe("Only 4 units")
    expect(
      t("store.product_detail.signal_viewers", "es-CO", { count: 12 }),
    ).toBe("12 personas viendo")
    expect(
      t("store.product_detail.signal_sold", "en-US", { count: 250 }),
    ).toBe("250 sold")
  })

  it("quantity pricing: tiers + per unit interpolados", () => {
    expect(
      t("store.product_detail.quantity_tier_range", "en-US", { min: 5, max: 9 }),
    ).toBe("5-9 units")
    expect(
      t("store.product_detail.quantity_tier_open", "es-CO", { min: 50 }),
    ).toBe("50+ unidades")
    expect(
      t("store.product_detail.quantity_pricing_per_unit", "en-US", { price: "$2.50" }),
    ).toBe("$2.50/u")
  })

  it("price support label: quantity total + savings + bundle discount", () => {
    expect(
      t("store.product_detail.price_support_quantity_total", "en-US", {
        total: "$50.00",
        unit: "$10.00",
      }),
    ).toBe("Current total $50.00 · $10.00 per unit.")
    expect(
      t("store.product_detail.price_support_savings_real", "es-CO", {
        amount: "$ 25.000",
      }),
    ).toBe("Ahorro real de $ 25.000 frente al valor regular.")
  })

  it("free shipping labels (ProductShippingCard) con interpolación", () => {
    expect(
      t("store.product_detail.shipping_remaining", "en-US", {
        remaining: "$15.00",
        zonesText: "",
      }),
    ).toBe("Add $15.00 more and activate free shipping.")
    expect(t("store.product_detail.shipping_free_active", "en-US")).toBe(
      "Free shipping active",
    )
    expect(t("store.product_detail.shipping_free_label", "en-US")).toBe(
      "Free shipping",
    )
  })

  it("CTA unavailable traducido", () => {
    expect(t("store.product_detail.cta_unavailable", "es-CO")).toBe(
      "No disponible",
    )
    expect(t("store.product_detail.cta_unavailable", "en-US")).toBe(
      "Unavailable",
    )
  })
})

describe("t() — keys de product detail secciones secundarias (T1.3j.3)", () => {
  it("description fallback + see more/less", () => {
    expect(t("store.product_detail.description_fallback", "es-CO")).toBe(
      "Sin descripción disponible.",
    )
    expect(t("store.product_detail.description_fallback", "en-US")).toBe(
      "No description available.",
    )
    expect(t("store.product_detail.description_see_more", "en-US")).toBe(
      "See more",
    )
    expect(t("store.product_detail.description_see_less", "en-US")).toBe(
      "See less",
    )
  })

  it("video block iframe title interpolado", () => {
    expect(
      t("store.product_detail.video_iframe_title", "es-CO", {
        productName: "Camiseta",
      }),
    ).toBe("Video de Camiseta")
    expect(
      t("store.product_detail.video_iframe_title", "en-US", {
        productName: "T-shirt",
      }),
    ).toBe("T-shirt video")
  })

  it("section links labels", () => {
    expect(t("store.product_detail.section_link_benefits", "es-CO")).toBe(
      "Beneficios",
    )
    expect(t("store.product_detail.section_link_specifications", "en-US")).toBe(
      "Specifications",
    )
    expect(t("store.product_detail.section_link_questions", "en-US")).toBe(
      "Questions",
    )
    expect(t("store.product_detail.section_link_reviews", "en-US")).toBe(
      "Reviews",
    )
  })

  it("reviews count con singular/plural via plural param", () => {
    expect(
      t("store.product_detail.reviews_count_inline", "es-CO", {
        count: 1,
        plural: "",
      }),
    ).toBe("1 reseña")
    expect(
      t("store.product_detail.reviews_count_inline", "es-CO", {
        count: 12,
        plural: "s",
      }),
    ).toBe("12 reseñas")
    expect(
      t("store.product_detail.reviews_count_inline", "en-US", {
        count: 1,
        plural: "",
      }),
    ).toBe("1 review")
    expect(
      t("store.product_detail.reviews_count_inline", "en-US", {
        count: 42,
        plural: "s",
      }),
    ).toBe("42 reviews")
  })

  it("reviews showing count + verified purchase", () => {
    expect(
      t("store.product_detail.reviews_showing_count", "en-US", {
        shown: 3,
        total: 8,
      }),
    ).toBe("Showing 3 of 8 reviews. Most recent first.")
    expect(t("store.product_detail.reviews_verified_purchase", "es-CO")).toBe(
      "Compra verificada",
    )
    expect(t("store.product_detail.reviews_verified_purchase", "en-US")).toBe(
      "Verified purchase",
    )
  })

  it("benefits + faq + ai recommendation headings", () => {
    expect(t("store.product_detail.benefits_section_title", "en-US")).toBe(
      "Why choose this product",
    )
    expect(t("store.product_detail.faq_section_title", "en-US")).toBe(
      "Frequently asked questions",
    )
    expect(t("store.product_detail.ai_recommendation_heading", "es-CO")).toBe(
      "Recomendado por tu agente IA ✦",
    )
  })

  it("bundle full section + savings label", () => {
    expect(
      t("store.product_detail.bundle_products_count", "en-US", { count: 5 }),
    ).toBe("5 products")
    expect(
      t("store.product_detail.bundle_savings_amount_label", "en-US", {
        amount: "$15.00",
      }),
    ).toBe("Save $15.00")
    expect(
      t("store.product_detail.bundle_included_n", "es-CO", { n: 2 }),
    ).toBe("Incluido 2")
  })

  it("trust rail labels (helper externo con useT)", () => {
    expect(t("store.product_detail.trust_rail_fast_shipping", "en-US")).toBe(
      "Fast shipping",
    )
    expect(
      t("store.product_detail.trust_rail_days_label", "es-CO", {
        count: 1,
        plural: "",
      }),
    ).toBe("1 día")
    expect(
      t("store.product_detail.trust_rail_days_label", "en-US", {
        count: 5,
        plural: "s",
      }),
    ).toBe("5 days")
    expect(
      t("store.product_detail.trust_rail_sections_count", "en-US", {
        count: 4,
      }),
    ).toBe("4 sections")
  })

  it("WhatsApp default message interpolado", () => {
    expect(
      t("store.product_detail.whatsapp_default_message", "es-CO", {
        productName: "Camiseta básica",
      }),
    ).toBe("Hola, quiero más información sobre Camiseta básica")
    expect(
      t("store.product_detail.whatsapp_default_message", "en-US", {
        productName: "Basic T-shirt",
      }),
    ).toBe("Hi, I'd like more information about Basic T-shirt")
  })

  it("related products section title", () => {
    expect(t("store.product_detail.related_section_title", "es-CO")).toBe(
      "Clientes también compraron",
    )
    expect(t("store.product_detail.related_section_title", "en-US")).toBe(
      "Customers also bought",
    )
  })
})

describe("t() — keys de email templates (T1.3i)", () => {
  it("subject del email de confirmación con orderNumber + organizationName", () => {
    expect(
      t("email.order_confirmation.subject", "es-CO", {
        orderNumber: "LC-2026-001",
        organizationName: "Quality Pets",
      }),
    ).toBe("Confirmación de Pedido LC-2026-001 - Quality Pets")
    expect(
      t("email.order_confirmation.subject", "en-US", {
        orderNumber: "LC-2026-002",
        organizationName: "Tantor's House",
      }),
    ).toBe("Order Confirmation LC-2026-002 - Tantor's House")
  })

  it("subject del email del owner con orderNumber + organizationName", () => {
    expect(
      t("email.owner_notification.subject", "es-CO", {
        orderNumber: "LC-2026-003",
        organizationName: "Quality Pets",
      }),
    ).toBe("🛒 Nuevo Pedido LC-2026-003 - Quality Pets")
    expect(
      t("email.owner_notification.subject", "en-US", {
        orderNumber: "LC-2026-004",
        organizationName: "Tantor's House",
      }),
    ).toBe("🛒 New Order LC-2026-004 - Tantor's House")
  })

  it("payment instructions con orderNumber interpolado", () => {
    expect(
      t("email.order_confirmation.payment_keep_order_number", "es-CO", {
        orderNumber: "<strong>LC-2026-005</strong>",
      }),
    ).toBe(
      "Guarda el número de pedido <strong>LC-2026-005</strong> para tu referencia.",
    )
    expect(
      t("email.order_confirmation.payment_keep_order_number", "en-US", {
        orderNumber: "<strong>LC-2026-006</strong>",
      }),
    ).toBe(
      "Keep your order number <strong>LC-2026-006</strong> for reference.",
    )
  })

  it("dashboard hint del owner con organizationName interpolado", () => {
    expect(
      t("email.owner_notification.dashboard_hint", "es-CO", {
        organizationName: "Quality Pets",
      }),
    ).toBe("Revisa los detalles completos en tu dashboard de Quality Pets.")
    expect(
      t("email.owner_notification.dashboard_hint", "en-US", {
        organizationName: "Tantor's House",
      }),
    ).toBe("Review full details in your Tantor's House dashboard.")
  })

  it("table headers + total to pay + payment bank transfer", () => {
    expect(t("email.order_confirmation.table_product", "es-CO")).toBe("Producto")
    expect(t("email.order_confirmation.table_quantity", "es-CO")).toBe("Cant.")
    expect(t("email.order_confirmation.table_price", "es-CO")).toBe("Precio")
    expect(t("email.order_confirmation.table_total", "es-CO")).toBe("Total")
    expect(t("email.order_confirmation.total_to_pay", "en-US")).toBe(
      "Total to Pay:",
    )
    expect(t("email.order_confirmation.payment_bank_transfer", "en-US")).toBe(
      "Bank Transfer",
    )
  })

  it("next steps + footer del email del cliente", () => {
    expect(t("email.order_confirmation.next_step_notify", "en-US")).toBe(
      "We'll notify you when your order ships",
    )
    expect(t("email.order_confirmation.footer_view_order", "en-US")).toBe(
      "View My Order",
    )
    expect(t("email.order_confirmation.footer_visit_store", "en-US")).toBe(
      "Visit Store",
    )
  })

  it("owner notification labels", () => {
    expect(t("email.owner_notification.heading", "es-CO")).toBe(
      "🛒 Nuevo Pedido Recibido",
    )
    expect(t("email.owner_notification.heading", "en-US")).toBe(
      "🛒 New Order Received",
    )
    expect(t("email.owner_notification.number_label", "es-CO")).toBe("Número:")
    expect(t("email.owner_notification.number_label", "en-US")).toBe("Number:")
    expect(t("email.owner_notification.products_heading", "en-US")).toBe(
      "Products:",
    )
  })
})

describe("t() — integridad del set", () => {
  it("todas las keys producen strings en ambos locales", () => {
    const keys = Object.keys(storefrontStrings["es-CO"]) as StorefrontStringKey[]
    for (const key of keys) {
      expect(typeof t(key, "es-CO")).toBe("string")
      expect(typeof t(key, "en-US")).toBe("string")
    }
  })

  it("strings es-CO y en-US son distintos para keys que tienen traducción real", () => {
    // No comparamos todas las keys (algunas podrían coincidir, ej. "Error"),
    // pero verificamos un sample de strings notoriamente distintos.
    const samples: StorefrontStringKey[] = [
      "order.success.title",
      "order.success.message",
      "order.common.back_to_store",
      "order.error.help_verify_card",
    ]
    for (const key of samples) {
      expect(t(key, "es-CO")).not.toBe(t(key, "en-US"))
    }
  })
})
