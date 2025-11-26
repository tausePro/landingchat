-- Add email column to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email text;

-- Update the handle_new_user function to include email
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  -- Create organization for new user
  INSERT INTO public.organizations (name, slug)
  VALUES (
    COALESCE(new.raw_user_meta_data->>'full_name', 'My Organization'),
    'org-' || substring(new.id::text, 1, 8)
  )
  RETURNING id INTO new_org_id;

  -- Create profile for new user with email
  INSERT INTO public.profiles (id, organization_id, full_name, role, email)
  VALUES (
    new.id,
    new_org_id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'User'),
    'admin',
    new.email
  );

  RETURN new;
END;
$$;

-- Backfill emails for existing profiles from auth.users
-- This requires permissions to read auth.users, which the postgres role has.
UPDATE profiles
SET email = users.email
FROM auth.users
WHERE profiles.id = users.id
AND profiles.email IS NULL;
