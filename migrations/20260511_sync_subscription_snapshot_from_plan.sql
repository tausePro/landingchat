-- Sincroniza snapshots de las suscripciones activas con el plan al que apuntan.
--
-- Contexto: las acciones del admin `updateSubscriptionPlan` y
-- `assignPlanToOrganization` (v1.11.53) cambiaban solo `plan_id` sin tocar
-- los campos cacheados de la sub (max_products, max_agents, features, etc.).
-- Como `getOrganizationLimits` prioriza esos campos sobre los del plan vía
-- el operador `||`, las orgs con plan reasignado quedaban con los límites
-- del plan anterior y veían errores tipo "Has alcanzado el límite de
-- productos (X/10)" aunque la UI mostrara el plan nuevo.
--
-- Esta migración repara el drift. Idempotente: solo afecta subs cuyos
-- snapshots difieran del plan actual.

UPDATE subscriptions AS s
SET
    max_products = p.max_products,
    max_agents = p.max_agents,
    max_monthly_conversations = p.max_monthly_conversations,
    price = p.price,
    currency = COALESCE(p.currency, 'COP'),
    features = COALESCE(p.features, '{}'::jsonb),
    updated_at = now()
FROM plans AS p
WHERE s.plan_id = p.id
  AND s.status IN ('active', 'trialing', 'past_due')
  AND (
        s.max_products IS DISTINCT FROM p.max_products
     OR s.max_agents IS DISTINCT FROM p.max_agents
     OR s.max_monthly_conversations IS DISTINCT FROM p.max_monthly_conversations
     OR s.price IS DISTINCT FROM p.price
     OR COALESCE(s.currency, '') IS DISTINCT FROM COALESCE(p.currency, 'COP')
     OR COALESCE(s.features, '{}'::jsonb) IS DISTINCT FROM COALESCE(p.features, '{}'::jsonb)
  );
