#!/bin/bash

# Script para simular webhook de Evolution API
# Útil cuando Evolution API no puede alcanzar localhost

# Configuración
INSTANCE_NAME="${1:-org_6bd69f07-3ff0-4905-95b2-1971ebc241e8}"
APP_URL="${2:-http://localhost:3000}"

echo "🔄 Simulando webhook de conexión WhatsApp..."
echo "Instance: $INSTANCE_NAME"
echo "URL: $APP_URL"
echo ""

# Simular evento de conexión
response=$(curl -s -X POST "$APP_URL/api/webhooks/whatsapp/test" \
  -H "Content-Type: application/json" \
  -d "{
    \"instanceName\": \"$INSTANCE_NAME\",
    \"event\": \"CONNECTION_UPDATE\",
    \"state\": \"open\"
  }")

echo "Respuesta:"
echo "$response" | jq '.' 2>/dev/null || echo "$response"
echo ""

# Verificar resultado
if echo "$response" | grep -q '"success":true'; then
    echo "✅ Webhook procesado exitosamente"
    echo ""
    echo "Ahora verifica:"
    echo "1. Dashboard: http://localhost:3000/dashboard/settings/whatsapp"
    echo "2. Admin: http://localhost:3000/admin/whatsapp"
else
    echo "❌ Error al procesar webhook"
    echo ""
    echo "Verifica que:"
    echo "1. El servidor esté corriendo (npm run dev)"
    echo "2. El instance_name sea correcto"
fi
