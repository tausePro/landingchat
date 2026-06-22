type UnknownRecord = Record<string, unknown>

function isPlainObject(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Deep-merge de `override` sobre `base`:
 * - Objetos planos se fusionan recursivamente.
 * - Arrays, primitivos y null REEMPLAZAN (no se fusionan).
 * - Llaves presentes en `base` pero ausentes en `override` se PRESERVAN.
 *
 * Sirve para guardar settings sin pisar llaves que un snapshot viejo del cliente
 * no incluya (evita data-loss, p.ej. borrar `videoSection` al guardar otro editor).
 */
export function deepMerge<T>(base: T, override: T): T {
    if (!isPlainObject(base) || !isPlainObject(override)) {
        return override
    }

    const result: UnknownRecord = { ...base }
    for (const key of Object.keys(override)) {
        const overrideValue = override[key]
        if (overrideValue === undefined) continue
        const baseValue = base[key]
        result[key] = isPlainObject(baseValue) && isPlainObject(overrideValue)
            ? deepMerge(baseValue, overrideValue)
            : overrideValue
    }

    return result as T
}
