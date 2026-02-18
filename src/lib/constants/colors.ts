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
    "rosado": "#F472B6",
    "fucsia": "#D946EF",
    "cafe": "#78350F",
    "café": "#78350F",
    "beige": "#F5F5DC",

    // Variaciones de gris
    "gris claro": "#D1D5DB",
    "gris oscuro": "#374151",
    "gris haspe": "#9CA3AF",
    "gris medio": "#6B7280",

    // Variaciones de azul
    "azul marino": "#1E3A8A",
    "azul claro": "#93C5FD",
    "azul cielo": "#BAE6FD",
    "azul oscuro": "#1E3A8A",
    "azul rey": "#1D4ED8",
    "azul agua marina": "#06B6D4",
    "azul turqueza": "#14B8A6",
    "azul turquesa": "#14B8A6",
    "azul petroleo": "#0E7490",
    "azul petróleo": "#0E7490",
    "azul electrico": "#2563EB",
    "azul eléctrico": "#2563EB",
    "azul royal": "#1D4ED8",
    "azul pastel": "#BFDBFE",

    // Variaciones de verde
    "verde claro": "#6EE7B7",
    "verde oscuro": "#064E3B",
    "verde militar": "#4B5320",
    "verde oliva": "#556B2F",
    "verde antioquia": "#2D6A4F",
    "verde neon": "#39FF14",
    "verde esmeralda": "#047857",
    "verde menta": "#98F5E1",
    "verde botella": "#1B4332",
    "verde limón": "#84CC16",
    "verde limon": "#84CC16",

    // Variaciones de rojo/rosa
    "rojo oscuro": "#991B1B",
    "vino": "#7F1D1D",
    "tinto": "#7F1D1D",
    "rosado neon": "#FF69B4",
    "rosa neon": "#FF69B4",
    "rosa pastel": "#FBB6CE",
    "rosado pastel": "#FBB6CE",
    "magenta": "#D946EF",
    "salmon": "#FA8072",
    "salmón": "#FA8072",

    // Variaciones de amarillo/naranja
    "amarillo oscuro": "#B45309",
    "amarillo neon": "#FACC15",
    "amarillo pastel": "#FEF08A",
    "naranja neon": "#FF6700",
    "naranja oscuro": "#C2410C",
    "durazno": "#FBBF24",

    // Variaciones de negro/mate
    "negro mate": "#171717",
    "negro brillante": "#0A0A0A",

    // Metálicos y otros
    "oro": "#FFD700",
    "dorado": "#FFD700",
    "plata": "#C0C0C0",
    "plateado": "#C0C0C0",
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
    "arena": "#C2B280",
    "chocolate": "#7B3F00",
    "terracota": "#C75B39",
    "borgoña": "#800020",
    "borgona": "#800020",
    "caqui": "#BDB76B",
    "khaki": "#BDB76B",
    "hueso": "#E3DAC9",
    "perla": "#EAE0C8",
};

export function getColorHex(colorName: string): string {
    if (!colorName) return "#E5E7EB"; // Default gray-200

    // Normalize input: lowercase and trim
    const normalized = colorName.toLowerCase().trim();

    // 1. Match exacto
    if (COLOR_MAP[normalized]) {
        return COLOR_MAP[normalized];
    }

    // 2. Ya es hex válido
    if (normalized.startsWith("#") && (normalized.length === 4 || normalized.length === 7)) {
        return colorName;
    }

    // 3. Búsqueda parcial: "azul agua marina" podría matchear con "azul" si no está exacto
    // Primero buscar si alguna key del mapa contiene el nombre completo
    for (const [key, hex] of Object.entries(COLOR_MAP)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return hex;
        }
    }

    // 4. Fallback: gris neutro para que el swatch siempre sea visible
    return "#9CA3AF";
}

/**
 * Verifica si un color tiene un hex conocido en el mapa.
 * Útil para decidir si mostrar swatch o solo texto.
 */
export function isKnownColor(colorName: string): boolean {
    if (!colorName) return false;
    const normalized = colorName.toLowerCase().trim();
    if (COLOR_MAP[normalized]) return true;
    if (normalized.startsWith("#")) return true;
    for (const key of Object.keys(COLOR_MAP)) {
        if (normalized.includes(key) || key.includes(normalized)) return true;
    }
    return false;
}
