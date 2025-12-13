#!/usr/bin/env node

/**
 * Genera una clave de encriptación segura para ENCRYPTION_KEY
 */

const crypto = require('crypto')

// Generar una clave aleatoria de 32 bytes (256 bits)
const encryptionKey = crypto.randomBytes(32).toString('hex')

console.log('🔐 Clave de encriptación generada:')
console.log('')
console.log(`ENCRYPTION_KEY=${encryptionKey}`)
console.log('')
console.log('📋 Copia esta línea a tu archivo .env.local')
console.log('⚠️  IMPORTANTE: Guarda esta clave de forma segura. Si la pierdes, no podrás desencriptar datos existentes.')