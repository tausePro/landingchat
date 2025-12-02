-- Add configurable_options column for configurable products
ALTER TABLE products ADD COLUMN IF NOT EXISTS configurable_options JSONB DEFAULT NULL;

COMMENT ON COLUMN products.configurable_options IS 'Configurable options for customizable products: [{name: string, type: "text"|"select"|"number"|"color", required: boolean, ...}]';

-- Add preview_template column for configurable products
ALTER TABLE products ADD COLUMN IF NOT EXISTS preview_template TEXT DEFAULT NULL;

COMMENT ON COLUMN products.preview_template IS 'HTML/CSS template for product preview with placeholders for customization options';

-- Example preview_template structure:
-- <div style="position: relative; width: 400px; height: 400px;">
--   <img src="{{base_image}}" style="width: 100%;" />
--   <div style="position: absolute; top: {{text_position_y}}; left: {{text_position_x}}; color: {{text_color}}; font-family: {{font}};">
--     {{custom_text}}
--   </div>
-- </div>
