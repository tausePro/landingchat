-- Allow public read access to organizations (for Storefront)
DROP POLICY IF EXISTS "Public can view organizations" ON organizations;

CREATE POLICY "Public can view organizations"
ON organizations FOR SELECT
USING (true);
