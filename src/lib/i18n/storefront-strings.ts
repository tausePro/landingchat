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
    // Home — CompleteTemplate específico (hero extendido + secciones largas)
    "store.home.hero_subtitle_complete_default": "Sin buscar, sin filtros, solo conversación. Nuestro asistente de IA te ayuda a encontrar exactamente lo que necesitas en segundos.",
    "store.home.hero_badge": "✨ La nueva forma de comprar",
    "store.home.hero_cta_catalog": "Ver Catálogo",
    "store.home.hero_whatsapp_greeting": "Hola, quiero más información",
    "store.home.hero_chat_demo_ai_label": "IA",
    "store.home.hero_chat_demo_you_label": "Tú",
    "store.home.hero_chat_demo_greeting": "¡Hola! 👋 Soy tu asistente personal. ¿Qué estás buscando hoy?",
    "store.home.hero_chat_demo_user_query": "Busco un regalo para mi novia, le gusta la tecnología.",
    "store.home.hero_chat_demo_bot_response": "¡Perfecto! Tengo unas opciones geniales. ¿Qué tal estos audífonos con cancelación de ruido? 🎧",
    "store.home.hero_stat_national_shipping": "Envíos Nacionales",
    "store.home.hero_stat_secure_purchase": "Compra Segura",
    // Steps "Cómo funciona" (3 pasos)
    "store.home.steps_step1_title": "1. Chatea",
    "store.home.steps_step1_description": "Cuéntale a nuestro asistente qué necesitas, como si hablaras con un amigo.",
    "store.home.steps_step2_title": "2. Elige",
    "store.home.steps_step2_description": "Recibe recomendaciones personalizadas y selecciona tu favorita.",
    "store.home.steps_step3_title": "3. Recibe",
    "store.home.steps_step3_description": "Coordina el envío y el pago directamente en el chat. ¡Listo!",
    "store.home.how_it_works_title": "Cómo funciona",
    "store.home.how_it_works_subtitle": "Comprar nunca fue tan fácil. Olvídate de los carritos complicados.",
    // Features section
    "store.home.features_title": "¿Por qué elegirnos?",
    "store.home.features_subtitle": "Beneficios que hacen la diferencia",
    // Products section
    "store.home.products_section_title_default": "Tendencias",
    "store.home.products_section_subtitle_default": "Lo más vendido de la semana",
    "store.home.products_filter_all": "Todos",
    "store.home.products_empty_filtered_title": "No encontramos productos para este filtro",
    "store.home.products_empty_filtered_message": "Prueba otra categoría o vuelve al catálogo completo.",
    // Testimonials section
    "store.home.testimonials_title": "Lo que dicen nuestros clientes",
    "store.home.testimonials_subtitle": "Testimonios reales de personas satisfechas",
    // Final CTA section
    "store.home.cta_title": "¿Listo para empezar?",
    "store.home.cta_subtitle": "Únete a miles de clientes satisfechos que ya compran de manera inteligente.",
    // Footer — link extra "Contacto"
    "store.footer.nav_contact": "Contacto",
    // ========================================================================
    // Checkout (T1.3f) — page chrome + flow + steps + summary
    // ========================================================================
    // Page chrome
    "store.checkout.meta_title": "Checkout",
    "store.checkout.meta_description": "Finaliza tu compra en {{name}}.",
    "store.checkout.fallback_org_name": "Tienda",
    "store.checkout.back_aria": "Volver",
    "store.checkout.back_to_store_aria": "Volver a {{name}}",
    "store.checkout.secure_badge": "Checkout seguro",
    "store.checkout.cart_loading": "Cargando tu carrito...",
    // Steps stepper
    "store.checkout.step_contact_label": "Datos",
    "store.checkout.step_payment_label": "Pago",
    "store.checkout.step_success_label": "Listo",
    "store.checkout.step_contact_title": "Información de Envío",
    "store.checkout.step_payment_title": "Pago y Confirmación",
    "store.checkout.step_success_title": "¡Orden Recibida!",
    "store.checkout.step_contact_description": "Completa tus datos para confirmar disponibilidad de envío y preparar tu pedido.",
    "store.checkout.step_payment_description": "Revisa el total final antes de confirmar. No cambiaremos el monto después de crear la orden.",
    "store.checkout.step_success_description": "Tu orden quedó registrada. Conserva el enlace para consultar el estado.",
    // Toasts del flow
    "store.checkout.toast_coupon_applied": "¡Cupón {{code}} aplicado!",
    "store.checkout.toast_coupon_invalid": "Cupón inválido",
    "store.checkout.toast_coupon_validation_error": "Error al validar cupón",
    "store.checkout.toast_validation_billing": "Por favor completa todos los campos de facturación",
    "store.checkout.toast_validation_state": "Por favor selecciona tu departamento",
    "store.checkout.toast_shipping_unavailable_default": "No realizamos envíos a tu ciudad por el momento",
    "store.checkout.toast_business_name_warning": "Se recomienda ingresar el nombre de la empresa para personas jurídicas",
    "store.checkout.toast_no_payment_methods": "La tienda no tiene métodos de pago disponibles en este momento.",
    "store.checkout.toast_order_created_payment_failed": "Tu orden fue creada, pero no pudimos abrir el pago. Puedes reintentarlo desde el detalle del pedido.",
    "store.checkout.toast_order_create_error_prefix": "Error al crear la orden:",
    "store.checkout.toast_unexpected_error": "Ocurrió un error inesperado",
    // Order summary
    "store.checkout.summary_title": "Resumen de tu pedido",
    "store.checkout.summary_subtitle": "Este es el total final antes de crear la orden.",
    "store.checkout.summary_taxable_base": "Base gravable",
    "store.checkout.summary_subtotal_with_count": "Subtotal ({{count}} items)",
    "store.checkout.summary_iva": "IVA",
    "store.checkout.summary_iva_included_suffix": " (incluido)",
    "store.checkout.summary_shipping": "Envío",
    "store.checkout.summary_cod_fee": "Costo Contraentrega",
    "store.checkout.summary_discount_with_code": "Descuento ({{code}})",
    "store.checkout.summary_total": "Total a Pagar",
    // Success step
    "store.checkout.success_title": "¡Gracias por tu compra!",
    "store.checkout.success_message": "Hemos recibido tu orden correctamente. Te enviaremos un correo con los detalles y el número de guía.",
    "store.checkout.success_cta": "Ver Pedido",
    // Contact step (datos personales + facturación + dirección)
    "store.checkout.contact_disclaimer": "Usaremos estos datos solo para coordinar el envío, enviarte actualizaciones por WhatsApp y generar tu comprobante.",
    "store.checkout.contact_name_label": "Nombre completo",
    "store.checkout.contact_name_placeholder": "Ej. Juan Pérez",
    "store.checkout.contact_email_label": "Email",
    "store.checkout.contact_email_optional": "(Opcional)",
    "store.checkout.contact_email_placeholder": "juan@ejemplo.com",
    "store.checkout.contact_phone_label": "Teléfono (WhatsApp)",
    "store.checkout.contact_phone_placeholder": "300 123 4567",
    "store.checkout.billing_section_title": "Información de Facturación",
    "store.checkout.billing_section_subtitle": "Estos datos permiten emitir el comprobante de compra y evitar retrasos al crear la orden.",
    "store.checkout.billing_document_label": "Documento de Identidad",
    "store.checkout.billing_document_number_placeholder": "Número",
    "store.checkout.billing_person_natural": "Natural (Persona)",
    "store.checkout.billing_person_legal": "Jurídica (Empresa)",
    "store.checkout.billing_business_name_label": "Nombre de la Empresa",
    "store.checkout.billing_business_name_placeholder": "Mi Empresa S.A.S.",
    "store.checkout.location_label": "Ubicación",
    "store.checkout.location_subtitle": "Confirmamos la cobertura de envío con tu ciudad antes de pasar al pago.",
    "store.checkout.location_state_placeholder": "Departamento",
    "store.checkout.location_city_placeholder": "Ciudad",
    "store.checkout.location_address_placeholder": "Dirección completa",
    "store.checkout.contact_submit_cta": "Confirmar envío y continuar",
    "store.checkout.contact_data_disclaimer": "Tus datos se usan únicamente para procesar esta compra.",
    // Payment step (cupón + método pago + transferencia + acciones)
    "store.checkout.coupon_remove_aria": "Quitar cupón",
    "store.checkout.coupon_placeholder": "Código de cupón",
    "store.checkout.coupon_apply_btn": "Aplicar",
    "store.checkout.coupon_loading": "...",
    "store.checkout.payment_method_label": "Método de pago",
    "store.checkout.payment_method_subtitle": "Elige cómo quieres pagar. Si algo falla, conservaremos la orden para que puedas reintentarlo.",
    "store.checkout.gateways_loading": "Cargando métodos de pago...",
    "store.checkout.gateway_test_mode": "Pruebas",
    "store.checkout.payment_bank_transfer_label": "Transferencia",
    "store.checkout.payment_cod_label": "Contra Entrega",
    "store.checkout.payment_cod_subtitle": "Paga al recibir",
    "store.checkout.bank_section_title": "Datos para Transferencia",
    "store.checkout.bank_field_bank": "Banco:",
    "store.checkout.bank_field_type": "Tipo:",
    "store.checkout.bank_field_account": "Cuenta:",
    "store.checkout.bank_field_holder": "Titular:",
    "store.checkout.bank_field_nequi": "Nequi:",
    "store.checkout.bank_disclaimer": "Recuerda enviar el comprobante de pago al WhatsApp de la tienda.",
    "store.checkout.no_payment_methods_full": "La tienda no tiene métodos de pago disponibles en este momento. Intenta más tarde o contacta a la tienda.",
    "store.checkout.action_back": "Atrás",
    "store.checkout.action_creating_order": "Creando orden...",
    "store.checkout.action_place_order": "Confirmar pedido",
    "store.checkout.action_secure_disclaimer": "Pago procesado por métodos seguros de la tienda.",
    // ========================================================================
    // Cart (T1.3e) — drawer + sidebar (storefront público y chat)
    // ========================================================================
    "store.cart.drawer_title_sr": "Carrito de Compras",
    "store.cart.title": "Tu Carrito",
    "store.cart.items_count_singular": "{{count}} ítem",
    "store.cart.items_count_plural": "{{count}} ítems",
    "store.cart.empty": "Tu carrito está vacío",
    "store.cart.aria_close": "Cerrar carrito",
    "store.cart.aria_more": "Más opciones",
    "store.cart.aria_remove_item": "Eliminar producto",
    "store.cart.aria_decrease_qty": "Disminuir cantidad",
    "store.cart.aria_increase_qty": "Aumentar cantidad",
    "store.cart.free_shipping_label": "Envío Gratis",
    "store.cart.free_shipping_remaining": "{{amount}} más",
    "store.cart.free_shipping_qualified": "¡Conseguido!",
    "store.cart.free_shipping_almost": "¡Casi lo tienes!",
    "store.cart.free_shipping_active": "¡Envío gratis activado!",
    "store.cart.cross_sell_title": "Comprados juntos",
    "store.cart.cross_sell_offer_badge": "Oferta",
    "store.cart.coupon_code_placeholder": "Código",
    "store.cart.coupon_apply_short": "Aplicar",
    "store.cart.coupon_loading": "...",
    "store.cart.coupon_apply_cta": "Aplicar Cupón de descuento",
    "store.cart.coupon_invalid": "Cupón inválido",
    "store.cart.coupon_validate_error": "Error al validar cupón",
    "store.cart.totals_taxable_base": "Base gravable",
    "store.cart.totals_subtotal": "Subtotal",
    "store.cart.totals_tax_label": "IVA",
    "store.cart.totals_tax_included_suffix": " (incluido)",
    "store.cart.totals_discount_with_code": "Descuento ({{code}})",
    "store.cart.totals_estimated_shipping": "Envío estimado",
    "store.cart.totals_free": "Gratis",
    "store.cart.totals_calculated_at_checkout": "Calculado al pagar",
    "store.cart.totals_total": "Total a Pagar",
    "store.cart.checkout_button": "Finalizar Compra",
    // ========================================================================
    // Order detail page (T1.3g) — `/store/[slug]/order/[orderId]`
    // ========================================================================
    // Header / breadcrumbs
    "store.order_detail.back_to_store": "Volver a la tienda",
    "store.order_detail.order_date_label": "Fecha del pedido",
    // Status labels (orders.status enum)
    "store.order_detail.status_pending": "Confirmado",
    "store.order_detail.status_processing": "En Preparación",
    "store.order_detail.status_shipped": "En Camino",
    "store.order_detail.status_delivered": "Entregado",
    "store.order_detail.status_cancelled": "Cancelado",
    "store.order_detail.status_unknown": "Pendiente",
    // Title + thanks message
    "store.order_detail.order_title": "Pedido {{number}}",
    "store.order_detail.thanks_message": "Gracias por comprar en {{name}}",
    // WhatsApp support
    "store.order_detail.whatsapp_cta": "Ayuda por WhatsApp",
    "store.order_detail.whatsapp_message": "Hola, tengo una consulta sobre mi pedido #{{number}}",
    // Progress bar steps (subset de los status: pending → processing → shipped → delivered)
    "store.order_detail.progress_confirmed": "Confirmado",
    "store.order_detail.progress_preparing": "Preparando",
    "store.order_detail.progress_shipping": "En Camino",
    "store.order_detail.progress_delivered": "Entregado",
    // Sections
    "store.order_detail.section_products": "Productos",
    "store.order_detail.product_fallback_name": "Producto",
    "store.order_detail.section_shipping_address": "Dirección de Envío",
    "store.order_detail.section_billing": "Facturación",
    "store.order_detail.section_payment_summary": "Resumen de Pago",
    // Person type (CO concept, neutralizado para US)
    "store.order_detail.person_legal": "Persona Jurídica",
    "store.order_detail.person_natural": "Persona Natural",
    // Payment summary lines
    "store.order_detail.summary_subtotal": "Subtotal",
    "store.order_detail.summary_tax": "IVA",
    "store.order_detail.summary_shipping": "Envío",
    "store.order_detail.summary_shipping_free": "Gratis",
    "store.order_detail.summary_cod_fee": "Recargo contraentrega",
    "store.order_detail.summary_discount": "Descuento",
    "store.order_detail.summary_total": "Total",
    // Payment status badge
    "store.order_detail.payment_status_paid": "Pago Aprobado",
    "store.order_detail.payment_status_pending": "Pago Pendiente",
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
    // Home — CompleteTemplate specific (extended hero + large sections)
    "store.home.hero_subtitle_complete_default": "No searching, no filters, just conversation. Our AI assistant helps you find exactly what you need in seconds.",
    "store.home.hero_badge": "✨ The new way to shop",
    "store.home.hero_cta_catalog": "View Catalog",
    "store.home.hero_whatsapp_greeting": "Hi, I'd like more information",
    "store.home.hero_chat_demo_ai_label": "AI",
    "store.home.hero_chat_demo_you_label": "You",
    "store.home.hero_chat_demo_greeting": "Hi there! 👋 I'm your personal assistant. What are you looking for today?",
    "store.home.hero_chat_demo_user_query": "I'm looking for a gift for my partner, they like tech.",
    "store.home.hero_chat_demo_bot_response": "Perfect! I have some great options. How about these noise-cancelling headphones? 🎧",
    "store.home.hero_stat_national_shipping": "Nationwide Shipping",
    "store.home.hero_stat_secure_purchase": "Secure Checkout",
    // Steps "How it works" (3 steps)
    "store.home.steps_step1_title": "1. Chat",
    "store.home.steps_step1_description": "Tell our assistant what you need, just like talking to a friend.",
    "store.home.steps_step2_title": "2. Choose",
    "store.home.steps_step2_description": "Get personalized recommendations and pick your favorite.",
    "store.home.steps_step3_title": "3. Receive",
    "store.home.steps_step3_description": "Arrange shipping and payment directly in the chat. Done!",
    "store.home.how_it_works_title": "How it works",
    "store.home.how_it_works_subtitle": "Shopping has never been easier. Forget the complicated carts.",
    // Features section
    "store.home.features_title": "Why choose us?",
    "store.home.features_subtitle": "Benefits that make the difference",
    // Products section
    "store.home.products_section_title_default": "Trending",
    "store.home.products_section_subtitle_default": "Best sellers of the week",
    "store.home.products_filter_all": "All",
    "store.home.products_empty_filtered_title": "We couldn't find products for this filter",
    "store.home.products_empty_filtered_message": "Try another category or go back to the full catalog.",
    // Testimonials section
    "store.home.testimonials_title": "What our customers say",
    "store.home.testimonials_subtitle": "Real testimonials from happy people",
    // Final CTA section
    "store.home.cta_title": "Ready to get started?",
    "store.home.cta_subtitle": "Join thousands of happy customers already shopping smarter.",
    // Footer — extra "Contact" link
    "store.footer.nav_contact": "Contact",
    // ========================================================================
    // Checkout (T1.3f) — page chrome + flow + steps + summary
    // ========================================================================
    // Page chrome
    "store.checkout.meta_title": "Checkout",
    "store.checkout.meta_description": "Complete your purchase at {{name}}.",
    "store.checkout.fallback_org_name": "Store",
    "store.checkout.back_aria": "Back",
    "store.checkout.back_to_store_aria": "Back to {{name}}",
    "store.checkout.secure_badge": "Secure checkout",
    "store.checkout.cart_loading": "Loading your cart...",
    // Steps stepper
    "store.checkout.step_contact_label": "Details",
    "store.checkout.step_payment_label": "Payment",
    "store.checkout.step_success_label": "Done",
    "store.checkout.step_contact_title": "Shipping Information",
    "store.checkout.step_payment_title": "Payment & Confirmation",
    "store.checkout.step_success_title": "Order Received!",
    "store.checkout.step_contact_description": "Complete your details to confirm shipping availability and prepare your order.",
    "store.checkout.step_payment_description": "Review the final total before confirming. We won't change the amount after creating the order.",
    "store.checkout.step_success_description": "Your order has been registered. Save the link to check the status.",
    // Toasts del flow
    "store.checkout.toast_coupon_applied": "Coupon {{code}} applied!",
    "store.checkout.toast_coupon_invalid": "Invalid coupon",
    "store.checkout.toast_coupon_validation_error": "Error validating coupon",
    "store.checkout.toast_validation_billing": "Please complete all billing fields",
    "store.checkout.toast_validation_state": "Please select your state",
    "store.checkout.toast_shipping_unavailable_default": "We don't ship to your city at the moment",
    "store.checkout.toast_business_name_warning": "We recommend entering the business name for legal entities",
    "store.checkout.toast_no_payment_methods": "The store has no payment methods available at the moment.",
    "store.checkout.toast_order_created_payment_failed": "Your order was created, but we couldn't open the payment. You can retry from the order details.",
    "store.checkout.toast_order_create_error_prefix": "Error creating the order:",
    "store.checkout.toast_unexpected_error": "An unexpected error occurred",
    // Order summary
    "store.checkout.summary_title": "Order Summary",
    "store.checkout.summary_subtitle": "This is the final total before creating the order.",
    "store.checkout.summary_taxable_base": "Taxable base",
    "store.checkout.summary_subtotal_with_count": "Subtotal ({{count}} items)",
    "store.checkout.summary_iva": "Tax",
    "store.checkout.summary_iva_included_suffix": " (included)",
    "store.checkout.summary_shipping": "Shipping",
    "store.checkout.summary_cod_fee": "Cash on Delivery Fee",
    "store.checkout.summary_discount_with_code": "Discount ({{code}})",
    "store.checkout.summary_total": "Total to Pay",
    // Success step
    "store.checkout.success_title": "Thank you for your purchase!",
    "store.checkout.success_message": "We've received your order correctly. We'll send you an email with the details and tracking number.",
    "store.checkout.success_cta": "View Order",
    // Contact step (personal data + billing + address)
    "store.checkout.contact_disclaimer": "We'll use these details only to coordinate shipping, send you WhatsApp updates, and generate your receipt.",
    "store.checkout.contact_name_label": "Full name",
    "store.checkout.contact_name_placeholder": "e.g. John Smith",
    "store.checkout.contact_email_label": "Email",
    "store.checkout.contact_email_optional": "(Optional)",
    "store.checkout.contact_email_placeholder": "john@example.com",
    "store.checkout.contact_phone_label": "Phone (WhatsApp)",
    "store.checkout.contact_phone_placeholder": "300 123 4567",
    "store.checkout.billing_section_title": "Billing Information",
    "store.checkout.billing_section_subtitle": "These details allow us to issue the purchase receipt and avoid delays when creating the order.",
    "store.checkout.billing_document_label": "ID Document",
    "store.checkout.billing_document_number_placeholder": "Number",
    "store.checkout.billing_person_natural": "Individual (Person)",
    "store.checkout.billing_person_legal": "Legal Entity (Business)",
    "store.checkout.billing_business_name_label": "Business Name",
    "store.checkout.billing_business_name_placeholder": "My Company LLC",
    "store.checkout.location_label": "Location",
    "store.checkout.location_subtitle": "We confirm shipping coverage with your city before moving to payment.",
    "store.checkout.location_state_placeholder": "State",
    "store.checkout.location_city_placeholder": "City",
    "store.checkout.location_address_placeholder": "Full address",
    "store.checkout.contact_submit_cta": "Confirm shipping and continue",
    "store.checkout.contact_data_disclaimer": "Your details are used only to process this purchase.",
    // Payment step (coupon + payment method + bank transfer + actions)
    "store.checkout.coupon_remove_aria": "Remove coupon",
    "store.checkout.coupon_placeholder": "Coupon code",
    "store.checkout.coupon_apply_btn": "Apply",
    "store.checkout.coupon_loading": "...",
    "store.checkout.payment_method_label": "Payment method",
    "store.checkout.payment_method_subtitle": "Choose how you want to pay. If something fails, we'll keep the order so you can retry.",
    "store.checkout.gateways_loading": "Loading payment methods...",
    "store.checkout.gateway_test_mode": "Test",
    "store.checkout.payment_bank_transfer_label": "Bank Transfer",
    "store.checkout.payment_cod_label": "Cash on Delivery",
    "store.checkout.payment_cod_subtitle": "Pay on receipt",
    "store.checkout.bank_section_title": "Bank Transfer Details",
    "store.checkout.bank_field_bank": "Bank:",
    "store.checkout.bank_field_type": "Type:",
    "store.checkout.bank_field_account": "Account:",
    "store.checkout.bank_field_holder": "Holder:",
    "store.checkout.bank_field_nequi": "Nequi:",
    "store.checkout.bank_disclaimer": "Remember to send the payment receipt to the store's WhatsApp.",
    "store.checkout.no_payment_methods_full": "The store has no payment methods available at the moment. Try later or contact the store.",
    "store.checkout.action_back": "Back",
    "store.checkout.action_creating_order": "Creating order...",
    "store.checkout.action_place_order": "Place order",
    "store.checkout.action_secure_disclaimer": "Payment processed by the store's secure methods.",
    // ========================================================================
    // Cart (T1.3e) — drawer + sidebar (public storefront and chat)
    // ========================================================================
    "store.cart.drawer_title_sr": "Shopping Cart",
    "store.cart.title": "Your Cart",
    "store.cart.items_count_singular": "{{count}} item",
    "store.cart.items_count_plural": "{{count}} items",
    "store.cart.empty": "Your cart is empty",
    "store.cart.aria_close": "Close cart",
    "store.cart.aria_more": "More options",
    "store.cart.aria_remove_item": "Remove item",
    "store.cart.aria_decrease_qty": "Decrease quantity",
    "store.cart.aria_increase_qty": "Increase quantity",
    "store.cart.free_shipping_label": "Free Shipping",
    "store.cart.free_shipping_remaining": "{{amount}} more",
    "store.cart.free_shipping_qualified": "Achieved!",
    "store.cart.free_shipping_almost": "Almost there!",
    "store.cart.free_shipping_active": "Free shipping unlocked!",
    "store.cart.cross_sell_title": "Bought together",
    "store.cart.cross_sell_offer_badge": "Sale",
    "store.cart.coupon_code_placeholder": "Code",
    "store.cart.coupon_apply_short": "Apply",
    "store.cart.coupon_loading": "...",
    "store.cart.coupon_apply_cta": "Apply discount coupon",
    "store.cart.coupon_invalid": "Invalid coupon",
    "store.cart.coupon_validate_error": "Error validating coupon",
    "store.cart.totals_taxable_base": "Taxable base",
    "store.cart.totals_subtotal": "Subtotal",
    "store.cart.totals_tax_label": "Tax",
    "store.cart.totals_tax_included_suffix": " (included)",
    "store.cart.totals_discount_with_code": "Discount ({{code}})",
    "store.cart.totals_estimated_shipping": "Estimated shipping",
    "store.cart.totals_free": "Free",
    "store.cart.totals_calculated_at_checkout": "Calculated at checkout",
    "store.cart.totals_total": "Total",
    "store.cart.checkout_button": "Checkout",
    // ========================================================================
    // Order detail page (T1.3g) — `/store/[slug]/order/[orderId]`
    // ========================================================================
    // Header / breadcrumbs
    "store.order_detail.back_to_store": "Back to store",
    "store.order_detail.order_date_label": "Order date",
    // Status labels (orders.status enum)
    "store.order_detail.status_pending": "Confirmed",
    "store.order_detail.status_processing": "Processing",
    "store.order_detail.status_shipped": "Shipped",
    "store.order_detail.status_delivered": "Delivered",
    "store.order_detail.status_cancelled": "Cancelled",
    "store.order_detail.status_unknown": "Pending",
    // Title + thanks message
    "store.order_detail.order_title": "Order {{number}}",
    "store.order_detail.thanks_message": "Thanks for shopping at {{name}}",
    // WhatsApp support
    "store.order_detail.whatsapp_cta": "WhatsApp Support",
    "store.order_detail.whatsapp_message": "Hi, I have a question about my order #{{number}}",
    // Progress bar steps (subset de los status: pending → processing → shipped → delivered)
    "store.order_detail.progress_confirmed": "Confirmed",
    "store.order_detail.progress_preparing": "Preparing",
    "store.order_detail.progress_shipping": "Shipping",
    "store.order_detail.progress_delivered": "Delivered",
    // Sections
    "store.order_detail.section_products": "Products",
    "store.order_detail.product_fallback_name": "Product",
    "store.order_detail.section_shipping_address": "Shipping Address",
    "store.order_detail.section_billing": "Billing",
    "store.order_detail.section_payment_summary": "Payment Summary",
    // Person type (CO concept, neutralizado para US)
    "store.order_detail.person_legal": "Business",
    "store.order_detail.person_natural": "Individual",
    // Payment summary lines
    "store.order_detail.summary_subtotal": "Subtotal",
    "store.order_detail.summary_tax": "Tax",
    "store.order_detail.summary_shipping": "Shipping",
    "store.order_detail.summary_shipping_free": "Free",
    "store.order_detail.summary_cod_fee": "COD fee",
    "store.order_detail.summary_discount": "Discount",
    "store.order_detail.summary_total": "Total",
    // Payment status badge
    "store.order_detail.payment_status_paid": "Payment approved",
    "store.order_detail.payment_status_pending": "Payment pending",
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
 * Mapa de parámetros para interpolar en strings con placeholders `{{name}}`.
 *
 * Las keys del objeto coinciden con los nombres dentro de las dobles llaves
 * en el string original. Los valores se convierten a string si son `number`.
 *
 * @example
 * ```ts
 * // Diccionario: "Hola, {{name}}. Tienes {{count}} pedidos."
 * t("greeting", "es-CO", { name: "Juan", count: 3 })
 * // → "Hola, Juan. Tienes 3 pedidos."
 * ```
 */
