/**
 * Utilidades para testing de webhooks de pagos
 * Genera payloads y firmas para Wompi y ePayco
 */

import crypto from "crypto"
import { vi } from "vitest"

// Tipos para los payloads de webhooks
export interface WompiWebhookPayload {
    event: string
    data: {
        transaction: {
            id: string
            reference: string
            status: string
            amount_in_cents: number
            currency: string
            payment_method_type: string
            created_at: string
            finalized_at?: string
        }
    }
    signature: {
        checksum: string
        properties: string[]
    }
    timestamp: number
}

export interface EpaycoWebhookPayload {
    x_ref_payco: string
    x_id_invoice: string
    x_description: string
    x_amount: string
    x_amount_country: string
    x_amount_ok: string
    x_tax: string
    x_amount_base: string
    x_currency_code: string
    x_bank_name: string
    x_cardnumber: string
    x_quotas: string
    x_response: string
    x_approval_code: string
    x_transaction_id: string
    x_fecha_transaccion: string
    x_transaction_date: string
    x_cod_response: string
    x_response_reason_text: string
    x_errorcode: string
    x_franchise: string
    x_business: string
    x_customer_doctype: string
    x_customer_document: string
    x_customer_name: string
    x_customer_lastname: string
    x_customer_email: string
    x_customer_phone: string
    x_customer_movil: string
    x_customer_ind_pais: string
    x_customer_country: string
    x_customer_city: string
    x_customer_address: string
    x_customer_ip: string
    x_signature: string
    x_test_request: string
    x_extra1?: string
    x_extra2?: string
    x_extra3?: string
}

/**
 * Genera un payload de webhook de Wompi con firma válida
 */
export function generateWompiWebhookPayload(
    transactionId: string,
    reference: string,
    status: "APPROVED" | "DECLINED" | "PENDING" | "VOIDED" | "ERROR",
    amountInCents: number,
    integritySecret?: string
): WompiWebhookPayload {
    const timestamp = Date.now()
    const payload: WompiWebhookPayload = {
        event: "transaction.updated",
        data: {
            transaction: {
                id: transactionId,
                reference,
                status,
                amount_in_cents: amountInCents,
                currency: "COP",
                payment_method_type: "CARD",
                created_at: new Date().toISOString(),
                finalized_at: status !== "PENDING" ? new Date().toISOString() : undefined,
            }
        },
        signature: {
            checksum: "",
            properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"]
        },
        timestamp
    }

    // Generar firma si se proporciona el secret
    if (integritySecret) {
        const stringToSign = `${payload.data.transaction.id}${payload.data.transaction.status}${payload.data.transaction.amount_in_cents}${timestamp}${integritySecret}`
        payload.signature.checksum = crypto
            .createHash("sha256")
            .update(stringToSign)
            .digest("hex")
    }

    return payload
}

/**
 * Genera un payload de webhook de ePayco con firma válida
 */
export function generateEpaycoWebhookPayload(
    refPayco: string,
    transactionId: string,
    invoice: string,
    amount: string,
    codResponse: "1" | "2" | "3" | "4" | "6", // 1=approved, 2=declined, 3=pending, 4=error, 6=voided
    publicKey?: string,
    privateKey?: string
): EpaycoWebhookPayload {
    const payload: EpaycoWebhookPayload = {
        x_ref_payco: refPayco,
        x_id_invoice: invoice,
        x_description: "Test payment",
        x_amount: amount,
        x_amount_country: amount,
        x_amount_ok: amount,
        x_tax: "0",
        x_amount_base: amount,
        x_currency_code: "COP",
        x_bank_name: "Test Bank",
        x_cardnumber: "****1234",
        x_quotas: "1",
        x_response: codResponse === "1" ? "Aceptada" : "Rechazada",
        x_approval_code: codResponse === "1" ? "123456" : "",
        x_transaction_id: transactionId,
        x_fecha_transaccion: new Date().toISOString(),
        x_transaction_date: new Date().toISOString(),
        x_cod_response: codResponse,
        x_response_reason_text: codResponse === "1" ? "Transacción aprobada" : "Transacción rechazada",
        x_errorcode: codResponse === "1" ? "00" : "05",
        x_franchise: "visa",
        x_business: "test_business",
        x_customer_doctype: "CC",
        x_customer_document: "12345678",
        x_customer_name: "Test",
        x_customer_lastname: "User",
        x_customer_email: "test@example.com",
        x_customer_phone: "1234567890",
        x_customer_movil: "1234567890",
        x_customer_ind_pais: "CO",
        x_customer_country: "Colombia",
        x_customer_city: "Bogotá",
        x_customer_address: "Test Address",
        x_customer_ip: "127.0.0.1",
        x_signature: "",
        x_test_request: "TRUE",
        x_extra1: invoice,
    }

    // Generar firma si se proporcionan las claves
    if (publicKey && privateKey) {
        const stringToSign = [
            publicKey,
            privateKey,
            payload.x_ref_payco,
            payload.x_transaction_id,
            payload.x_amount,
            payload.x_currency_code,
        ].join("")

        payload.x_signature = crypto
            .createHash("sha256")
            .update(stringToSign)
            .digest("hex")
    }

    return payload
}

