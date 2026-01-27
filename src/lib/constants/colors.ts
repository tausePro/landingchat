export const COLOR_MAP: Record<string, string> = {
    // Básicos
    "blanco": "#FFFFFF",
    "negro": "#000000",
    "gris": "#808080",
    "rojo": "#EF4444",
    "azul": "#3B82F6",
    "verde": "#10B981",
    "amarillo": "#F59E0B",
    "naranja": "#F97316",
    "morado": "#8B5CF6",
    "rosa": "#EC4899",
    "cafe": "#78350F",
    "café": "#78350F",
    "beige": "#F5F5DC",

    // Variaciones comunes
    "gris claro": "#D1D5DB",
    "gris oscuro": "#374151",
    "azul marino": "#1E3A8A",
    "azul claro": "#93C5FD",
    "azul cielo": "#BAE6FD",
    "verde claro": "#6EE7B7",
    "verde oscuro": "#064E3B",
    "vino": "#7F1D1D",
    "tinto": "#7F1D1D",

    // Específicos del usuario (según reporte)
    "gris haspe": "#9CA3AF", // Un gris medio texturizado visualmente
    "rojo oscuro": "#991B1B",
    "negro mate": "#171717",

    // Otros
    "oro": "#FFD700",
    "plata": "#C0C0C0",
    "bronce": "#CD7F32",
    "crema": "#FFFDD0",
    "marfil": "#FFFFF0",
    "coral": "#FF7F50",
    "turquesa": "#40E0D0",
    "lavanda": "#E6E6FA",
    "lila": "#C8A2C8",
    "mostaza": "#FFDB58",
    "tabaco": "#714816",
    "miel": "#A98307",
};

export function getColorHex(colorName: string): string {
    if (!colorName) return "#E5E7EB"; // Default gray-200

    // Normalize input: lowercase and trim
    const normalized = colorName.toLowerCase().trim();

    // Check map
    if (COLOR_MAP[normalized]) {
        return COLOR_MAP[normalized];
    }

    // Check if it's already a valid hex code
    if (normalized.startsWith("#") && (normalized.length === 4 || normalized.length === 7)) {
        return colorName;
    }

    // Fallback: Return original (maybe it's a valid English color) or a default
    // We return the input so CSS tries to use it, but if it fails it fails.
    // Ideally we could return a specific fallback if not found to avoid transparency.
    return colorName;
}
