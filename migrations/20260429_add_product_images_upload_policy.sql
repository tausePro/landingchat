-- Agregar política de INSERT explícita para el bucket product-images
-- Esto permite que usuarios autenticados suban archivos (videos, imágenes) al bucket
-- CREATE POLICY es seguro: no modifica ni elimina datos existentes

CREATE POLICY IF NOT EXISTS "Authenticated users can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');
