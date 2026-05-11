/**
 * Factory para crear instancias de pasarelas de pago.
 *
 * Single source of truth: `PROVIDER_REGISTRY`. Para añadir un proveedor
 * nuevo basta con registrarlo allí; este archivo no necesita cambios.
 */

import type { PaymentGatewayConfig } from "@/types/payment"
import type { PaymentGateway, GatewayConfig } from "./types"
import { getProviderInfo } from "./registry"
import { decrypt } from "@/lib/utils/encryption"

/**
 * Crea una instancia de PaymentGateway según la configuración persistida en
 * `payment_gateway_configs`. Desencripta los secretos si vienen encriptados,
 * o usa los ya desencriptados que pasen los callers que ya hicieron decrypt.
 *
 * @throws Error si el provider no está registrado o no está habilitado
 */
export function createPaymentGateway(
    config: PaymentGatewayConfig,
    decryptedPrivateKey?: string,
    decryptedIntegritySecret?: string,
    decryptedEncryptionKey?: string
): PaymentGateway {
    const providerInfo = getProviderInfo(config.provider)
    if (!providerInfo) {
        throw new Error(`Proveedor de pago no soportado: ${config.provider}`)
    }
    if (!providerInfo.enabled) {
        throw new Error(
            `Proveedor "${config.provider}" registrado pero deshabilitado (pendiente de implementación o credenciales)`
        )
    }

    const privateKey =
        decryptedPrivateKey ??
        (config.private_key_encrypted ? decrypt(config.private_key_encrypted) : "")

    const integritySecret =
        decryptedIntegritySecret ??
        (config.integrity_secret_encrypted
            ? decrypt(config.integrity_secret_encrypted)
            : undefined)

    const encryptionKey =
        decryptedEncryptionKey ??
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

    return providerInfo.create(gatewayConfig)
}

/**
 * Carga la pasarela activa de una organización.
 * Usa el cliente de Supabase que se le pase (service o anon).
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
