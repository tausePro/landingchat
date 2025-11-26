-- Add missing RLS policies for products table

-- Allow users to insert products in their own organization
DROP POLICY IF EXISTS "Users can insert products in own organization" ON products;
CREATE POLICY "Users can insert products in own organization"
ON products FOR INSERT
WITH CHECK (organization_id = get_my_org_id());

-- Allow users to update products in their own organization
DROP POLICY IF EXISTS "Users can update products in own organization" ON products;
CREATE POLICY "Users can update products in own organization"
ON products FOR UPDATE
USING (organization_id = get_my_org_id());

-- Allow users to delete products in their own organization
DROP POLICY IF EXISTS "Users can delete products in own organization" ON products;
CREATE POLICY "Users can delete products in own organization"
ON products FOR DELETE
USING (organization_id = get_my_org_id());
