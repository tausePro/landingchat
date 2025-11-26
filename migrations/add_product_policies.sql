-- Add RLS policies for products CRUD operations

-- INSERT policy: Users can create products in their organization
create policy "Users can create products in own organization"
  on products for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.organization_id = products.organization_id
    )
  );

-- UPDATE policy: Users can update products in their organization
create policy "Users can update products in own organization"
  on products for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.organization_id = products.organization_id
    )
  );

-- DELETE policy: Users can delete products in their organization
create policy "Users can delete products in own organization"
  on products for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.organization_id = products.organization_id
    )
  );
