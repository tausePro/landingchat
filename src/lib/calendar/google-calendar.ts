// ═══════════════════════════════════════════════════════════════════
// Google Calendar Service — OAuth2 + CRUD de eventos por organización
//
// Flujo OAuth2:
//   1. Admin conecta GCal desde /dashboard/integrations
//   2. Redirect a Google consent → callback con code
//   3. Intercambiar code por tokens → guardar encriptados en `integrations`
//   4. Al agendar cita (schedule_appointment) → crear evento en GCal
//
// Tokens se guardan encriptados en integrations.credentials (jsonb)
// El refresh_token se usa para renovar access_token automáticamente
// ═══════════════════════════════════════════════════════════════════

import { google, calendar_v3 } from "googleapis"
import { encrypt, decrypt } from "@/lib/utils/encryption"
import { createServiceClient } from "@/lib/supabase/server"

// ─── Config ──────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID || ""
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || ""
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI || ""

const SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
]

// ─── OAuth2 Client ───────────────────────────────────────────────

export function createOAuth2Client() {
    return new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI
    )
}

/**
 * Genera la URL de consentimiento de Google para conectar el calendario.
 * El `state` lleva el org_id para identificar la org en el callback.
 */
export function getAuthUrl(organizationId: string): string {
    const oauth2Client = createOAuth2Client()
    return oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: SCOPES,
        state: organizationId,
    })
}

// ─── Token Management ────────────────────────────────────────────

interface StoredTokens {
    access_token: string
    refresh_token: string
    expiry_date: number
}

/**
 * Intercambia el code del callback por tokens y los guarda encriptados.
 */
export async function exchangeCodeForTokens(
    code: string,
    organizationId: string
): Promise<void> {
    const oauth2Client = createOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
        throw new Error("No se recibió refresh_token. Revoca el acceso en tu cuenta de Google e intenta de nuevo.")
    }

    // Obtener email de la cuenta de Google conectada
    let connectedEmail = ""
    try {
        oauth2Client.setCredentials(tokens)
        const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client })
        const userInfo = await oauth2.userinfo.get()
        connectedEmail = userInfo.data.email || ""
    } catch (emailError) {
        console.warn("[google-calendar] Could not fetch user email:", emailError)
    }

    const encryptedTokens: StoredTokens = {
        access_token: encrypt(tokens.access_token || ""),
        refresh_token: encrypt(tokens.refresh_token),
        expiry_date: tokens.expiry_date || 0,
    }

    const supabase = createServiceClient()

    // Upsert en integrations
    const { data: existing } = await supabase
        .from("integrations")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("provider", "google_calendar")
        .single()

    const integrationData = {
        organization_id: organizationId,
        provider: "google_calendar",
        status: "connected",
        credentials: encryptedTokens,
        config: {
            calendar_id: "primary",
            connected_at: new Date().toISOString(),
            connected_email: connectedEmail,
        },
        sync_enabled: true,
    }

    if (existing) {
        await supabase
            .from("integrations")
            .update(integrationData)
            .eq("id", existing.id)
    } else {
        await supabase
            .from("integrations")
            .insert(integrationData)
    }
}

/**
 * Obtiene un OAuth2 client autenticado para una org.
 * Renueva el access_token automáticamente si expiró.
 */
async function getAuthenticatedClient(
    organizationId: string
): Promise<InstanceType<typeof google.auth.OAuth2> | null> {
    const supabase = createServiceClient()

    const { data: integration } = await supabase
        .from("integrations")
        .select("id, credentials")
        .eq("organization_id", organizationId)
        .eq("provider", "google_calendar")
        .eq("status", "connected")
        .single()

    if (!integration?.credentials) return null

    const creds = integration.credentials as StoredTokens
    const oauth2Client = createOAuth2Client()

    try {
        oauth2Client.setCredentials({
            access_token: decrypt(creds.access_token),
            refresh_token: decrypt(creds.refresh_token),
            expiry_date: creds.expiry_date,
        })

        // Si el token expiró, renovarlo
        const now = Date.now()
        if (creds.expiry_date && creds.expiry_date < now) {
            const { credentials: newTokens } = await oauth2Client.refreshAccessToken()
            
            // Actualizar tokens en BD
            const updatedCreds: StoredTokens = {
                access_token: encrypt(newTokens.access_token || ""),
                refresh_token: creds.refresh_token, // Mantener el refresh_token encriptado original
                expiry_date: newTokens.expiry_date || 0,
            }

            await supabase
                .from("integrations")
                .update({ credentials: updatedCreds })
                .eq("id", integration.id)
        }

        return oauth2Client
    } catch (error) {
        console.error("[google-calendar] Error authenticating:", error)
        // Marcar como desconectado si los tokens son inválidos
        await supabase
            .from("integrations")
            .update({ status: "error", error_message: "Token inválido. Reconecta Google Calendar." })
            .eq("id", integration.id)
        return null
    }
}

