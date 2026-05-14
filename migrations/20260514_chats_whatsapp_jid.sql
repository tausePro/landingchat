-- =============================================================================
-- Hotfix v1.12.7: chats.whatsapp_jid - JID completo para envio robusto a @lid
-- =============================================================================
--
-- Contexto del bug:
--   v1.12.5 introdujo `extractPhoneFromJid` que limpia el sufijo del remoteJid
--   (ej. `123@lid` -> `123`). Eso arreglo los comandos del operador (matching
--   de chats por phone limpio), pero rompio el ENVIO de respuestas: Evolution
--   API necesita el JID COMPLETO (`123@lid`) para entregar el mensaje a un
--   contacto con Linked ID. Al guardar `chats.phone_number` sin sufijo, el
--   envio queda con un identificador opaco que Evolution no resuelve.
--
-- Solucion:
--   Agregar columna `whatsapp_jid` que persiste el JID original con su sufijo.
--   El webhook lo guarda al recibir; el sender lo prefiere al enviar. La
--   columna `phone_number` queda como identificador limpio para matching y
--   variantes de busqueda. Backfill heuristico para chats existentes.
--
-- Heuristica del backfill:
--   - Si `phone_number` ya contiene `@` (legacy pre-cleanup): partir el
--     sufijo y guardarlo como `whatsapp_jid`, dejar `phone_number` limpio.
--   - Si `phone_number` es MSISDN (10-13 digitos puros): asumir
--     `@s.whatsapp.net` (formato clasico).
--   - Si `phone_number` es opaco (>=14 digitos o caracteres no-numericos):
--     asumir `@lid` (Linked ID).
--
-- Casos borde aceptados: un MSISDN de 14 digitos quedaria marcado como `@lid`
-- (poco frecuente fuera de paises como China). El reverso es mas critico (un
-- `@lid` marcado como `@s.whatsapp.net` rompe el envio), por eso el threshold
-- es agresivo (>=14 = LID).
-- =============================================================================

ALTER TABLE chats ADD COLUMN IF NOT EXISTS whatsapp_jid TEXT;

CREATE INDEX IF NOT EXISTS idx_chats_whatsapp_jid_org
    ON chats(organization_id, whatsapp_jid)
    WHERE whatsapp_jid IS NOT NULL;

COMMENT ON COLUMN chats.whatsapp_jid IS
    'JID completo de WhatsApp con sufijo (@s.whatsapp.net o @lid). '
    'Se usa al enviar mensajes para que Evolution API resuelva correctamente '
    'contactos con Linked ID. phone_number permanece limpio para matching. '
    'Introducido en v1.12.7 (2026-05-14).';

-- ===== BACKFILL =====

-- Caso A: phone_number contiene `@` (legacy, antes del cleanup del v1.12.5).
-- Partir el sufijo y guardarlo como whatsapp_jid; dejar phone_number limpio.
UPDATE chats
SET whatsapp_jid = phone_number,
    phone_number = split_part(phone_number, '@', 1)
WHERE channel = 'whatsapp'
  AND phone_number IS NOT NULL
  AND phone_number LIKE '%@%'
  AND whatsapp_jid IS NULL;

-- Caso B: phone_number es MSISDN (10-13 digitos puros) -> @s.whatsapp.net.
UPDATE chats
SET whatsapp_jid = phone_number || '@s.whatsapp.net'
WHERE channel = 'whatsapp'
  AND phone_number IS NOT NULL
  AND phone_number ~ '^[0-9]{10,13}$'
  AND whatsapp_jid IS NULL;

-- Caso C: phone_number opaco (>=14 digitos o caracteres no-numericos) -> @lid.
UPDATE chats
SET whatsapp_jid = phone_number || '@lid'
WHERE channel = 'whatsapp'
  AND phone_number IS NOT NULL
  AND whatsapp_jid IS NULL;

-- ===== VERIFICACION =====
-- Tras correr esta migracion, esta query debe devolver 0:
--   SELECT count(*) FROM chats
--   WHERE channel = 'whatsapp' AND phone_number IS NOT NULL AND whatsapp_jid IS NULL;
