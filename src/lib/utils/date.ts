/**
 * date.ts
 * ----------------------------------------------------------------------------
 * Helpers de formateo de fecha con timezone fija de Colombia (America/Bogota).
 *
 * MOTIVO
 * Los servidores Node/Vercel donde corre LandingChat usan UTC por default.
 * Cuando un componente SSR llama `new Date(iso).toLocaleDateString('es-CO', ...)`
 * sin especificar `timeZone`, obtiene la hora UTC del servidor, no la hora
 * local de Colombia. Eso produce el síntoma de "pedidos con hora corrida 5
 * horas" que vieron los clientes (ORD-20260421-278 mostrando 08:52 pm cuando
 * se creó a las 03:52 pm hora Colombia).
 *
 * POLÍTICA
 * LandingChat es LATAM-first, con tenants en Colombia, Ecuador, Perú y
 * México. Todos esos países están en UTC-5 o UTC-6 sin DST. Hoy forzamos
 * America/Bogota (UTC-5) para todos los tenants. Si más adelante necesitamos
 * servir tenants fuera de UTC-5 (por ejemplo Brasil o México estacional),
 * extendemos este helper para que reciba la timezone de la organización
 * desde `organizations.settings.timezone` y dejamos America/Bogota como
 * fallback.
 *
 * USO
 *   import { formatBogotaDateTime } from "@/lib/utils/date"
 *   // En un componente server o client:
 *   <p>Creado el {formatBogotaDateTime(order.created_at)}</p>
 *
 * CATEGORÍAS
 *   - formatBogotaDateLong    → "21 de abril de 2026 a las 03:52 p. m."
 *   - formatBogotaDate        → "21 abr 2026"
 *   - formatBogotaDateNumeric → "21/04/2026"
 *   - formatBogotaTime        → "03:52 p. m."
 *   - formatBogotaDayKey      → "21 abr"   (úsalo para agrupaciones y charts)
 *
 * REFERENCIAS
 *   - docs-private/PUNCHLIST_HARDENING_PLATAFORMA_2026-04.md §0.4 post-mortem
 *   - Bug reportado 2026-04-21 con orden ORD-20260421-278
 */

/**
 * Timezone fija de la plataforma. Centralizamos el literal para que cualquier
 * cambio futuro (por ejemplo soporte multi-región) se haga en un solo lugar.
 */
export const LANDINGCHAT_TIME_ZONE = "America/Bogota"

/**
 * Input que acepta cualquier representación estándar de fecha: ISO string,
 * millis epoch o instancia Date. Devuelve null si la entrada es null/undefined
 * o si resulta en un Date inválido.
 */
export type DateLike = Date | string | number | null | undefined

function toDateOrNull(value: DateLike): Date | null {
    if (value === null || value === undefined) return null
    if (value === "") return null
    const d = value instanceof Date ? value : new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Formatea una fecha como "21 de abril de 2026 a las 03:52 p. m." en hora
 * Colombia. Usar en detalles de orden, transacciones, confirmaciones al
 * cliente.
 */
export function formatBogotaDateTime(value: DateLike): string {
    const date = toDateOrNull(value)
    if (!date) return ""
    return date.toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: LANDINGCHAT_TIME_ZONE,
    })
}

/**
 * Formato corto para listados y tablas: "21 abr 2026".
 */
export function formatBogotaDate(value: DateLike): string {
    const date = toDateOrNull(value)
    if (!date) return ""
    return date.toLocaleDateString("es-CO", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: LANDINGCHAT_TIME_ZONE,
    })
}

/**
 * Formato largo solo fecha (sin hora): "21 de abril de 2026". Úsalo en
 * separadores de día en chats, encabezados de sección o donde la hora ya
 * se muestra por separado.
 */
export function formatBogotaDateLong(value: DateLike): string {
    const date = toDateOrNull(value)
    if (!date) return ""
    return date.toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: LANDINGCHAT_TIME_ZONE,
    })
}

/**
 * Formato numérico: "21/04/2026". Util para exports CSV o contextos donde
 * se necesita un formato uniforme sin localización.
 */
export function formatBogotaDateNumeric(value: DateLike): string {
    const date = toDateOrNull(value)
    if (!date) return ""
    return date.toLocaleDateString("es-CO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: LANDINGCHAT_TIME_ZONE,
    })
}

/**
 * Solo la hora: "03:52 p. m.". Usar cuando el contexto visual ya deja
 * claro el día (mensajes recientes, chats activos).
 */
export function formatBogotaTime(value: DateLike): string {
    const date = toDateOrNull(value)
    if (!date) return ""
    return date.toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: LANDINGCHAT_TIME_ZONE,
    })
}

/**
 * Clave de agrupación por día en formato corto: "21 abr".
 *
 * Úsalo exclusivamente para agrupar ventas/eventos por día en charts y
 * resúmenes. En UTC, una venta hecha a las 23:30 hora Colombia aparece al
 * día siguiente (04:30 UTC del day+1). Con este helper cae al día correcto.
 */
export function formatBogotaDayKey(value: DateLike): string {
    const date = toDateOrNull(value)
    if (!date) return ""
    return date.toLocaleDateString("es-CO", {
        month: "short",
        day: "numeric",
        timeZone: LANDINGCHAT_TIME_ZONE,
    })
}

/**
 * Solo el mes abreviado: "abr". Útil para tarjetas de cita tipo calendario
 * donde el día se muestra grande aparte y debajo aparece el mes.
 */
export function formatBogotaMonthShort(value: DateLike): string {
    const date = toDateOrNull(value)
    if (!date) return ""
    return date.toLocaleDateString("es-CO", {
        month: "short",
        timeZone: LANDINGCHAT_TIME_ZONE,
    })
}
