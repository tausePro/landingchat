/**
 * Tax calculation utilities
 * Lógica centralizada para cálculo de impuestos (IVA)
 * Prioridad: tax_rate del producto > tax_rate global de la org
 */

export interface OrgTaxSettings {
  tax_enabled: boolean
  tax_rate: number
  prices_include_tax: boolean
}

export interface TaxableItem {
  id: string
  price: number
  quantity: number
}

export interface TaxCalculationResult {
  totalTax: number
  baseSubtotal: number
  pricesIncludeTax: boolean
}

/**
 * Calcula el impuesto para un conjunto de items
 * @param items - Items del carrito/orden
 * @param productTaxMap - Map<productId, tax_rate | null>
 * @param orgSettings - Config de impuestos de la organización
 * @returns totalTax redondeado a 2 decimales, baseSubtotal (sin tax), flag pricesIncludeTax
 */
export function calculateTaxForItems(
  items: TaxableItem[],
  productTaxMap: Map<string, number | null>,
  orgSettings: OrgTaxSettings
): TaxCalculationResult {
  let totalTax = 0
  let baseSubtotal = 0

  items.forEach(item => {
    const itemTotal = item.price * item.quantity
    let itemTaxRate = 0

    // Prioridad: producto override > global org
    const productTaxRate = productTaxMap.get(item.id)

    if (productTaxRate !== null && productTaxRate !== undefined) {
      itemTaxRate = Number(productTaxRate)
    } else if (orgSettings.tax_enabled) {
      itemTaxRate = Number(orgSettings.tax_rate || 0)
    }

    if (itemTaxRate > 0) {
      if (orgSettings.prices_include_tax) {
        // Precio incluye IVA: extraer tax del precio
        const basePrice = itemTotal / (1 + (itemTaxRate / 100))
        totalTax += itemTotal - basePrice
        baseSubtotal += basePrice
      } else {
        // Precio NO incluye IVA: sumar tax al precio
        totalTax += itemTotal * (itemTaxRate / 100)
        baseSubtotal += itemTotal
      }
    } else {
      // Sin impuesto: base = precio tal cual
      baseSubtotal += itemTotal
    }
  })

  // Redondear a 2 decimales
  totalTax = Math.round(totalTax * 100) / 100
  baseSubtotal = Math.round(baseSubtotal * 100) / 100

  return {
    totalTax,
    baseSubtotal,
    pricesIncludeTax: orgSettings.prices_include_tax,
  }
}

/**
 * Construye el Map de tax_rate por producto desde un array de BD
 */
export function buildProductTaxMap(
  products: Array<{ id: string; tax_rate: number | null }> | null
): Map<string, number | null> {
  const map = new Map<string, number | null>()
  products?.forEach(p => map.set(p.id, p.tax_rate))
  return map
}
