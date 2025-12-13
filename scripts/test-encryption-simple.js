#!/usr/bin/env node

/**
 * Prueba simple de encriptación
 */

const crypto = require('crypto')

// Cargar variables de entorno
require('dotenv').config({ path: '.env.local' })

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16

function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY
    if (!key) {
        throw new Error("ENCRYPTION_KEY no está configurada en las variables de entorno")
    }
    return crypto.scryptSync(key, "salt", 32)
}

function encrypt(text) {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    let encrypted = cipher.update(text, "utf8", "hex")
    encrypted += cipher.final("hex")

    const authTag = cipher.getAuthTag()
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`
}

function decrypt(encryptedText) {
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

async function testEncryption() {
    try {
        console.log('🧪 Probando encriptación...')
        
        const testData = 'test_epayco_key_12345'
        console.log(`📝 Texto original: ${testData}`)
        
        const encrypted = encrypt(testData)
        console.log(`🔒 Texto encriptado: ${encrypted}`)
        
        const decrypted = decrypt(encrypted)
        console.log(`🔓 Texto desencriptado: ${decrypted}`)
        
        if (testData === decrypted) {
            console.log('✅ Encriptación funcionando correctamente')
        } else {
            console.log('❌ Error: Los textos no coinciden')
        }
    } catch (error) {
        console.error('❌ Error en encriptación:', error.message)
    }
}

testEncryption()