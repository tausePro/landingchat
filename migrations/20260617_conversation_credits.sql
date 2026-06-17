-- Migración: Créditos de conversaciones (overflow del límite mensual, roll-over)
-- Fecha: 2026-06-17
--
-- Modelo de producto:
--   * Cada mes el plan da N conversaciones gratis (límite mensual dinámico, ver
--     lib/utils/whatsapp-limits.ts getMessagingConversationsThisMonth).
--   * Al superar el límite, cada conversación NUEVA consume 1 crédito del saldo.
--   * Los créditos comprados (packs Wompi one-time) NO vencen: se acumulan
--     (roll-over) hasta agotarse.
--
-- Enforcement: permitido = (usadoMes < límitePlan) OR (conversation_credits > 0)

-- 1. Saldo de créditos por organización
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS conversation_credits INTEGER NOT NULL DEFAULT 0;

-- 2. Acreditar (la llama el webhook de pago al confirmar la compra de un pack).
--    amount debe ser > 0. Devuelve el nuevo saldo.
CREATE OR REPLACE FUNCTION add_conversation_credits(org_id UUID, amount INTEGER)
RETURNS INTEGER AS $$
DECLARE
    new_balance INTEGER;
BEGIN
    IF amount IS NULL OR amount <= 0 THEN
        RAISE EXCEPTION 'add_conversation_credits: amount debe ser > 0 (recibido %)', amount;
    END IF;

    UPDATE organizations
    SET conversation_credits = COALESCE(conversation_credits, 0) + amount
    WHERE id = org_id
    RETURNING conversation_credits INTO new_balance;

    RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Consumir 1 crédito de forma ATÓMICA (solo si hay saldo). El UPDATE con la
--    condición > 0 + RETURNING evita doble-consumo bajo concurrencia (la fila se
--    bloquea). Devuelve el saldo restante, o -1 si no había saldo (el caller NO
--    descuenta y deja pasar/ bloquear según el límite del plan).
CREATE OR REPLACE FUNCTION consume_conversation_credit(org_id UUID)
RETURNS INTEGER AS $$
DECLARE
    new_balance INTEGER;
BEGIN
    UPDATE organizations
    SET conversation_credits = conversation_credits - 1
    WHERE id = org_id AND COALESCE(conversation_credits, 0) > 0
    RETURNING conversation_credits INTO new_balance;

    IF NOT FOUND THEN
        RETURN -1;
    END IF;

    RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. SEGURIDAD: estas funciones manejan billing y NO deben ser llamables por
--    merchants vía la API de Supabase (un merchant podría auto-acreditarse
--    créditos gratis con add_conversation_credits). Solo el servidor las invoca
--    con el service_role (webhook de pago / enforcement server-side).
REVOKE EXECUTE ON FUNCTION add_conversation_credits(UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION consume_conversation_credit(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_conversation_credits(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION consume_conversation_credit(UUID) TO service_role;

-- 5. Comentarios
COMMENT ON COLUMN organizations.conversation_credits IS 'Saldo de créditos de conversaciones comprados (overflow del límite mensual, roll-over, no vencen)';
COMMENT ON FUNCTION add_conversation_credits IS 'Acredita créditos de conversaciones tras compra confirmada (webhook). amount > 0.';
COMMENT ON FUNCTION consume_conversation_credit IS 'Consume 1 crédito de conversación atómicamente si hay saldo; devuelve saldo restante o -1.';
