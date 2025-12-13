/**
 * Script de prueba para verificar la configuración de ePayco
 * Ejecutar con: node scripts/test-epayco-config.js
 */

const crypto = require('crypto')

// Datos de prueba de ePayco
const testData = {
    customerId: "12345", // P_CUST_ID_CLIENTE
    encryptionKey: "test_encryption_key", // P_ENCRYPTION_KEY
    x_ref_payco: "test_ref_123",
    x_transaction_id: "test_tx_456",
    x_amount: "10000",
    x_currency_code: "COP"
}

// Función para generar firma de ePayco
function generateEpaycoSignature(data) {
    const stringToSign = [
        data.customerId,
        data.encryptionKey,
        data.x_ref_payco,
        data.x_transaction_id,
        data.x_amount,
        data.x_currency_code,
    ].join("")

    const signature = crypto
        .createHash("sha256")
        .update(stringToSign)
        .digest("hex")

    return signature
}

// Función para validar firma de ePayco
function validateEpaycoSignature(payload, customerId, encryptionKey) {
    if (!customerId || !encryptionKey) {
        return false
    }

    const stringToSign = [
        customerId,
        encryptionKey,
        payload.x_ref_payco,
        payload.x_transaction_id,
        payload.x_amount,
        payload.x_currency_code,
    ].join("")

    const calculatedSignature = crypto
        .createHash("sha256")
        .update(stringToSign)
        .digest("hex")

    return calculatedSignature === payload.x_signature
}

// Ejecutar prueba
console.log("🧪 Probando configuración de ePayco...")
console.log("=====================================")

// Generar firma
const signature = generateEpaycoSignature(testData)
console.log("✅ Firma generada:", signature)

// Crear payload de webhook simulado
const webhookPayload = {
    x_ref_payco: testData.x_ref_payco,
    x_transaction_id: testData.x_transaction_id,
    x_amount: testData.x_amount,
    x_currency_code: testData.x_currency_code,
    x_signature: signature
}

// Validar firma
const isValid = validateEpaycoSignature(
    webhookPayload, 
    testData.customerId, 
    testData.encryptionKey
)

console.log("✅ Validación de firma:", isValid ? "EXITOSA" : "FALLIDA")

if (isValid) {
    console.log("🎉 La configuración de ePayco está funcionando correctamente!")
} else {
    console.log("❌ Hay un problema con la configuración de ePayco")
}

console.log("\n📋 Datos de prueba utilizados:")
console.log("- P_CUST_ID_CLIENTE:", testData.customerId)
console.log("- P_ENCRYPTION_KEY:", testData.encryptionKey.substring(0, 4) + "***")
console.log("- String para firmar:", [
    testData.customerId,
    testData.encryptionKey,
    testData.x_ref_payco,
    testData.x_transaction_id,
    testData.x_amount,
    testData.x_currency_code,
].join("").substring(0, 30) + "...")