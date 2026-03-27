UPDATE plans
SET
    features = COALESCE(features, '{}'::jsonb) || '{"custom_domain": true}'::jsonb,
    updated_at = now()
WHERE slug = 'beta';

UPDATE subscriptions AS s
SET
    features = COALESCE(s.features, '{}'::jsonb) || '{"custom_domain": true}'::jsonb,
    updated_at = now()
FROM plans AS p
WHERE s.plan_id = p.id
  AND p.slug = 'beta';
