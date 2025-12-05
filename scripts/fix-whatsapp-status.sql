-- Script temporal para actualizar el estado de WhatsApp a "connected"
-- Ejecutar en Supabase SQL Editor

UPDATE whatsapp_instances
SET 
    status = 'connected',
    connected_at = NOW(),
    updated_at = NOW()
WHERE 
    instance_name = 'org_dfee7229-b565-4dc9-97a5-8524db4f234b'
    AND status = 'connecting';

-- Verificar el cambio
SELECT 
    id,
    organization_id,
    instance_name,
    status,
    connected_at,
    updated_at
FROM whatsapp_instances
WHERE instance_name = 'org_dfee7229-b565-4dc9-97a5-8524db4f234b';
