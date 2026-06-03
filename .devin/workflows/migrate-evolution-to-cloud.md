---
description: Migración controlada de un tenant de WhatsApp Evolution API a WhatsApp Cloud API
---

# Migrate Evolution → WhatsApp Cloud API

Workflow para migrar un tenant específico desde Evolution API (no oficial) a WhatsApp Cloud API (oficial). Es un proceso por tenant, NO masivo.

## Pre-requisitos

- El tenant debe tener Meta Business verificado y un número aprobado por Meta.
- El equipo debe tener acceso al token permanente de Meta y al phone_number_id del tenant.
- Evolution API debe estar funcionando para el tenant durante la transición (rollback rápido).

## Pasos

### 1. Auditar el estado actual del tenant

```bash
# Identificar el organization_id y la instancia Evolution actual
psql $DATABASE_URL -c "SELECT id, slug, name FROM organizations WHERE slug = 'NOMBRE_TENANT';"
psql $DATABASE_URL -c "SELECT * FROM whatsapp_instances WHERE organization_id = 'ORG_ID';"
```

Verificar:
- ¿Cuántas conversaciones activas hay? (`messages` últimos 7 días)
- ¿Webhooks configurados apuntan a Evolution?

### 2. Configurar Meta Cloud API en paralelo

- Crear app de WhatsApp Business en Meta for Developers para este tenant.
- Obtener `phone_number_id`, `business_account_id`, y `access_token` permanente.
- Configurar webhook en Meta apuntando a `/api/webhooks/whatsapp/cloud` con el `verify_token` del tenant.
- Guardar credenciales encriptadas en `whatsapp_cloud_configs` (tabla nueva si no existe — crear migración).

### 3. Despliegue dual

Durante la transición:
- Evolution sigue activo y procesa mensajes entrantes.
- Cloud API recibe webhooks pero solo logguea (modo "shadow"). Validar que cubre todos los eventos.
- Comparar volumen y forma de eventos durante 24-48h.

### 4. Switch

Una vez validado el shadow:
- Marcar el tenant en `organizations.whatsapp_provider = 'cloud'`.
- Actualizar la lógica de routing en `src/lib/whatsapp/router.ts` (crear si no existe) para enviar por Cloud API.
- Desactivar el webhook de Evolution para este tenant (no eliminar, solo apagar).

### 5. Rollback plan

Si algo sale mal en las primeras 24h post-switch:
- Revertir `organizations.whatsapp_provider = 'evolution'`.
- Reactivar webhook Evolution.
- Mensajes en cola de Cloud → reprocesar manualmente si es necesario.

### 6. Cleanup (después de 7 días estables)

- Borrar instancia Evolution del servidor (libera recursos).
- Documentar el cambio en `docs-private/TORRE_DE_CONTROL_EJECUCION.md`.

## Riesgos y consideraciones

- **Conversaciones activas**: si un cliente está en mitad de una conversación durante el switch, puede haber un message-id de Evolution que ya no exista en Cloud. Mitigación: hacer switch en horarios de bajo tráfico.
- **Templates aprobados**: Cloud API requiere templates pre-aprobados por Meta para mensajes proactivos. Verificar que los flujos del tenant los tengan aprobados antes del switch.
- **Costos**: Cloud API cobra por conversación; Evolution era plana. Calcular impacto antes.

## Referencias

- `docs-private/TORRE_DE_CONTROL_EJECUCION.md` — Frente WhatsApp
- `src/lib/evolution/` — código actual Evolution
- Spec viva: `.kiro/specs/whatsapp-integration/` (DONE — base) o crear nueva spec `whatsapp-cloud-migration`
