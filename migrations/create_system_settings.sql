-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read settings (needed for landing page)
CREATE POLICY "Everyone can read system settings"
    ON system_settings
    FOR SELECT
    USING (true);

-- Policy: Only superadmins can modify settings
CREATE POLICY "Only superadmins can modify system settings"
    ON system_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_superadmin = true
        )
    );

-- Insert default maintenance mode setting
INSERT INTO system_settings (key, value)
VALUES (
    'maintenance_mode',
    '{"isActive": false, "message": "Estamos en mantenimiento, volvemos pronto."}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Add comment
COMMENT ON TABLE system_settings IS 'Global system configuration settings';
