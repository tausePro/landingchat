/**
 * Utilidades para acceso seguro a localStorage
 *
 * Valida que los valores recuperados sean UUIDs válidos antes de usarlos
 * para prevenir inyección de datos maliciosos.
 */

// Regex para validar UUID v4
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Valida si una cadena es un UUID válido
 */
export function isValidUUID(value: string | null | undefined): boolean {
    if (!value) return false
    return UUID_REGEX.test(value)
}

/**
 * Obtiene un valor de localStorage y valida que sea un UUID válido
 * Retorna null si el valor no existe o no es un UUID válido
 */
export function getStoredUUID(key: string): string | null {
    if (typeof window === 'undefined') return null

    try {
        const value = localStorage.getItem(key)
        if (value && isValidUUID(value)) {
            return value
        }
        // Si el valor existe pero no es válido, lo eliminamos por seguridad
        if (value) {
            console.warn(`[storage] Invalid UUID found for key "${key}", removing`)
            localStorage.removeItem(key)
        }
        return null
    } catch {
        // localStorage puede fallar en modo privado o si está deshabilitado
        return null
    }
}

/**
 * Guarda un UUID en localStorage después de validarlo
 * Retorna true si se guardó exitosamente
 */
export function setStoredUUID(key: string, value: string): boolean {
    if (typeof window === 'undefined') return false

    if (!isValidUUID(value)) {
        console.warn(`[storage] Attempted to store invalid UUID for key "${key}"`)
        return false
    }

    try {
        localStorage.setItem(key, value)
        return true
    } catch {
        return false
    }
}

/**
 * Obtiene una cadena de localStorage (para valores que no son UUIDs)
 * Sanitiza el valor para prevenir XSS
 */
export function getStoredString(key: string, maxLength: number = 255): string | null {
    if (typeof window === 'undefined') return null

    try {
        const value = localStorage.getItem(key)
        if (!value) return null

        // Sanitizar: limitar longitud y eliminar caracteres potencialmente peligrosos
        const sanitized = value
            .slice(0, maxLength)
            .replace(/[<>]/g, '') // Eliminar < y > para prevenir HTML injection

        return sanitized
    } catch {
        return null
    }
}

/**
 * Guarda una cadena en localStorage
 */
export function setStoredString(key: string, value: string): boolean {
    if (typeof window === 'undefined') return false

    try {
        localStorage.setItem(key, value)
        return true
    } catch {
        return false
    }
}

/**
 * Elimina un valor de localStorage
 */
export function removeStoredValue(key: string): boolean {
    if (typeof window === 'undefined') return false

    try {
        localStorage.removeItem(key)
        return true
    } catch {
        return false
    }
}
