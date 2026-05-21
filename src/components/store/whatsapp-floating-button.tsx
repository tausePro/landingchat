"use client"

/**
 * Botón flotante de WhatsApp para el storefront público.
 *
 * Patrón visual inspirado en b2b_imprima/components/public/WhatsAppBubble:
 *   - Color oficial WhatsApp (#25D366) en vez del verde Tailwind genérico.
 *   - Halo decorativo con animate-pulse + animate-ping (capta atención
 *     sutilmente, sin ser agresivo).
 *   - Tooltip glass al hover con el CTA text (visible solo si el visitante
 *     decide explorar el botón).
 *   - Ring blanco semi-transparente para sensación premium.
 *
 * Decisiones explícitas:
 *   - Click directo a wa.me (NO popup de captura de lead todavía).
 *     El lead capture estilo Claude/b2b_imprima queda para Fase 2 con su
 *     propio spec, DB schema y tracking.
 *   - Si `phone` no es válido (vacío, undefined, <8 dígitos tras strip),
 *     el componente retorna null. El caller decide qué mostrar como
 *     alternativa (e.g. botón de chat IA).
 *
 * i18n:
 *   - `greeting` ya viene traducido del caller (que usa useT).
 *   - `ariaLabel` y `ctaText` admiten defaults en español pero deben
 *     pasarse traducidos cuando el tenant es en-US.
 *
 * Tracking:
 *   - El componente NO emite eventos directamente. Si se necesita,
 *     pasar `onClick` y disparar desde el caller.
 */

interface WhatsAppFloatingButtonProps {
    /**
     * Número WhatsApp del tenant (con código país, sin signos).
     * Será normalizado quitando todo carácter no-dígito.
     */
    phone: string | null | undefined
    /**
     * Saludo prellenado en el chat de WhatsApp (`?text=...`).
     * Ya traducido por el caller.
     */
    greeting: string
    /**
     * Texto del tooltip al hover. Default: "Hablar con un asesor".
     */
    ctaText?: string
    /**
     * Aria-label del botón para lectores de pantalla.
     * Default: "Contactar por WhatsApp".
     */
    ariaLabel?: string
    /**
     * Callback opcional para tracking analytics al hacer click.
     */
    onClick?: () => void
}

function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16.004c0 3.5 1.129 6.744 3.047 9.381L1.054 31.2l6.023-1.933A15.91 15.91 0 0016.004 32C24.826 32 32 24.824 32 16.004 32 7.176 24.826 0 16.004 0zm9.533 22.611c-.396 1.118-1.955 2.045-3.222 2.316-.868.183-2.002.329-5.818-1.25-4.885-2.023-8.027-6.965-8.27-7.291-.233-.326-1.955-2.605-1.955-4.968 0-2.363 1.237-3.524 1.676-4.005.396-.433 1.048-.62 1.672-.62.198 0 .376.01.536.019.44.019.66.045.95.736.362.863 1.243 3.03 1.353 3.249.113.22.226.516.079.826-.14.316-.264.456-.483.706-.22.25-.427.44-.647.71-.198.236-.423.49-.176.93.247.433 1.098 1.81 2.358 2.933 1.62 1.442 2.985 1.89 3.41 2.098.326.16.714.132.968-.147.322-.356.72-.947 1.126-1.53.289-.415.653-.468 1.013-.316.363.146 2.305 1.089 2.7 1.287.396.198.66.297.757.462.094.166.094.96-.302 2.079z" />
        </svg>
    )
}

/**
 * Normaliza un teléfono al formato requerido por wa.me: solo dígitos,
 * mínimo 8 caracteres. Retorna null si el input no es válido.
 *
 * Examples:
 *   normalize("+57 300 123 4567") -> "573001234567"
 *   normalize("57-300-123-4567")  -> "573001234567"
 *   normalize("123")              -> null  (muy corto)
 *   normalize(null)               -> null
 *
 * Exportada para testing.
 */
export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
    if (!phone) return null
    const digits = phone.replace(/\D/g, "")
    return digits.length >= 8 ? digits : null
}

export function WhatsAppFloatingButton({
    phone,
    greeting,
    ctaText = "Hablar con un asesor",
    ariaLabel = "Contactar por WhatsApp",
    onClick,
}: WhatsAppFloatingButtonProps) {
    const normalizedPhone = normalizeWhatsAppPhone(phone)

    if (!normalizedPhone) {
        return null
    }

    const href = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(greeting)}`

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {/*
              Halo decorativo en dos capas (similar a b2b_imprima):
                - Capa 1: blur-xl + animate-pulse → glow continuo sutil.
                - Capa 2: animate-ping → anillo que se expande cíclicamente.
              Ambas pointer-events-none para no robar clicks al botón.
            */}
            <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full bg-[#25D366]/40 blur-xl animate-pulse"
            />
            <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full bg-[#25D366] opacity-30 animate-ping"
            />
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClick}
                aria-label={ariaLabel}
                className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 ring-4 ring-white/60 transition-all hover:scale-110 hover:bg-[#1ebe5a] hover:shadow-xl hover:shadow-[#25D366]/40 focus:outline-none focus:ring-4 focus:ring-[#25D366]/40"
            >
                <WhatsAppIcon className="h-7 w-7" />
                {/*
                  Tooltip glass al hover: aparece a la izquierda del botón.
                  Backdrop-blur para que encaje con cualquier fondo del storefront.
                  pointer-events-none para que no interfiera con el clic en el botón.
                */}
                <span className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-xl border border-white/70 bg-white/85 px-3 py-1.5 text-sm font-semibold text-slate-800 opacity-0 shadow-lg backdrop-blur-md transition-opacity group-hover:opacity-100">
                    {ctaText}
                </span>
            </a>
        </div>
    )
}
