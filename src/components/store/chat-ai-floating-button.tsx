"use client"

/**
 * Botón flotante azul (primaryColor del tenant) para abrir el chat IA
 * embebido del storefront.
 *
 * Es el fallback cuando el tenant NO tiene WhatsApp configurado:
 *   - Sin `whatsapp_instances` con instance_type='corporate' status='connected'
 *   - Sin `settings.whatsapp.phone` ni `settings.contact.phone`
 *
 * Si el tenant SÍ tiene WhatsApp, el caller debe renderizar
 * <WhatsAppFloatingButton/> en su lugar.
 */

interface ChatAIFloatingButtonProps {
    /**
     * Color principal del tenant (e.g. organization.settings.branding.primaryColor).
     */
    primaryColor: string
    /**
     * Callback al click (típicamente abre el panel de chat IA embebido).
     */
    onClick: () => void
    /**
     * Aria-label del botón. Default: "Iniciar chat".
     */
    ariaLabel?: string
}

export function ChatAIFloatingButton({
    primaryColor,
    onClick,
    ariaLabel = "Iniciar chat",
}: ChatAIFloatingButtonProps) {
    return (
        <div className="fixed bottom-6 right-6 z-50">
            <button
                onClick={onClick}
                aria-label={ariaLabel}
                className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg ring-4 ring-white/60 transition-transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300"
                style={{ backgroundColor: primaryColor }}
            >
                <span className="material-symbols-outlined text-3xl" aria-hidden="true">chat</span>
            </button>
        </div>
    )
}
