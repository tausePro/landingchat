-- Create marketplace_items table
CREATE TABLE IF NOT EXISTS marketplace_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    type TEXT NOT NULL, -- 'agent_template', 'integration', etc.
    base_price DECIMAL(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create agent_templates table
CREATE TABLE IF NOT EXISTS agent_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marketplace_item_id UUID REFERENCES marketplace_items(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    default_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE marketplace_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;

-- Public read access for marketplace items
DROP POLICY IF EXISTS "Public can view marketplace items" ON marketplace_items;
CREATE POLICY "Public can view marketplace items" ON marketplace_items 
    FOR SELECT USING (is_active = true);

-- Public read access for agent templates
DROP POLICY IF EXISTS "Public can view agent templates" ON agent_templates;
CREATE POLICY "Public can view agent templates" ON agent_templates 
    FOR SELECT USING (true);

-- Insert some default agent templates
INSERT INTO marketplace_items (id, name, description, icon, type, base_price, is_active)
VALUES 
    ('550e8400-e29b-41d4-a716-446655440001', 'Asistente de Ventas', 'Agente especializado en ventas y recomendaciones de productos', '💼', 'agent_template', 0, true),
    ('550e8400-e29b-41d4-a716-446655440002', 'Soporte al Cliente', 'Agente enfocado en resolver dudas y problemas de clientes', '🎧', 'agent_template', 0, true),
    ('550e8400-e29b-41d4-a716-446655440003', 'Asistente General', 'Agente versátil para múltiples tareas', '🤖', 'agent_template', 0, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO agent_templates (marketplace_item_id, role, system_prompt, default_config)
VALUES 
    (
        '550e8400-e29b-41d4-a716-446655440001',
        'Asistente de Ventas',
        'Eres un asistente de ventas experto. Tu objetivo es ayudar a los clientes a encontrar los productos perfectos para sus necesidades, responder preguntas sobre características y precios, y guiarlos en el proceso de compra de manera amigable y profesional.',
        '{"personality": {"tone": "friendly"}, "knowledge": {"product_knowledge": true}}'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'Soporte al Cliente',
        'Eres un agente de soporte al cliente dedicado. Tu misión es resolver problemas, responder preguntas técnicas, y asegurar que cada cliente tenga una experiencia positiva. Sé empático, paciente y orientado a soluciones.',
        '{"personality": {"tone": "professional"}, "knowledge": {"product_knowledge": true}}'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'Asistente General',
        'Eres un asistente virtual versátil. Puedes ayudar con información general, responder preguntas, y proporcionar asistencia en una variedad de temas. Mantén un tono amigable y profesional.',
        '{"personality": {"tone": "friendly"}, "knowledge": {"product_knowledge": false}}'::jsonb
    )
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_marketplace_items_type ON marketplace_items(type);
CREATE INDEX IF NOT EXISTS idx_marketplace_items_active ON marketplace_items(is_active);
CREATE INDEX IF NOT EXISTS idx_agent_templates_marketplace_item ON agent_templates(marketplace_item_id);
