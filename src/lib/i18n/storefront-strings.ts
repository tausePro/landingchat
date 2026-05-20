/**
 * Diccionario i18n del storefront público de LandingChat.
 *
 * Fase 1 (T1.3): single-locale-per-tenant. El tenant fija el idioma; el
 * cliente final NO puede cambiarlo (eso sería selector por visitor, deferido).
 *
 * Estrategia: dict plano con dot-notation por área. Sin librería externa.
 * `Intl.NumberFormat` / `Intl.DateTimeFormat` se usan directamente donde
 * aplica (ver `formatCurrency` en `src/lib/utils.ts`).
 *
 * Convenciones:
 * - Keys siempre en `area.subarea.nombre_corto` (snake_case del último segmento).
 * - Valor base es `es-CO`; toda key debe existir aquí. Si falta en otro locale,
 *   `t()` cae al valor `es-CO`.
 * - NO incluir strings que dependan de datos del tenant (banco, nombre,
 *   instrucciones de pago manual). Esos vienen de `payment_gateway_configs`.
 * - NO incluir strings con HTML embebido. Si necesitás bold/links, partir
 *   en pedazos o usar componentes con `t()` por sección.
 *
 * Para interpolación de variables (futuro): agregar helper `tWithVars(key, vars)`
 * con sintaxis `{name}`. No es urgente en T1.3a — los call sites actuales no
 * lo requieren.
 *
 * Spec: .kiro/specs/i18n-fase-1/ (T1.3)
 */

import type { SupportedLocale } from "@/types/organization"

// ============================================================================
// Diccionario
// ============================================================================

/**
 * Strings del storefront indexados por locale. El locale `'es-CO'` es la
 * fuente de verdad: toda key debe existir aquí. Los demás locales son
 * traducciones opcionales (faltantes caen al `es-CO`).
 *
 * El `satisfies` garantiza que `'en-US'` no introduzca keys nuevas que no
 * existan en `'es-CO'`, y el `as const` preserva los literal types para
 * inferir `StorefrontStringKey`.
 */
