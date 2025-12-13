/**
 * Factory para crear instancias de pasarelas de pago
 */

import type { PaymentGatewayConfig } from "@/types/payment"
import type { PaymentGateway, GatewayConfig } from "./types"
import { WompiGateway } from "./wompi-gateway"
import { EpaycoGateway } from "./epayco-gateway"
import { decrypt } from "@/lib/utils/encryption"

/**
 * Crea una instancia de PaymentGateway según la configuración
 */
export function createPaymentGateway(
    config: PaymentGatewayConfig,
    decryptedPrivateKey?: string,
    decryptedIntegritySecret?: string,
    decryptedEncryptionKey?: string
): PaymentGateway {
    // Desencriptar credenciales si no se proporcionan ya desencriptadas
    const privateKey =
        decryptedPrivateKey ||
        (config.private_key_encrypted
            ? decrypt(config.private_key_encrypted)
            : "")

    const integritySecret =
        decryptedIntegritySecret ||
        (config.integrity_secret_encrypted
            ? decrypt(config.integrity_secret_encrypted)
            : undefined)

    const encryptionKey =
        decryptedEncryptionKey ||
        (config.encryption_key_encrypted
            ? decrypt(config.encryption_key_encrypted)
            : undefined)

    const gatewayConfig: GatewayConfig = {
        provider: config.provider,
        publicKey: config.public_key || "",
        privateKey,
        integritySecret,
        encryptionKey,
        isTestMode: config.is_test_mode,
    }

    switch (config.provider) {
        case "wompi":
            return new WompiGateway(gatewayConfig)
        case "epayco":
            return new EpaycoGateway(gatewayConfig)
        default:
            throw new Error(`Proveedor de pago no soportado: ${config.provider}`)
    }
}

/**
 * Obtiene la configuración de pasarela de pago para una organización
 */
export async function getOrganizationPaymentGateway(
    supabase: { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { eq: (column: string, value: boolean) => { single: () => Promise<{ data: PaymentGatewayConfig | null; error: Error | null }> } } } } },
    organizationId: string
): Promise<PaymentGateway | null> {
    const { data: config, error } = await supabase
        .from("payment_gateway_configs")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .single()

    if (error || !config) {
        return null
    }

    return createPaymentGateway(config as PaymentGatewayConfig)
}
