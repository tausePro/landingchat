import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// This is a critical security endpoint to fix RLS policies
// Should be protected and only accessible to superadmins
export async function POST(request: NextRequest) {
    try {
        // Validate required environment variables
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY missing" }, { status: 500 })
        }

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            return NextResponse.json({ error: "NEXT_PUBLIC_SUPABASE_URL missing" }, { status: 500 })
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        )

        // Read the security policies SQL file
        const securityPoliciesSQL = `
            -- Critical Security Fix: Remove permissive RLS policies from chats and messages tables
            -- ============================================
            -- 1. FIX CHATS TABLE - Remove ALL true/true policy
            -- ============================================
            DROP POLICY IF EXISTS "Public can access chats" ON chats;

            CREATE POLICY "Org members can access their chats" ON chats 
                FOR ALL USING (
                    organization_id = get_my_org_id() 
                    OR EXISTS (
                        SELECT 1 FROM chat_participants 
                        WHERE chat_participants.chat_id = chats.id 
                        AND chat_participants.user_id = auth.uid()
                    )
                );

            CREATE POLICY "Public can create chats" ON chats 
                FOR INSERT WITH CHECK (organization_id = get_my_org_id());

            -- ============================================
            -- 2. FIX MESSAGES TABLE - Remove ALL true/true policy  
            -- ============================================
            DROP POLICY IF EXISTS "Public can access messages" ON messages;

            CREATE POLICY "Org members can access their messages" ON messages 
                FOR ALL USING (
                    EXISTS (
                        SELECT 1 FROM chats 
                        WHERE chats.id = messages.chat_id 
                        AND (
                            chats.organization_id = get_my_org_id() 
                            OR EXISTS (
                                SELECT 1 FROM chat_participants 
                                WHERE chat_participants.chat_id = chats.id 
                                AND chat_participants.user_id = auth.uid()
                            )
                        )
                    )
                );

            CREATE POLICY "Public can create messages" ON messages 
                FOR INSERT WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM chats 
                        WHERE chats.id = messages.chat_id 
                        AND chats.organization_id = get_my_org_id()
                    )
                );

            -- ============================================
            -- 3. ADDITIONAL SECURITY HARDENING
            -- ============================================
            ALTER TABLE chats ADD CONSTRAINT IF NOT EXISTS chats_organization_id_fkey 
                FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

            ALTER TABLE messages ADD CONSTRAINT IF NOT EXISTS messages_chat_id_fkey 
                FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE;

            CREATE INDEX IF NOT EXISTS idx_chats_organization_id ON chats(organization_id);
            CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
            CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

            -- ============================================
            -- 4. ADDITIONAL TABLES THAT NEED RLS FIXES
            -- ============================================
            DROP POLICY IF EXISTS "Public can read orders" ON orders;
            DROP POLICY IF EXISTS "Public can manage orders" ON orders;

            CREATE POLICY "Org admins can manage orders" ON orders 
                FOR ALL USING (organization_id = get_my_org_id());

            CREATE POLICY "Customers can view their orders" ON orders 
                FOR SELECT USING (
                    organization_id = get_my_org_id() 
                    AND customer_id = auth.uid()
                );

            DROP POLICY IF EXISTS "Public can manage store_transactions" ON store_transactions;

            CREATE POLICY "Org admins can manage store_transactions" ON store_transactions 
                FOR ALL USING (organization_id = get_my_org_id());
        `

        // Execute the security policies migration
        const { error } = await supabase.rpc('exec_sql', { sql: securityPoliciesSQL })
        
        if (error) {
            console.error("Security policies migration error:", error)
            return NextResponse.json({ 
                error: "Security policies migration failed", 
                details: error.message 
            }, { status: 500 })
        }

        return NextResponse.json({ 
            success: true, 
            message: "Security policies migration completed successfully",
            fixesApplied: [
                "Fixed chats table RLS policies",
                "Fixed messages table RLS policies", 
                "Added proper foreign key constraints",
                "Added performance indexes",
                "Fixed orders table RLS policies",
                "Fixed store_transactions table RLS policies"
            ]
        })

    } catch (error: any) {
        console.error("Security migration error:", error)
        return NextResponse.json({ 
            error: "Security migration failed", 
            details: error.message 
        }, { status: 500 })
    }
}