/**
 * Genera una firma inválida para testing de validación
 */
export function generateInvalidSignature(): string {
    return crypto.randomBytes(32).toString("hex")
}

/**
 * Mock de Supabase para testing de webhooks
 */
export function createMockSupabase() {
    const mockFrom = vi.fn()
    const mockSelect = vi.fn()
    const mockEq = vi.fn()
    const mockSingle = vi.fn()
    const mockInsert = vi.fn()
    const mockUpdate = vi.fn()

    // Configurar cadena de métodos para queries
    const createQueryChain = () => ({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
    })

    const createInsertChain = () => ({
        select: mockSelect,
        single: mockSingle,
    })

    const createUpdateChain = () => ({
        eq: mockEq,
    })

    mockFrom.mockReturnValue(createQueryChain())
    mockSelect.mockReturnValue(createQueryChain())
    mockEq.mockReturnValue(createQueryChain())
    mockInsert.mockReturnValue(createInsertChain())
    mockUpdate.mockReturnValue(createUpdateChain())
    mockSingle.mockResolvedValue({ data: null, error: null })

    return {
        from: mockFrom,
        mocks: {
            from: mockFrom,
            select: mockSelect,
            eq: mockEq,
            single: mockSingle,
            insert: mockInsert,
            update: mockUpdate,
        }
    }
}

/**
 * Configuraciones de testing para organizaciones y gateways
 */
export const TEST_ORG = {
    id: "test-org-id",
    slug: "test-org",
}

export const TEST_WOMPI_CONFIG = {
    id: "wompi-config-id",
    organization_id: TEST_ORG.id,
    provider: "wompi",
    public_key: "pub_test_key",
    private_key_encrypted: "encrypted_private_key",
    integrity_secret_encrypted: "encrypted_integrity_secret",
    is_test_mode: true,
}

export const TEST_EPAYCO_CONFIG = {
    id: "epayco-config-id",
    organization_id: TEST_ORG.id,
    provider: "epayco",
    public_key: "test_public_key",
    private_key_encrypted: "encrypted_private_key",
    is_test_mode: true,
}

/**
 * Datos de transacciones de prueba
 */
export const TEST_TRANSACTION = {
    id: "test-tx-id",
    organization_id: TEST_ORG.id,
    amount: 50000, // $500.00 COP
    currency: "COP",
    status: "pending" as const,
    provider: "wompi" as const,
    provider_transaction_id: "wompi-tx-123",
    provider_reference: "ref-123",
    order_id: "order-123",
}

/**
 * Utilidad para crear requests de webhook
 */
export function createWebhookRequest(
    url: string,
    payload: WompiWebhookPayload | EpaycoWebhookPayload,
    contentType: "application/json" | "application/x-www-form-urlencoded" = "application/json"
): Request {
    const body = contentType === "application/json" 
        ? JSON.stringify(payload)
        : new URLSearchParams(payload as Record<string, string>).toString()

    return new Request(url, {
        method: "POST",
        headers: {
            "content-type": contentType,
        },
        body,
    })
}