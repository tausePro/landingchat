/**
 * Generates a URL-safe slug from a product name
 * Handles Spanish characters and special cases
 */
export function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD') // Decompose combined characters
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (accents)
        .replace(/[^a-z0-9\s-]/g, '') // Keep only alphanumeric, spaces, and hyphens
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .trim()
}

/**
 * Generates a unique slug by appending a number if the slug already exists
 * @param baseSlug The base slug to start with
 * @param existingSlugs Array of slugs that already exist
 * @returns A unique slug
 */
export function generateUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
    let slug = baseSlug
    let counter = 2

    while (existingSlugs.includes(slug)) {
        slug = `${baseSlug}-${counter}`
        counter++
    }

    return slug
}

/**
 * Checks if a string is a valid UUID
 */
export function isUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(str)
}
