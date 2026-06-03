// Datos mock del prototipo de chat (Tez). NO usa Supabase ni stores: todo es local
// para que la ruta /chat-preview renderice en cualquier entorno sin backend.

export interface PreviewProduct {
    id: string
    name: string
    description: string
    price: number
    compareAtPrice?: number
    accent: "rose" | "violet" | "teal"
    icon: string
    badge?: string
}

export interface CartLine {
    id: string
    name: string
    price: number
    quantity: number
}

export interface ChatMessage {
    id: string
    role: "assistant" | "user"
    text?: string
    products?: PreviewProduct[]
}

// Color de marca del tenant (Tez = teal). En producción vendría de la config de la
// organización (settings.branding.primaryColor); aquí es una constante para el preview.
export const BRAND = {
    primary: "#0FBCC9",
    primaryDark: "#0B97A1",
    name: "Tez",
    advisor: "Alejandra",
}

export const FREE_SHIPPING_THRESHOLD = 120_000

export const PRODUCTS: PreviewProduct[] = [
    {
        id: "toalla-facial",
        name: "Toalla Facial Tez",
        description: "Suave, absorbente y delicada con tu piel.",
        price: 15_000,
        compareAtPrice: 20_000,
        accent: "rose",
        icon: "spa",
        badge: "Oferta",
    },
    {
        id: "ritual-renovacion",
        name: "Ritual Renovación Total Tez",
        description: "El kit estrella para una rutina de piel completa.",
        price: 180_000,
        accent: "violet",
        icon: "auto_awesome",
    },
]

export const GIFT_PRODUCTS: PreviewProduct[] = [
    {
        id: "set-regalo",
        name: "Set Regalo Esencial",
        description: "Listo para regalar, con empaque premium.",
        price: 95_000,
        accent: "teal",
        icon: "redeem",
        badge: "Top regalo",
    },
    {
        id: "serum-botanico",
        name: "Sérum Resplandor Botánico",
        description: "Vitamina C + extractos de baba.",
        price: 89_000,
        accent: "rose",
        icon: "water_drop",
    },
]

export function formatPrice(value: number): string {
    return "$" + value.toLocaleString("es-CO")
}