// ─── Calendar Operations ─────────────────────────────────────────

export interface CalendarEventInput {
    title: string
    description?: string
    startDate: Date
    endDate: Date
    location?: string
    attendeeEmail?: string
}

/**
 * Crea un evento en Google Calendar de la org.
 * Retorna el event ID para guardarlo en appointments.google_event_id.
 */
export async function createCalendarEvent(
    organizationId: string,
    event: CalendarEventInput,
    advisorCalendarId?: string
): Promise<string | null> {
    const auth = await getAuthenticatedClient(organizationId)
    if (!auth) {
        console.log("[google-calendar] No authenticated client for org:", organizationId)
        return null
    }

    const calendar = google.calendar({ version: "v3", auth })
    const calendarId = advisorCalendarId || await getCalendarId(organizationId)

    const eventBody: calendar_v3.Schema$Event = {
        summary: event.title,
        description: event.description,
        location: event.location,
        start: {
            dateTime: event.startDate.toISOString(),
            timeZone: "America/Bogota",
        },
        end: {
            dateTime: event.endDate.toISOString(),
            timeZone: "America/Bogota",
        },
        reminders: {
            useDefault: false,
            overrides: [
                { method: "popup", minutes: 30 },
                { method: "email", minutes: 60 },
            ],
        },
    }

    if (event.attendeeEmail) {
        eventBody.attendees = [{ email: event.attendeeEmail }]
    }

    try {
        const response = await calendar.events.insert({
            calendarId,
            requestBody: eventBody,
            sendUpdates: event.attendeeEmail ? "all" : "none",
        })

        console.log("[google-calendar] Event created:", response.data.id)
        return response.data.id || null
    } catch (error) {
        console.error("[google-calendar] Error creating event:", error)
        return null
    }
}

/**
 * Actualiza un evento existente en Google Calendar.
 */
export async function updateCalendarEvent(
    organizationId: string,
    googleEventId: string,
    event: Partial<CalendarEventInput>
): Promise<boolean> {
    const auth = await getAuthenticatedClient(organizationId)
    if (!auth) return false

    const calendar = google.calendar({ version: "v3", auth })
    const calendarId = await getCalendarId(organizationId)

    const eventBody: calendar_v3.Schema$Event = {}
    if (event.title) eventBody.summary = event.title
    if (event.description) eventBody.description = event.description
    if (event.location) eventBody.location = event.location
    if (event.startDate) {
        eventBody.start = {
            dateTime: event.startDate.toISOString(),
            timeZone: "America/Bogota",
        }
    }
    if (event.endDate) {
        eventBody.end = {
            dateTime: event.endDate.toISOString(),
            timeZone: "America/Bogota",
        }
    }

    try {
        await calendar.events.patch({
            calendarId,
            eventId: googleEventId,
            requestBody: eventBody,
        })
        return true
    } catch (error) {
        console.error("[google-calendar] Error updating event:", error)
        return false
    }
}

/**
 * Cancela un evento en Google Calendar.
 */
export async function cancelCalendarEvent(
    organizationId: string,
    googleEventId: string
): Promise<boolean> {
    const auth = await getAuthenticatedClient(organizationId)
    if (!auth) return false

    const calendar = google.calendar({ version: "v3", auth })
    const calendarId = await getCalendarId(organizationId)

    try {
        await calendar.events.delete({
            calendarId,
            eventId: googleEventId,
        })
        return true
    } catch (error) {
        console.error("[google-calendar] Error deleting event:", error)
        return false
    }
}

/**
 * Verifica si la org tiene Google Calendar conectado.
 */
export async function isCalendarConnected(organizationId: string): Promise<boolean> {
    const supabase = createServiceClient()
    const { data } = await supabase
        .from("integrations")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("provider", "google_calendar")
        .eq("status", "connected")
        .single()

    return !!data
}

/**
 * Consulta los slots ocupados en Google Calendar (FreeBusy API).
 * Consulta TODOS los sub-calendarios de la cuenta, no solo primary.
 */
