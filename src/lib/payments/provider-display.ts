import type { PaymentProvider } from "@/types/payment"

/**
 * Metadata de presentación de cada pasarela para el checkout del cliente.
 *
 * Client-safe a propósito: NO importa el `registry` ni las clases gateway
 * (que usan `crypto`/`fetch` de Node y romperían el bundle del cliente). Es la
 * fuente de verdad de los textos de cara al comprador en el selector de pago.
 *
 * Para agregar una pasarela: añade su entrada aquí y el checkout la mostrará
 * con su nombre real, en vez de caer a un fallback genérico o etiquetarla mal.
 */
export interface ProviderDisplay {
    label: string
    description: string
}

const PROVIDER_DISPLAY: Record<PaymentProvider, ProviderDisplay> = {
    wompi: { label: "Wompi", description: "Tarjetas, PSE, Nequi" },
    epayco: { label: "ePayco", description: "Tarjetas y PSE" },
    bold: { label: "Bold", description: "Tarjetas, PSE, Nequi" },
    addi: { label: "Addi", description: "Paga a cuotas" },
}

export function getProviderDisplay(provider: string): ProviderDisplay {
    return PROVIDER_DISPLAY[provider as PaymentProvider] ?? { label: provider, description: "" }
}
