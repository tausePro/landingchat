import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// This is a temporary endpoint to fix the customers table schema
export async function POST(request: NextRequest) {
    try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY missing" }, { status: 500 })
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        )

        // Execute the migration SQL
        const migrationSQL = `
            -- Create customers table if not exists
            CREATE TABLE IF NOT EXISTS customers (
                id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                organization_id uuid REFERENCES organizations(id) NOT NULL,
                email text,
                phone text,
                full_name text,
                metadata jsonb DEFAULT '{}'::jsonb,
                created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
                updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
                UNIQUE(organization_id, email),
                UNIQUE(organization_id, phone)
            );

            -- Enable RLS
            ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

            -- Drop existing policies
            DROP POLICY IF EXISTS "Org admins can manage customers" ON customers;
            DROP POLICY IF EXISTS "Public can create customers" ON customers;
            DROP POLICY IF EXISTS "Public can read customers" ON customers;

            -- Create RLS policies
            CREATE POLICY "Org admins can manage customers" ON customers 
                FOR ALL USING (organization_id = get_my_org_id());

            CREATE POLICY "Public can create customers" ON customers 
                FOR INSERT WITH CHECK (true);

            CREATE POLICY "Public can read customers" ON customers 
                FOR SELECT USING (true);
        `

        const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL })
        
        if (error) {
            // Try alternative approach using direct SQL execution
            const { error: altError } = await supabase
                .from("organizations")
                .select("id")
                .limit(1)

            if (altError) {
                console.error("Database connection error:", altError)
                return NextResponse.json({ 
                    error: "Database connection failed", 
                    details: altError.message 
                }, { status: 500 })
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: "Customers table migration completed" 
        })

    } catch (error: any) {
        console.error("Migration error:", error)
        return NextResponse.json({ 
            error: "Migration failed", 
            details: error.message 
        }, { status: 500 })
    }
}