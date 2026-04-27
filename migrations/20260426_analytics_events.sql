CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_name TEXT NOT NULL CHECK (event_name IN (
        'page_view',
        'view_content',
        'add_to_cart',
        'cart_opened',
        'cart_item_removed',
        'cart_quantity_changed',
        'cart_coupon_applied',
        'cart_coupon_failed',
        'checkout_started',
        'checkout_contact_submitted',
        'checkout_contact_validation_failed',
        'checkout_shipping_unavailable',
        'checkout_payment_method_selected',
        'checkout_order_created',
        'checkout_order_create_failed',
        'checkout_payment_redirect_started',
        'checkout_payment_instructions_shown',
        'checkout_gateway_load_failed',
        'payment_pending',
        'payment_failed',
        'payment_retry_clicked',
        'purchase'
    )),
    session_id TEXT,
    source_channel TEXT CHECK (source_channel IS NULL OR source_channel IN ('web', 'chat', 'whatsapp', 'instagram', 'messenger')),
    path TEXT,
    referrer TEXT,
    content_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    value NUMERIC(12, 2),
    currency TEXT NOT NULL DEFAULT 'COP',
    properties JSONB NOT NULL DEFAULT '{}'::JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_org_time
    ON public.analytics_events (organization_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_org_event_time
    ON public.analytics_events (organization_id, event_name, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_order_id
    ON public.analytics_events (order_id)
    WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_events_content_ids
    ON public.analytics_events USING GIN (content_ids);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_members_view_analytics_events ON public.analytics_events;
CREATE POLICY org_members_view_analytics_events
    ON public.analytics_events
    FOR SELECT
    TO authenticated
    USING (organization_id = get_my_org_id());