export async function getFreeBusySlots(
    organizationId: string,
    timeMin: Date,
    timeMax: Date
): Promise<Array<{ start: string; end: string }> | null> {
    const auth = await getAuthenticatedClient(organizationId)
    if (!auth) return null

    const calendar = google.calendar({ version: "v3", auth })
    const calendarIds = await getAllCalendarIds(organizationId, auth)

    try {
        const response = await calendar.freebusy.query({
            requestBody: {
                timeMin: timeMin.toISOString(),
                timeMax: timeMax.toISOString(),
                timeZone: "America/Bogota",
                items: calendarIds.map(id => ({ id })),
            },
        })

        const allBusy: Array<{ start: string; end: string }> = []
        const calendars = response.data.calendars || {}
        for (const calId of Object.keys(calendars)) {
            const busy = calendars[calId]?.busy || []
            for (const slot of busy) {
                allBusy.push({ start: slot.start || "", end: slot.end || "" })
            }
        }
        return allBusy
    } catch (error) {
        console.error("[google-calendar] Error querying free/busy:", error)
        return null
    }
}

/**
 * Lista eventos próximos de TODOS los sub-calendarios para un rango de fechas.
 */
export async function listUpcomingEvents(
    organizationId: string,
    timeMin: Date,
    timeMax: Date,
    maxResults: number = 50
): Promise<Array<{ id: string; summary: string; start: string; end: string }> | null> {
    const auth = await getAuthenticatedClient(organizationId)
    if (!auth) return null

    const calendar = google.calendar({ version: "v3", auth })
    const calendarIds = await getAllCalendarIds(organizationId, auth)

    try {
        const allEvents: Array<{ id: string; summary: string; start: string; end: string }> = []
        console.log(`[google-calendar] listUpcomingEvents: querying ${calendarIds.length} calendars from ${timeMin.toISOString()} to ${timeMax.toISOString()}`)

        for (const calId of calendarIds) {
            try {
                const response = await calendar.events.list({
                    calendarId: calId,
                    timeMin: timeMin.toISOString(),
                    timeMax: timeMax.toISOString(),
                    singleEvents: true,
                    orderBy: "startTime",
                    maxResults: Math.ceil(maxResults / calendarIds.length) + 10,
                })
                console.log(`[google-calendar] Calendar ${calId}: ${response.data.items?.length || 0} events`)

                for (const event of (response.data.items || [])) {
                    allEvents.push({
                        id: `${calId}:${event.id || ""}`,
                        summary: event.summary || "Sin título",
                        start: event.start?.dateTime || event.start?.date || "",
                        end: event.end?.dateTime || event.end?.date || "",
                    })
                }
            } catch (calError) {
                console.warn(`[google-calendar] Error listing events for ${calId}:`, calError)
            }
        }

        // Ordenar por fecha de inicio y limitar
        allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
        return allEvents.slice(0, maxResults)
    } catch (error) {
        console.error("[google-calendar] Error listing events:", error)
        return null
    }
}

/**
 * Lista todos los sub-calendarios de la cuenta de Google conectada.
 * Retorna los calendarios que el usuario posee o puede editar.
 */
export async function listSubCalendars(
    organizationId: string
): Promise<Array<{ id: string; name: string; color: string; isPrimary: boolean }> | null> {
    const auth = await getAuthenticatedClient(organizationId)
    if (!auth) return null

    const calendar = google.calendar({ version: "v3", auth })

    try {
        const response = await calendar.calendarList.list({
            minAccessRole: "writer",
        })

        return (response.data.items || []).map((cal) => ({
            id: cal.id || "",
            name: cal.summary || "Sin nombre",
            color: cal.backgroundColor || "#4285f4",
            isPrimary: cal.primary === true,
        }))
    } catch (error) {
        console.error("[google-calendar] Error listing sub-calendars:", error)
        return null
    }
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Obtiene todos los IDs de sub-calendarios de la cuenta.
 * Incluye primary y todos los calendarios accesibles.
 */
async function getAllCalendarIds(
    organizationId: string,
    auth: InstanceType<typeof google.auth.OAuth2>
): Promise<string[]> {
    try {
        const cal = google.calendar({ version: "v3", auth })
        const response = await cal.calendarList.list()
        const items = response.data.items || []
        const ids = items.map(c => c.id).filter(Boolean) as string[]
        console.log(`[google-calendar] getAllCalendarIds: found ${ids.length} calendars for org ${organizationId}`)
        return ids.length > 0 ? ids : ["primary"]
    } catch (error) {
        console.error("[google-calendar] getAllCalendarIds failed, falling back to primary:", error)
        return ["primary"]
    }
}

async function getCalendarId(organizationId: string): Promise<string> {
    const supabase = createServiceClient()
    const { data } = await supabase
        .from("integrations")
        .select("config")
        .eq("organization_id", organizationId)
        .eq("provider", "google_calendar")
        .single()

    return data?.config?.calendar_id || "primary"
}
