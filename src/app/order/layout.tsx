type Props = {
    children: React.ReactNode
}

// Layout intencionalmente vacío: la página /order/[orderId] resuelve la
// organización por subdomain o custom_domain con resolvePublicOrganization
// y monta su propio MetaPixel + TrackingProvider. Duplicar el provider aquí
// causaba doble PageView y doble Purchase en custom_domain (ej. tez.com.co).
export default function OrderLayout({ children }: Props) {
    return <>{children}</>
}
