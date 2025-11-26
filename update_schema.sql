-- 1. Add missing columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS categories text[] DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 2. Create Storage Bucket for Product Images (Try to insert, ignore if exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Ensure Demo Store Exists
INSERT INTO organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Store', 'demo-store')
ON CONFLICT (id) DO NOTHING;

-- 4. Ensure Demo Agent Exists
INSERT INTO agents (id, organization_id, name, type, role, status, avatar_url)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Asistente de Compras',
  'bot',
  'sales',
  'available',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuANUbs7QMP-UuEesdAeBn8-dAS0paLvl9fh8hFd7XQ0syzoFqVp9PBwX76XPR6Dd1F0Rz-qKHKGELRXY8yM_67rZ3MMyR9geogbdOx1wxOPFLAY9Pl90UtBf141PqA0kQwv6e_KlOwkVqwPttocD_KEaVhDGHVgOjRKo00KS2ynCfN8CTWBmptoOciWiZgp_FcIcTLdIFpOyhfKfuJiZtDw8_X4Rumcfmf9I24oRKRlvZG4AWfePuuIBoNot8JobtAZmM2CHwrOKW0'
)
ON CONFLICT (id) DO NOTHING;
