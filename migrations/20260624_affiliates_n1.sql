-- Programa de Afiliados N1 (referral). Modelo unificado para dos scopes:
--   - 'platform': el afiliado refiere MERCHANTS a LandingChat → comisión sobre
--     la suscripción del merchant referido.
--   - 'tenant': el afiliado (partner de un merchant) refiere COMPRADORES a la
--     tienda → comisión sobre las ventas de esa tienda.
-- Comisión: % recurrente (una comisión por cada evento de pago/venta).
-- Estados de comisión: pending → approved → paid.
-- Escrituras (atribución, generación de comisiones, cambios de estado) las hace
-- el backend con service role; los usuarios solo LEEN lo suyo (RLS).

create table if not exists affiliates (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    owner_user_id uuid not null references auth.users(id) on delete cascade,
    scope text not null check (scope in ('platform', 'tenant')),
    -- null para 'platform'; la org del merchant dueño del programa para 'tenant'
    organization_id uuid references organizations(id) on delete cascade,
    commission_rate numeric(5,2) not null default 20.00
        check (commission_rate >= 0 and commission_rate <= 100),
    status text not null default 'active' check (status in ('active', 'paused')),
    created_at timestamptz not null default now(),
    -- 'tenant' exige org; 'platform' no la tiene
    constraint affiliates_scope_org check (
        (scope = 'platform' and organization_id is null)
        or (scope = 'tenant' and organization_id is not null)
    )
);

create table if not exists affiliate_referrals (
    id uuid primary key default gen_random_uuid(),
    affiliate_id uuid not null references affiliates(id) on delete cascade,
    subject_type text not null check (subject_type in ('organization', 'customer')),
    subject_id uuid not null,
    status text not null default 'pending' check (status in ('pending', 'converted')),
    landed_at timestamptz not null default now(),
    converted_at timestamptz,
    -- un afiliado atribuye una vez a cada sujeto
    unique (affiliate_id, subject_type, subject_id)
);

create table if not exists affiliate_commissions (
    id uuid primary key default gen_random_uuid(),
    affiliate_id uuid not null references affiliates(id) on delete cascade,
    referral_id uuid references affiliate_referrals(id) on delete set null,
    source_type text not null check (source_type in ('subscription_payment', 'order')),
    source_id uuid not null,
    base_amount numeric(12,2) not null,
    rate numeric(5,2) not null,
    amount numeric(12,2) not null,
    status text not null default 'pending' check (status in ('pending', 'approved', 'paid')),
    created_at timestamptz not null default now(),
    paid_at timestamptz,
    -- idempotencia: una sola comisión por evento de origen
    unique (source_type, source_id)
);

create index if not exists idx_affiliates_organization on affiliates(organization_id);
create index if not exists idx_affiliate_referrals_affiliate on affiliate_referrals(affiliate_id);
create index if not exists idx_affiliate_referrals_subject on affiliate_referrals(subject_type, subject_id);
create index if not exists idx_affiliate_commissions_affiliate on affiliate_commissions(affiliate_id);
create index if not exists idx_affiliate_commissions_status on affiliate_commissions(status);

alter table affiliates enable row level security;
alter table affiliate_referrals enable row level security;
alter table affiliate_commissions enable row level security;

-- affiliates: el dueño lee y crea su propio registro; el merchant (scope tenant)
-- ve los afiliados de su programa. Tarifa/estado los cambia el backend (service role).
drop policy if exists affiliates_owner_select on affiliates;
create policy affiliates_owner_select on affiliates
    for select using (owner_user_id = auth.uid());

drop policy if exists affiliates_owner_insert on affiliates;
create policy affiliates_owner_insert on affiliates
    for insert with check (owner_user_id = auth.uid());

drop policy if exists affiliates_merchant_select on affiliates;
create policy affiliates_merchant_select on affiliates
    for select using (scope = 'tenant' and organization_id = get_my_org_id());

-- referrals: lectura del dueño del afiliado y del merchant del programa.
drop policy if exists affiliate_referrals_owner_select on affiliate_referrals;
create policy affiliate_referrals_owner_select on affiliate_referrals
    for select using (
        affiliate_id in (select id from affiliates where owner_user_id = auth.uid())
    );

drop policy if exists affiliate_referrals_merchant_select on affiliate_referrals;
create policy affiliate_referrals_merchant_select on affiliate_referrals
    for select using (
        affiliate_id in (
            select id from affiliates where scope = 'tenant' and organization_id = get_my_org_id()
        )
    );

-- commissions: misma lógica de lectura (dato sensible = dinero, nunca USING(true)).
drop policy if exists affiliate_commissions_owner_select on affiliate_commissions;
create policy affiliate_commissions_owner_select on affiliate_commissions
    for select using (
        affiliate_id in (select id from affiliates where owner_user_id = auth.uid())
    );

drop policy if exists affiliate_commissions_merchant_select on affiliate_commissions;
create policy affiliate_commissions_merchant_select on affiliate_commissions
    for select using (
        affiliate_id in (
            select id from affiliates where scope = 'tenant' and organization_id = get_my_org_id()
        )
    );
