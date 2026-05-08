/**
 * Formato de precio en pesos colombianos sin decimales.
 * Usado por todos los componentes del checkout para consistencia.
 */
export function formatPrice(price: number): string {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
    }).format(price)
}
