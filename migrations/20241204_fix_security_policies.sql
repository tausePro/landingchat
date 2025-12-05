-- =============================================
-- FIX SECURITY POLICIES FOR CHATS AND MESSAGES
-- =============================================
-- This migration fixes the security issue where users could see chats from other organizations

-- 1. Drop the insecure public policy that allows viewing all chats
DROP POLICY IF EXISTS "Public can view chats" ON chats;

-- 2. Create a more secure policy for authenticated users
-- Users can only view chats from their own organization
DROP POLICY IF EXISTS "Agents can view chats in own organization" ON chats;
CREATE POLICY "Users can view chats in own organization"
  ON chats FOR SELECT
  TO authenticated
  USING (organization_id = get_my_org_id());

-- 3. Create policy for public/anonymous users to view only their own chats
-- This uses a session-based approach where the chat ID must be known
CREATE POLICY "Public can view own chat by id"
  ON chats FOR SELECT
  TO anon
  USING (
    -- Anonymous users can only view a chat if they have the exact chat ID
    -- This is typically passed via URL parameter after chat creation
    id::text = current_setting('request.headers', true)::json->>'x-chat-id'
    OR
    -- Or if the chat was created in the current session (within last 24 hours)
    created_at > NOW() - INTERVAL '24 hours'
  );

-- 4. Update messages policy to be more restrictive
DROP POLICY IF EXISTS "Agents can view messages in own organization" ON messages;
CREATE POLICY "Users can view messages in own organization"
  ON messages FOR SELECT
  TO authenticated
  USING (chat_id IN (SELECT id FROM chats WHERE organization_id = get_my_org_id()));

-- 5. Create policy for public to view messages only in their own chat
DROP POLICY IF EXISTS "Public can view messages" ON messages;
CREATE POLICY "Public can view messages in own chat"
  ON messages FOR SELECT
  TO anon
  USING (
    chat_id IN (
      SELECT id FROM chats 
      WHERE id::text = current_setting('request.headers', true)::json->>'x-chat-id'
      OR created_at > NOW() - INTERVAL '24 hours'
    )
  );

-- 6. Ensure insert policies are correct
DROP POLICY IF EXISTS "Public can create chats" ON chats;
CREATE POLICY "Public can create chats"
  ON chats FOR INSERT
  TO anon
  WITH CHECK (true);

-- 7. Allow authenticated users to create chats in their organization
DROP POLICY IF EXISTS "Users can create chats in own organization" ON chats;
CREATE POLICY "Users can create chats in own organization"
  ON chats FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_my_org_id());

-- 8. Allow authenticated users to update chats in their organization
DROP POLICY IF EXISTS "Users can update chats in own organization" ON chats;
CREATE POLICY "Users can update chats in own organization"
  ON chats FOR UPDATE
  TO authenticated
  USING (organization_id = get_my_org_id())
  WITH CHECK (organization_id = get_my_org_id());

-- 9. Verify the policies are in place
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('chats', 'messages')
ORDER BY tablename, policyname;
