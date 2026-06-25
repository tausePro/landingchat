-- Afiliados TENANT (slice 6): cada merchant crea afiliados de SU tienda (sin
-- login del afiliado) que refieren COMPRADORES y ganan comisión sobre las ventas.
-- Amplía el modelo de 20260624_affiliates_n1.sql:
--   - name: nombre visible del afiliado (lo pone el merchant).
--   - owner_user_id ahora opcional (un afiliado tenant no tiene cuenta).
--   - políticas de escritura para que el merchant cree/gestione sus afiliados.

alter table affiliates add column if not exists name text;
alter table affiliates alter column owner_user_id drop not null;

-- El merchant crea afiliados 'tenant' de su propia org.
drop policy if exists affiliates_merchant_insert on affiliates;
create policy affiliates_merchant_insert on affiliates
    for insert with check (scope = 'tenant' and organization_id = get_my_org_id());

-- El merchant edita (tarifa/estado/nombre) sus afiliados 'tenant'.
drop policy if exists affiliates_merchant_update on affiliates;
create policy affiliates_merchant_update on affiliates
    for update using (scope = 'tenant' and organization_id = get_my_org_id())
    with check (scope = 'tenant' and organization_id = get_my_org_id());
