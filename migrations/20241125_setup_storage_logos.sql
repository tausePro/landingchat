-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('organization-logos', 'organization-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Public can view logos
DROP POLICY IF EXISTS "Public can view logos" ON storage.objects;
CREATE POLICY "Public can view logos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'organization-logos' );

-- Policy: Authenticated users can upload logos
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'organization-logos' );

-- Policy: Users can update their own logos (optional, for now insert is enough as we generate unique names)
DROP POLICY IF EXISTS "Users can update own logos" ON storage.objects;
CREATE POLICY "Users can update own logos"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'organization-logos' );
