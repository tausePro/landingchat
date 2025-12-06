/**
 * Catch-all Webhook Handler para Evolution API v2.x
 * Evolution envía eventos a rutas específicas como:
 * - /api/webhooks/whatsapp/messages-upsert
 * - /api/webhooks/whatsapp/connection-update
 */

import { NextRequest } from "next/server"

// Re-exportar el handler principal
export { POST, GET } from "../route"

// El parámetro [...event] captura cualquier ruta después de /whatsapp/
// y la procesa con el mismo handler