export const storefrontStrings = {
  "es-CO": {
    // Páginas de orden (success / pending / error) — área común
    "order.common.order_number": "Número de Pedido",
    "order.common.amount": "Monto",
    "order.common.total_paid": "Total Pagado",
    "order.common.payment_status": "Estado del Pago",
    "order.common.order_status": "Estado",
    "order.common.back_to_store": "Volver a la Tienda",
    "order.common.view_order_details": "Ver Detalles del Pedido",
    // Status pills
    "order.status.confirmed": "Confirmado",
    "order.status.processing": "Procesando",
    "order.status.pending": "Pendiente",
    "order.status.rejected": "Rechazado",
    "order.status.error": "Error",
    // Página de éxito
    "order.success.title": "¡Pago Exitoso!",
    "order.success.message": "Tu pedido ha sido confirmado y está siendo procesado.",
    "order.success.next_steps_title": "Próximos Pasos",
    "order.success.next_step_email": "Recibirás un correo de confirmación con los detalles de tu pedido",
    "order.success.next_step_shipping": "Te notificaremos cuando tu pedido sea enviado",
    "order.success.next_step_tracking": "Puedes rastrear tu pedido usando el número de orden",
    // Página de pendiente
    "order.pending.title": "Pago Pendiente",
    "order.pending.message": "Tu pago está siendo procesado. Esto puede tomar unos minutos.",
    "order.pending.what_means_title": "¿Qué significa esto?",
    "order.pending.what_means_verifying": "Tu pago está siendo verificado por la pasarela de pagos",
    "order.pending.what_means_notification": "Recibirás una notificación cuando se confirme el pago",
    "order.pending.what_means_check_anytime": "Puedes verificar el estado en cualquier momento",
    "order.pending.what_means_24h_expiry": "Si el pago no se confirma en 24 horas, será cancelado automáticamente",
    // Página de error
    "order.error.title": "Pago No Completado",
    "order.error.message_failed": "El pago fue rechazado por la pasarela de pagos. Por favor, verifica tus datos e intenta nuevamente.",
    "order.error.message_generic": "Hubo un problema al procesar tu pago. Por favor, intenta nuevamente.",
    "order.error.help_title": "¿Qué puedes hacer?",
    "order.error.help_verify_card": "Verifica que los datos de tu tarjeta sean correctos",
    "order.error.help_check_funds": "Asegúrate de tener fondos suficientes",
    "order.error.help_contact_bank": "Contacta a tu banco si el problema persiste",
    "order.error.help_try_other_method": "Intenta con otro método de pago",
    // Navegación del storefront público (header, menús, footer)
    "store.nav.home": "Inicio",
    "store.nav.products": "Productos",
    "store.nav.properties": "Propiedades",
    "store.nav.profile": "Mi Perfil",
    "store.nav.about": "Nosotros",
    // Header del storefront
    "store.header.cart_aria": "Ver carrito",
    "store.header.profile_aria": "Mi perfil",
    "store.header.open_menu": "Abrir menú",
    "store.header.close_menu": "Cerrar menú",
    "store.header.start_chat": "Iniciar Chat",
    "store.header.close_chat": "Cerrar",
    "store.header.ask_ai": "Pregúntale a la IA",
    "store.header.book_visit": "Agenda tu visita",
    "store.header.see_all": "Ver todo",
    // Footer del storefront
    "store.footer.tagline": "La mejor experiencia de compra conversacional. Encuentra lo que buscas, al instante.",
    "store.footer.links": "Enlaces",
    "store.footer.legal": "Legal",
    "store.footer.terms": "Términos",
    "store.footer.privacy": "Privacidad",
    "store.footer.powered_by": "Powered by LandingChat",
    // Contacto WhatsApp y chat flotante
    "store.whatsapp.contact_aria": "Contactar por WhatsApp",
    "store.whatsapp.greeting": "Hola, me gustaría obtener información",
    "store.chat.start_aria": "Iniciar chat",
    // Home templates (defaults del hero + sección productos + empty state)
    "store.home.hero_title_default": "Encuentra tu producto ideal, chateando.",
    "store.home.hero_subtitle_default": "Sin buscar, sin filtros, solo conversación.",
    "store.home.hero_cta_default": "Chatear para Comprar",
    "store.home.products_section_title": "Nuestros Productos",
    "store.home.empty_catalog_title": "Estamos preparando el catálogo",
    "store.home.empty_catalog_message": "Aún no hay productos publicados en esta tienda.",
  },
  "en-US": {
    // Order pages — common area
    "order.common.order_number": "Order Number",
    "order.common.amount": "Amount",
    "order.common.total_paid": "Total Paid",
    "order.common.payment_status": "Payment Status",
    "order.common.order_status": "Status",
    "order.common.back_to_store": "Back to Store",
    "order.common.view_order_details": "View Order Details",
    // Status pills
    "order.status.confirmed": "Confirmed",
    "order.status.processing": "Processing",
    "order.status.pending": "Pending",
    "order.status.rejected": "Rejected",
    "order.status.error": "Error",
    // Success page
    "order.success.title": "Payment Successful!",
    "order.success.message": "Your order has been confirmed and is being processed.",
    "order.success.next_steps_title": "Next Steps",
    "order.success.next_step_email": "You'll receive a confirmation email with your order details",
    "order.success.next_step_shipping": "We'll notify you when your order ships",
    "order.success.next_step_tracking": "You can track your order using the order number",
    // Pending page
    "order.pending.title": "Payment Pending",
    "order.pending.message": "Your payment is being processed. This may take a few minutes.",
    "order.pending.what_means_title": "What does this mean?",
    "order.pending.what_means_verifying": "Your payment is being verified by the payment gateway",
    "order.pending.what_means_notification": "You'll be notified when payment is confirmed",
    "order.pending.what_means_check_anytime": "You can check the status at any time",
    "order.pending.what_means_24h_expiry": "If payment is not confirmed within 24 hours, it will be cancelled automatically",
    // Error page
    "order.error.title": "Payment Not Completed",
    "order.error.message_failed": "The payment was declined by the payment gateway. Please verify your details and try again.",
    "order.error.message_generic": "There was a problem processing your payment. Please try again.",
    "order.error.help_title": "What can you do?",
    "order.error.help_verify_card": "Verify that your card details are correct",
    "order.error.help_check_funds": "Make sure you have sufficient funds",
    "order.error.help_contact_bank": "Contact your bank if the problem persists",
    "order.error.help_try_other_method": "Try a different payment method",
    // Storefront public navigation (header, menus, footer)
    "store.nav.home": "Home",
    "store.nav.products": "Products",
    "store.nav.properties": "Properties",
    "store.nav.profile": "My Profile",
    "store.nav.about": "About Us",
    // Storefront header
    "store.header.cart_aria": "View cart",
    "store.header.profile_aria": "My profile",
    "store.header.open_menu": "Open menu",
    "store.header.close_menu": "Close menu",
    "store.header.start_chat": "Start Chat",
    "store.header.close_chat": "Close",
    "store.header.ask_ai": "Ask the AI",
    "store.header.book_visit": "Book a visit",
    "store.header.see_all": "See all",
    // Storefront footer
    "store.footer.tagline": "The best conversational shopping experience. Find what you need, instantly.",
    "store.footer.links": "Links",
    "store.footer.legal": "Legal",
    "store.footer.terms": "Terms",
    "store.footer.privacy": "Privacy",
    "store.footer.powered_by": "Powered by LandingChat",
    // WhatsApp contact and floating chat
    "store.whatsapp.contact_aria": "Contact via WhatsApp",
    "store.whatsapp.greeting": "Hi, I'd like more information",
    "store.chat.start_aria": "Start chat",
    // Home templates (hero defaults + products section + empty state)
    "store.home.hero_title_default": "Find your ideal product, by chatting.",
    "store.home.hero_subtitle_default": "No searching, no filters, just conversation.",
    "store.home.hero_cta_default": "Chat to Shop",
    "store.home.products_section_title": "Our Products",
    "store.home.empty_catalog_title": "We're preparing the catalog",
    "store.home.empty_catalog_message": "There are no products published in this store yet.",
  },
} as const satisfies Record<SupportedLocale, Record<string, string>>

