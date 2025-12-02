-- Allow public read access to badges
CREATE POLICY "Public can view badges" ON badges
    FOR SELECT USING (true);

-- Allow public read access to promotions
CREATE POLICY "Public can view promotions" ON promotions
    FOR SELECT USING (true);
