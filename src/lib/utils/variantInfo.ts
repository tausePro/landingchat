function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function getLegacyVariantPart(value: unknown): string | null {
  const record = asRecord(value)

  if (!record) {
    return null
  }

  const type = typeof record.type === "string" ? record.type.trim() : ""
  const values = Array.isArray(record.values)
    ? record.values.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : []

  if (type && values.length > 0) {
    return `${type}: ${values.join(", ")}`
  }

  if (values.length > 0) {
    return values.join(", ")
  }

  return null
}

export function formatVariantInfo(variantInfo: unknown): string | null {
  if (typeof variantInfo === "string") {
    const value = variantInfo.trim()
    return value.length > 0 ? value : null
  }

  if (Array.isArray(variantInfo)) {
    const parts = variantInfo
      .map((item) => getLegacyVariantPart(item))
      .filter((item): item is string => Boolean(item))

    return parts.length > 0 ? parts.join(" | ") : null
  }

  const record = asRecord(variantInfo)

  if (!record) {
    return null
  }

  if (typeof record.variant_title === "string") {
    const value = record.variant_title.trim()
    return value.length > 0 ? value : null
  }

  return null
}

export function appendVariantToItemName(name: string, variantInfo: unknown): string {
  const variantLabel = formatVariantInfo(variantInfo)

  if (!variantLabel) {
    return name
  }

  return `${name} (${variantLabel})`
}