// ============================================================================
// Types
// ============================================================================

/**
 * Unión literal de todas las keys válidas del diccionario. Derivado del locale
 * base (`'es-CO'`) que es la fuente de verdad.
 *
 * Cualquier intento de llamar `t('clave.inexistente')` falla en compile time.
 */
export type StorefrontStringKey = keyof (typeof storefrontStrings)["es-CO"]

// ============================================================================
// Helper de traducción
// ============================================================================

/**
 * Resuelve un string traducido para el locale dado.
 *
 * Cascada de fallbacks:
 * 1. Si el locale no existe en el dict → cae a `'es-CO'`.
 * 2. Si la key no existe en el locale → cae a la versión `'es-CO'`.
 * 3. Si la key tampoco existe en `'es-CO'` → devuelve la key misma (visible
 *    en UI para debug rápido; no debería ocurrir en producción por tipos).
 *
 * Diseñado para Server Components (no requiere hooks). Para Client Components
 * usar `useT()` desde `use-tenant-strings.ts`.
 *
 * @example
 * ```ts
 * t("order.success.title")               // → "¡Pago Exitoso!"
 * t("order.success.title", "en-US")       // → "Payment Successful!"
 * t("order.success.title", "es-MX" as any) // → "¡Pago Exitoso!" (locale no soportado, fallback)
 * ```
 */
export function t(
  key: StorefrontStringKey,
  locale: SupportedLocale = "es-CO"
): string {
  const dict = storefrontStrings[locale] ?? storefrontStrings["es-CO"]
  const value = dict[key]
  if (typeof value === "string") {
    return value
  }
  const fallback = storefrontStrings["es-CO"][key]
  if (typeof fallback === "string") {
    return fallback
  }
  return key
}
