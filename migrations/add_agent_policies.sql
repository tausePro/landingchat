-- Allow users to delete agents in their own organization
create policy "Users can delete agents in own organization"
  on agents for delete
  using (organization_id = get_my_org_id());

-- Allow users to update agents in their own organization
create policy "Users can update agents in own organization"
  on agents for update
  using (organization_id = get_my_org_id());
