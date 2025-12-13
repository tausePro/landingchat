#!/usr/bin/env node

/**
 * Prueba que la encriptación funcione correctamente
 */

// Cargar variables de entorno
require('dotenv').config({ path: '.env.local' })

const { encrypt, decrypt } = require('../src/lib/utils/encryption.ts')

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