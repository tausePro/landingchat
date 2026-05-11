/**
 * Stub de PaymentGateway para Addi (BNPL — Buy Now, Pay Later).
 *
 * Addi no expone documentación pública de API. Para integrar:
 *   1. Solicitar onboarding directo en https://www.addi.com (sales)
 *   2. Recibir credenciales merchant + URL de checkout
 *   3. Implementar `createTransaction` para crear orden BNPL y obtener URL de redirección
 *   4. Implementar `parseWebhook` con la firma que documenten
 *   5. Activar `enabled: true` en `registry.ts`
 *
 * Mientras tanto, este stub deja el provider registrado pero deshabilitado,
 * para poder iterar incrementalmente sin romper el resto.
 */

import { logger } from "@/lib/logger"
import type { Bank } from "@/types/payment"
import type {
    PaymentGateway,
    GatewayConfig,
    TransactionInput,
    TransactionResult,
    TransactionDetails,
    TokenResult,
    CardData,
    WebhookParseResult,
} from "./types"

const log = logger("payments/addi")

const NOT_IMPLEMENTED = "Integración Addi pendiente de credenciales y documentación de API"

export class AddiGateway implements PaymentGateway {
    readonly provider = "addi" as const
    private config: GatewayConfig

    constructor(config: GatewayConfig) {
        this.config = config
        log.warn("AddiGateway instanciado pero está deshabilitado", { isTestMode: config.isTestMode })
    }

    async createTransaction(_input: TransactionInput): Promise<TransactionResult> {
        void _input
        return {
            success: false,
            status: "error",
            error: NOT_IMPLEMENTED,
        }
    }

    async getTransaction(_transactionId: string): Promise<TransactionDetails> {
        void _transactionId
        throw new Error(NOT_IMPLEMENTED)
    }

    async getTransactionByReference(_reference: string): Promise<TransactionDetails> {
        void _reference
        throw new Error(NOT_IMPLEMENTED)
    }

    async tokenizeCard(_card: CardData): Promise<TokenResult> {
        void _card
        return {
            success: false,
            error: NOT_IMPLEMENTED,
        }
    }

    async getBanks(): Promise<Bank[]> {
        return []
    }

    async testConnection(): Promise<boolean> {
        return false
    }

    validateWebhookSignature(_payload: unknown, _signature: string): boolean {
        void _payload
        void _signature
        return false
    }

    async parseWebhook(_request: Request): Promise<WebhookParseResult> {
        void _request
        return {
            isValid: false,
            event: null,
            error: NOT_IMPLEMENTED,
            httpStatus: 501,
        }
    }
}
