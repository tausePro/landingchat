-- Insert a test product in demo-store organization
INSERT INTO products (organization_id, name, description, price, image_url, stock, sku, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001', -- demo-store org ID
  'Zapatillas Running Pro',
  'Zapatillas profesionales para corredores de alto rendimiento',
  89990,
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
  10,
  'ZAP-001',
  true
);
