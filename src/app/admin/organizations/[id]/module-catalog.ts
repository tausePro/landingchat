/**
 * Catálogo de módulos asignables por tenant (Admin S3).
 * Mismo universo que MODULE_TO_NAV del dashboard-layout.
 * (Archivo aparte: los "use server" solo pueden exportar funciones async.)
 */

export const MODULE_CATALOG = [
    { id: "conversations", label: "Chats", group: "Core" },
    { id: "products", label: "Productos", group: "Core" },
    { id: "orders", label: "Pedidos", group: "Core" },
    { id: "customers", label: "Clientes", group: "Core" },
    { id: "agent", label: "Agente IA", group: "Core" },
    { id: "settings", label: "Configuración", group: "Core" },
    { id: "categories", label: "Categorías", group: "Tienda" },
    { id: "media", label: "Media", group: "Tienda" },
    { id: "shipping", label: "Envíos", group: "Tienda" },
    { id: "coupons", label: "Cupones", group: "Tienda" },
    { id: "payments", label: "Pagos", group: "Tienda" },
    { id: "appointments", label: "Citas / Booking", group: "Servicios" },
    { id: "properties", label: "Propiedades", group: "Inmobiliaria" },
    { id: "leads", label: "Leads", group: "Inmobiliaria" },
    { id: "advisors", label: "Asesores", group: "Inmobiliaria" },
    { id: "documents", label: "Documentos", group: "Inmobiliaria" },
] as const

export const VALID_MODULE_IDS: ReadonlySet<string> = new Set(
    MODULE_CATALOG.map((module) => module.id as string)
)
