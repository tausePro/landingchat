-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ⚠️ WARNING: The DROP statements below are DESTRUCTIVE!
-- They were used for initial development but should NEVER be run in production.
-- If you need to reset the database, use a proper backup/restore process.
-- 
-- COMMENTED OUT TO PREVENT DATA LOSS:
-- drop table if exists messages cascade;
-- drop table if exists chats cascade;
-- drop table if exists quick_responses cascade;
-- drop table if exists schedules cascade;
-- drop table if exists agents cascade;
-- drop table if exists products cascade;
-- drop table if exists profiles cascade;
-- drop table if exists organizations cascade;

-- 1. Organizations (Tenants)
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  logo_url text,
  contact_email text,
  industry text,
  subdomain text unique,
  onboarding_completed boolean default false,
  onboarding_step integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Profiles (Users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  organization_id uuid references organizations(id),
  full_name text,
  role text check (role in ('admin', 'member')) default 'member',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Products
create table products (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  name text not null,
  description text,
  price decimal(10,2) not null,
  image_url text,
  stock integer default 0,
  sku text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Agents (Human & AI)
create table agents (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  name text not null,
  type text check (type in ('human', 'bot')) not null,
  role text check (role in ('sales', 'support', 'admin')) default 'support',
  status text check (status in ('available', 'busy', 'offline', 'vacation')) default 'offline',
  avatar_url text,
  configuration jsonb default '{}'::jsonb, -- For AI settings (tone, greeting) or human prefs
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Schedules (For Human Agents)
create table schedules (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid references agents(id) on delete cascade not null,
  organization_id uuid references organizations(id) not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  type text check (type in ('shift', 'time_off')) default 'shift',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Quick Responses (Canned Replies)
create table quick_responses (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  title text not null,
  content text not null,
  category text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Chats (Sessions) - Updated with Agent Assignment
create table chats (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  assigned_agent_id uuid references agents(id), -- Nullable (can be unassigned)
  customer_name text,
  status text check (status in ('active', 'closed', 'pending')) default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. Messages - Updated with Sender ID
create table messages (
  id uuid primary key default uuid_generate_v4(),
  chat_id uuid references chats(id) on delete cascade not null,
  sender_type text check (sender_type in ('user', 'bot', 'agent')) not null,
  sender_id uuid references agents(id), -- Nullable (if sender is user)
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- HELPER FUNCTIONS
-- Function to get the current user's organization ID
-- SECURITY DEFINER allows it to bypass RLS, preventing infinite recursion
create or replace function get_my_org_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from profiles where id = auth.uid();
$$;

-- TRIGGERS FOR AUTO-CREATION
-- Function to automatically create organization and profile when a user signs up
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_org_id uuid;
begin
  -- Create organization for new user
  insert into public.organizations (name, slug)
  values (
    coalesce(new.raw_user_meta_data->>'full_name', 'My Organization'),
    'org-' || substring(new.id::text, 1, 8)
  )
  returning id into new_org_id;

  -- Create profile for new user
  insert into public.profiles (id, organization_id, full_name, role)
  values (
    new.id,
    new_org_id,
    coalesce(new.raw_user_meta_data->>'full_name', 'User'),
    'admin'
  );

  return new;
end;
$$;

-- Trigger to call the function after user creation
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- RLS POLICIES (Security)

-- Enable RLS
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table products enable row level security;
alter table agents enable row level security;
alter table schedules enable row level security;
alter table quick_responses enable row level security;
alter table chats enable row level security;
alter table messages enable row level security;

-- Organizations: Users can view their own organization
create policy "Users can view own organization"
  on organizations for select
  using (id = get_my_org_id());

-- Organizations: Authenticated users can create organizations (for signup)
create policy "Authenticated users can create organizations"
  on organizations for insert
  with check (auth.uid() is not null);

-- Organizations: Users can update their own organization
create policy "Users can update own organization"
  on organizations for update
  using (id = get_my_org_id());

-- Profiles: Users can view their own profile
create policy "Users can view own profile"
  on profiles for select
  using (id = auth.uid());

-- Profiles: Authenticated users can create their own profile (for signup)
create policy "Users can create own profile"
  on profiles for insert
  with check (id = auth.uid());

-- Profiles: Users can view other profiles in their organization
create policy "Users can view profiles in own organization"
  on profiles for select
  using (organization_id = get_my_org_id());

-- Products: Users can view products in their organization
create policy "Users can view products in own organization"
  on products for select
  using (organization_id = get_my_org_id());

-- Products: Public read access (for the store frontend)
create policy "Public can view products"
  on products for select
  using (true); 

-- Agents: Users can create agents in their organization
create policy "Users can create agents in own organization"
  on agents for insert
  with check (organization_id = get_my_org_id());

-- Schedules: Users can view schedules in their organization
create policy "Users can view schedules in own organization"
  on schedules for select
  using (organization_id = get_my_org_id());

-- SUPERADMIN & MARKETPLACE SCHEMA

-- 1. Update Profiles for Superadmin
alter table profiles add column if not exists is_superadmin boolean default false;

-- 2. Marketplace Items (Inventario de lo que vendes)
create table if not exists marketplace_items (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- 'agent_template', 'channel', 'feature', 'service'
  name text not null,
  description text,
  icon text, -- emoji o url
  
  -- Economics
  base_price decimal(10,2) not null default 0, -- Precio de venta al público
  cost decimal(10,2) not null default 0, -- Tu costo operativo
  billing_period text default 'monthly', -- 'monthly', 'yearly', 'one_time'
  
  -- Configuration
  config_schema jsonb, -- JSON Schema para los inputs requeridos al activar
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Agent Templates (Plantillas específicas para items tipo 'agent_template')
create table if not exists agent_templates (
  id uuid primary key default gen_random_uuid(),
  marketplace_item_id uuid references marketplace_items(id) on delete cascade,
  name text not null,
  role text not null, -- 'sales', 'support', 'booking', 'scanner', etc.
  system_prompt text not null, -- El prompt base del experto
  
  -- Configuración específica del template
  default_config jsonb, -- Configuración por defecto
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Plans (Paquetes comerciales)
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price decimal(10,2) not null,
  currency text default 'COP',
  interval text default 'month', -- 'month', 'year'
  
  -- Qué incluye este plan
  features jsonb, -- Lista de features/limits
  included_items jsonb, -- Array de marketplace_item_ids incluidos
  
  is_public boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Subscriptions (Qué ha comprado cada organización)
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  
  -- Puede ser un Plan o un Item individual del Marketplace
  plan_id uuid references plans(id),
  marketplace_item_id uuid references marketplace_items(id),
  
  status text not null, -- 'active', 'past_due', 'cancelled', 'trial'
  current_period_end timestamp with time zone,
  
  -- Billing info (agnóstico a la pasarela por ahora)
  billing_provider text, -- 'wompi', 'epayco', 'manual'
  external_subscription_id text,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS FOR NEW TABLES

alter table marketplace_items enable row level security;
alter table agent_templates enable row level security;
alter table plans enable row level security;
alter table subscriptions enable row level security;

-- Marketplace/Plans: Public read, Superadmin write
drop policy if exists "Public read marketplace" on marketplace_items;
create policy "Public read marketplace" on marketplace_items for select using (true);

drop policy if exists "Public read plans" on plans;
create policy "Public read plans" on plans for select using (true);

drop policy if exists "Public read agent templates" on agent_templates;
create policy "Public read agent templates" on agent_templates for select using (true);

drop policy if exists "Superadmin write marketplace" on marketplace_items;
create policy "Superadmin write marketplace" on marketplace_items for all using (
  exists (select 1 from profiles where id = auth.uid() and is_superadmin = true)
);

drop policy if exists "Superadmin write plans" on plans;
create policy "Superadmin write plans" on plans for all using (
  exists (select 1 from profiles where id = auth.uid() and is_superadmin = true)
);

drop policy if exists "Superadmin write agent templates" on agent_templates;
create policy "Superadmin write agent templates" on agent_templates for all using (
  exists (select 1 from profiles where id = auth.uid() and is_superadmin = true)
);

-- Subscriptions: Org read, Superadmin all
drop policy if exists "Org read own subscriptions" on subscriptions;
create policy "Org read own subscriptions" on subscriptions for select using (
  organization_id = get_my_org_id()
);

drop policy if exists "Superadmin all subscriptions" on subscriptions;
create policy "Superadmin all subscriptions" on subscriptions for all using (
  exists (select 1 from profiles where id = auth.uid() and is_superadmin = true)
);

-- Quick Responses: Users can view quick responses in their organization
create policy "Users can view quick responses in own organization"
  on quick_responses for select
  using (organization_id = get_my_org_id());

-- Chats: Agents can view chats in their organization
create policy "Agents can view chats in own organization"
  on chats for select
  using (organization_id = get_my_org_id());

-- Messages: Agents can view messages in their organization's chats
create policy "Agents can view messages in own organization"
  on messages for select
  using (chat_id in (select id from chats where organization_id = get_my_org_id()));

-- PUBLIC ACCESS POLICIES (Storefront)
-- Allow public to create chats (initiate conversation)
create policy "Public can create chats"
  on chats for insert
  with check (true);

-- Allow public to view chats (ideally this should be restricted to the creator via session/cookie, but for now open for demo)
create policy "Public can view chats"
  on chats for select
  using (true);

-- Allow public to create messages
create policy "Public can create messages"
  on messages for insert
  with check (true);

-- Allow public to view messages
create policy "Public can view messages"
  on messages for select
  using (true);

-- SEED DATA (Initial Setup)
-- Insert a default organization if not exists
insert into organizations (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Demo Store', 'demo-store')
on conflict (id) do nothing;

-- Insert a default AI Agent
insert into agents (id, organization_id, name, type, role, status, avatar_url)
values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Asistente de Compras',
  'bot',
  'sales',
  'available',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuANUbs7QMP-UuEesdAeBn8-dAS0paLvl9fh8hFd7XQ0syzoFqVp9PBwX76XPR6Dd1F0Rz-qKHKGELRXY8yM_67rZ3MMyR9geogbdOx1wxOPFLAY9Pl90UtBf141PqA0kQwv6e_KlOwkVqwPttocD_KEaVhDGHVgOjRKo00KS2ynCfN8CTWBmptoOciWiZgp_FcIcTLdIFpOyhfKfuJiZtDw8_X4Rumcfmf9I24oRKRlvZG4AWfePuuIBoNot8JobtAZmM2CHwrOKW0'
)
on conflict (id) do nothing;

