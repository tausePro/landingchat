/**
 * Utilidades de encriptación para credenciales sensibles
 * Usa AES-256-GCM para encriptar/desencriptar
 */

import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Obtiene la llave de encriptación del entorno
 */
function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY
    if (!key) {
        throw new Error("ENCRYPTION_KEY no está configurada en las variables de entorno")
    }
    // La llave debe ser de 32 bytes para AES-256
    return crypto.scryptSync(key, "salt", 32)
}

/**
 * Encripta un texto usando AES-256-GCM
 * @param text - Texto a encriptar
 * @returns Texto encriptado en formato base64 (iv:authTag:encrypted)
 */
export function encrypt(text: string): string {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    let encrypted = cipher.update(text, "utf8", "hex")
    encrypted += cipher.final("hex")

    const authTag = cipher.getAuthTag()

    // Formato: iv:authTag:encrypted (todo en hex)
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`
}

/**
 * Desencripta un texto encriptado con AES-256-GCM
 * @param encryptedText - Texto encriptado en formato iv:authTag:encrypted
 * @returns Texto original
 */
export function decrypt(encryptedText: string): string {
    const key = getEncryptionKey()
    const parts = encryptedText.split(":")

    if (parts.length !== 3) {
        throw new Error("Formato de texto encriptado inválido")
    }

    const iv = Buffer.from(parts[0], "hex")
    const authTag = Buffer.from(parts[1], "hex")
    const encrypted = parts[2]

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, "hex", "utf8")
    decrypted += decipher.final("utf8")

    return decrypted
}

/**
 * Verifica si un texto está encriptado (tiene el formato correcto)
 */
export function isEncrypted(text: string): boolean {
    const parts = text.split(":")
    if (parts.length !== 3) return false

    // Verificar que cada parte sea hex válido
    const hexRegex = /^[0-9a-f]+$/i
    return parts.every((part) => hexRegex.test(part))
}
