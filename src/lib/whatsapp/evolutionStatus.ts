import { EvolutionClient } from "@/lib/evolution"

export type EvolutionNormalizedStatus = "connected" | "disconnected" | "connecting"

interface EvolutionPhoneInfo {
    phoneNumber: string | null
    phoneNumberDisplay: string | null
}

export interface ResolvedEvolutionInstanceStatus extends EvolutionPhoneInfo {
    rawState: string | null
    status: EvolutionNormalizedStatus
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null
        ? (value as Record<string, unknown>)
        : null
}

function pickFirstString(...values: unknown[]): string | null {
    for (const value of values) {
        if (typeof value === "string" && value.trim().length > 0) {
            return value.trim()
        }
    }

    return null
}

function normalizePhoneNumber(value: string | null | undefined): EvolutionPhoneInfo {
    if (!value) {
        return {
            phoneNumber: null,
            phoneNumberDisplay: null,
        }
    }

    const phoneNumber = value.replace("@s.whatsapp.net", "").replace(/\D/g, "")

    if (!phoneNumber) {
        return {
            phoneNumber: null,
            phoneNumberDisplay: null,
        }
    }

    return {
        phoneNumber,
        phoneNumberDisplay: phoneNumber.length >= 4 ? phoneNumber.slice(-4) : phoneNumber,
    }
}

export function normalizeEvolutionStatus(
    state: string | null | undefined
): EvolutionNormalizedStatus {
    const normalized = String(state || "").toLowerCase()

    if (["open", "connected"].includes(normalized)) {
        return "connected"
    }

    if (["connecting", "qr", "qrcode", "pairing"].includes(normalized)) {
        return "connecting"
    }

    return "disconnected"
}

export function extractEvolutionState(payload: unknown): string | null {
    const record = asRecord(payload)
    if (!record) {
        return null
    }

    const connection = asRecord(record.connection)
    const instance = asRecord(record.instance)
    const data = asRecord(record.data)
    const dataConnection = asRecord(data?.connection)
    const dataInstance = asRecord(data?.instance)

    return pickFirstString(
        record.state,
        record.status,
        record.connectionState,
        record.connectionStatus,
        connection?.state,
        connection?.status,
        connection?.connectionState,
        connection?.connectionStatus,
        instance?.state,
        instance?.status,
        instance?.connectionState,
        instance?.connectionStatus,
        data?.state,
        data?.status,
        data?.connectionState,
        data?.connectionStatus,
        dataConnection?.state,
        dataConnection?.status,
        dataConnection?.connectionState,
        dataConnection?.connectionStatus,
        dataInstance?.state,
        dataInstance?.status,
        dataInstance?.connectionState,
        dataInstance?.connectionStatus,
    )
}

export function extractEvolutionPhone(payload: unknown): EvolutionPhoneInfo {
    const record = asRecord(payload)
    if (!record) {
        return {
            phoneNumber: null,
            phoneNumberDisplay: null,
        }
    }

    const connection = asRecord(record.connection)
    const instance = asRecord(record.instance)
    const data = asRecord(record.data)
    const dataConnection = asRecord(data?.connection)
    const dataInstance = asRecord(data?.instance)

    const candidate = pickFirstString(
        record.phoneNumber,
        record.phone,
        record.owner,
        record.number,
        record.jid,
        record.wuid,
        connection?.phoneNumber,
        connection?.phone,
        connection?.owner,
        connection?.jid,
        connection?.wuid,
        instance?.phoneNumber,
        instance?.phone,
        instance?.owner,
        instance?.jid,
        instance?.wuid,
        data?.phoneNumber,
        data?.phone,
        data?.owner,
        data?.number,
        data?.jid,
        data?.wuid,
        dataConnection?.phoneNumber,
        dataConnection?.phone,
        dataConnection?.owner,
        dataConnection?.jid,
        dataConnection?.wuid,
        dataInstance?.phoneNumber,
        dataInstance?.phone,
        dataInstance?.owner,
        dataInstance?.jid,
        dataInstance?.wuid,
    )

    return normalizePhoneNumber(candidate)
}

export async function resolveEvolutionInstanceStatus(
    evolutionClient: EvolutionClient,
    instanceName: string
): Promise<ResolvedEvolutionInstanceStatus> {
    let connectionPayload: unknown = null
    let instancePayload: unknown = null
    let lastError: Error | null = null

    try {
        connectionPayload = await evolutionClient.getConnectionStatus(instanceName)
    } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
    }

    try {
        instancePayload = await evolutionClient.getInstance(instanceName)
    } catch (error) {
        if (!lastError) {
            lastError = error instanceof Error ? error : new Error(String(error))
        }
    }

    const rawState = extractEvolutionState(connectionPayload) || extractEvolutionState(instancePayload)
    const fromConnection = extractEvolutionPhone(connectionPayload)
    const fromInstance = extractEvolutionPhone(instancePayload)
    const phone = fromConnection.phoneNumber ? fromConnection : fromInstance

    if (!rawState && !instancePayload && lastError) {
        throw lastError
    }

    return {
        rawState,
        status: normalizeEvolutionStatus(rawState),
        phoneNumber: phone.phoneNumber,
        phoneNumberDisplay: phone.phoneNumberDisplay,
    }
}
