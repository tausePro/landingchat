-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can upload images to their organization folder
CREATE POLICY "Users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text 
    FROM profiles 
    WHERE id = auth.uid()
  )
);

-- Policy: Users can view their organization's images
CREATE POLICY "Users can view their product images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-images' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text 
    FROM profiles 
    WHERE id = auth.uid()
  )
);

-- Policy: Users can delete their organization's images
CREATE POLICY "Users can delete their product images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text 
    FROM profiles 
    WHERE id = auth.uid()
  )
);
