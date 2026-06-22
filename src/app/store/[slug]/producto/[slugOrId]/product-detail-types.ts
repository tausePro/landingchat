// Tipos compartidos de la ficha de producto. Extraídos de product-detail-client.tsx
// como parte del refactor del monolito (2.320 líneas) a componentes modulares.

export interface ProductSectionLink {
    id: string
    label: string
}

export type FormatPriceFn = (amount: number) => string

export interface ProductShippingCardLabels {
    activeLabel: string
    productHasFree: string
    qualifies: (zonesText: string) => string
    remaining: (remainingPrice: string, zonesText: string) => string
    available: (zonesText: string) => string
}

export interface ProductVideoBlockLabels {
    eyebrow: string
    title: string
    iframeTitle: string
    description: string
}
