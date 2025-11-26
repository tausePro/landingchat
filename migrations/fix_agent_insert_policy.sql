-- Fix RLS policy for agent creation
-- Drop existing policy and recreate with better logic

drop policy if exists "Users can create agents in own organization" on agents;

-- Create improved INSERT policy
create policy "Users can create agents in own organization"
  on agents for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.organization_id = agents.organization_id
    )
  );

-- Also ensure agents table has SELECT policy for users
drop policy if exists "Users can view agents in own organization" on agents;

create policy "Users can view agents in own organization"
  on agents for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.organization_id = agents.organization_id
    )
  );