export type StringParams = Record<string, string | number>

/**
 * Interpola placeholders `{{key}}` en un string usando el mapa de params.
 *
 * - Reemplaza todas las ocurrencias de `{{key}}` por `params[key]`.
 * - Si `params[key]` no existe, deja el placeholder intacto (visible para debug).
 * - Tolera espacios alrededor del nombre: `{{ name }}` también se interpola.
 *
 * No usa `Intl.NumberFormat` ni nada complejo. Para formateo numérico avanzado,
 * formatea fuera y pasa el string ya formateado.
 */
function interpolate(template: string, params?: StringParams): string {
  if (!params) return template
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const value = params[key]
    if (value === undefined || value === null) return match
    return String(value)
  })
}

/**
 * Resuelve un string traducido para el locale dado, con interpolación opcional
 * de parámetros via placeholders `{{key}}`.
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
 * t("order.success.title")                                    // → "¡Pago Exitoso!"
 * t("order.success.title", "en-US")                           // → "Payment Successful!"
 * t("store.checkout.toast_coupon_applied", "en-US", { code: "FALL20" })
 *   // → "Coupon FALL20 applied!"
 * t("store.checkout.summary_subtotal_with_count", "es-CO", { count: 3 })
 *   // → "Subtotal (3 items)"
 * ```
 */
export function t(
  key: StorefrontStringKey,
  locale: SupportedLocale = "es-CO",
  params?: StringParams
): string {
  const dict = storefrontStrings[locale] ?? storefrontStrings["es-CO"]
  const value = dict[key]
  if (typeof value === "string") {
    return interpolate(value, params)
  }
  const fallback = storefrontStrings["es-CO"][key]
  if (typeof fallback === "string") {
    return interpolate(fallback, params)
  }
  return key
}
