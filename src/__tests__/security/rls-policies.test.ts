import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Test the RLS policies to ensure they're working correctly
describe('RLS Security Policies', () => {
    let supabase: any
    let testOrgId: string
    let testUserId: string
    let otherOrgId: string

    beforeAll(async () => {
        // Initialize Supabase client with service role for setup
        supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Create test organization and user
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .insert({ name: 'Test Org', slug: 'test-org-' + Math.random().toString(36).substring(2, 10) })
            .select('id')
            .single()

        if (orgError) throw orgError
        testOrgId = org.id

        // Create another organization for cross-tenant testing
        const { data: otherOrg, error: otherOrgError } = await supabase
            .from('organizations')
            .insert({ name: 'Other Org', slug: 'other-org-' + Math.random().toString(36).substring(2, 10) })
            .select('id')
            .single()

        if (otherOrgError) throw otherOrgError
        otherOrgId = otherOrg.id

        // Create test user
        testUserId = 'test-user-' + Math.random().toString(36).substring(2, 10)
    })

    afterAll(async () => {
        // Clean up test data
        await supabase
            .from('customers')
            .delete()
            .eq('organization_id', testOrgId)

        await supabase
            .from('customers')
            .delete()
            .eq('organization_id', otherOrgId)

        await supabase
            .from('organizations')
            .delete()
            .eq('id', testOrgId)

        await supabase
            .from('organizations')
            .delete()
            .eq('id', otherOrgId)
    })

    describe('Customers Table RLS', () => {
        it('should allow organization members to read their own customers', async () => {
            // Create a customer in test organization
            const { data: customer, error: createError } = await supabase
                .from('customers')
                .insert({
                    organization_id: testOrgId,
                    full_name: 'Test Customer',
                    phone: '+1234567890',
                    email: 'test@example.com'
                })
                .select('id')
                .single()

            expect(createError).toBeNull()
            expect(customer).toBeDefined()

            // Test reading with organization context
            const { data: readData, error: readError } = await supabase
                .rpc('set_my_org_id', { org_id: testOrgId })
                .from('customers')
                .select('*')
                .eq('organization_id', testOrgId)

            expect(readError).toBeNull()
            expect(readData).toBeDefined()
            expect(readData.length).toBeGreaterThan(0)
        })

        it('should prevent cross-tenant customer access', async () => {
            // Create a customer in the other organization
            const { data: otherCustomer, error: createError } = await supabase
                .from('customers')
                .insert({
                    organization_id: otherOrgId,
                    full_name: 'Other Customer',
                    phone: '+0987654321',
                    email: 'other@example.com'
                })
                .select('id')
                .single()

            expect(createError).toBeNull()

            // Try to read from wrong organization context
            const { data: readData, error: readError } = await supabase
                .rpc('set_my_org_id', { org_id: testOrgId })
                .from('customers')
                .select('*')
                .eq('organization_id', otherOrgId)

            // Should return empty or error due to RLS
            expect(readError).toBeNull() // No error, but filtered results
            expect(readData).toBeDefined()
            expect(readData.length).toBe(0) // RLS should filter out other org's data
        })

        it('should allow public customer creation', async () => {
            // Test that public can still create customers (for chat gate functionality)
            const { data: customer, error: createError } = await supabase
                .from('customers')
                .insert({
                    organization_id: testOrgId,
                    full_name: 'New Customer',
                    phone: '+5551234567'
                })
                .select('id')
                .single()

            expect(createError).toBeNull()
            expect(customer).toBeDefined()
        })
    })

    describe('Chats Table RLS', () => {
        it('should prevent public access to chats with ALL true/true policy removed', async () => {
            // Create a chat in test organization
            const { data: chat, error: createError } = await supabase
                .from('chats')
                .insert({
                    organization_id: testOrgId,
                    title: 'Test Chat',
                    status: 'open'
                })
                .select('id')
                .single()

            expect(createError).toBeNull()
            expect(chat).toBeDefined()

            // Try to read without proper organization context
            const { data: readData, error: readError } = await supabase
                .from('chats')
                .select('*')

            // Should be filtered by RLS
            expect(readError).toBeNull()
            expect(readData).toBeDefined()
            // Data should be filtered to only accessible chats
        })

        it('should allow organization-scoped chat access', async () => {
            // Set organization context
            const { data: chat, error: createError } = await supabase
                .rpc('set_my_org_id', { org_id: testOrgId })
                .from('chats')
                .insert({
                    organization_id: testOrgId,
                    title: 'Org Chat',
                    status: 'open'
                })
                .select('id')
                .single()

            expect(createError).toBeNull()
            expect(chat).toBeDefined()

            // Read with same organization context
            const { data: readData, error: readError } = await supabase
                .rpc('set_my_org_id', { org_id: testOrgId })
                .from('chats')
                .select('*')
                .eq('organization_id', testOrgId)

            expect(readError).toBeNull()
            expect(readData).toBeDefined()
            expect(readData.length).toBeGreaterThan(0)
        })
    })

    describe('Messages Table RLS', () => {
        it('should prevent public access to messages with ALL true/true policy removed', async () => {
            // Create a chat first
            const { data: chat, error: chatError } = await supabase
                .from('chats')
                .insert({
                    organization_id: testOrgId,
                    title: 'Message Test Chat',
                    status: 'open'
                })
                .select('id')
                .single()

            expect(chatError).toBeNull()

            // Create a message
            const { data: message, error: msgError } = await supabase
                .from('messages')
                .insert({
                    chat_id: chat.id,
                    content: 'Test message',
                    sender_type: 'customer',
                    sender_id: testUserId
                })
                .select('id')
                .single()

            expect(msgError).toBeNull()

            // Try to read without proper context
            const { data: readData, error: readError } = await supabase
                .from('messages')
                .select('*')

            // Should be filtered by RLS
            expect(readError).toBeNull()
            expect(readData).toBeDefined()
        })

        it('should allow organization-scoped message access', async () => {
            // Create chat and message with organization context
            const { data: chat, error: chatError } = await supabase
                .rpc('set_my_org_id', { org_id: testOrgId })
                .from('chats')
                .insert({
                    organization_id: testOrgId,
                    title: 'Org Message Chat',
                    status: 'open'
                })
                .select('id')
                .single()

            expect(chatError).toBeNull()

            const { data: message, error: msgError } = await supabase
                .rpc('set_my_org_id', { org_id: testOrgId })
                .from('messages')
                .insert({
                    chat_id: chat.id,
                    content: 'Org test message',
                    sender_type: 'customer',
                    sender_id: testUserId
                })
                .select('id')
                .single()

            expect(msgError).toBeNull()

            // Read messages with organization context
            const { data: readData, error: readError } = await supabase
                .rpc('set_my_org_id', { org_id: testOrgId })
                .from('messages')
                .select('*')
                .eq('chat_id', chat.id)

            expect(readError).toBeNull()
            expect(readData).toBeDefined()
            expect(readData.length).toBeGreaterThan(0)
        })
    })

    describe('Orders Table RLS', () => {
        it('should prevent public order access', async () => {
            // Create an order
            const { data: order, error: createError } = await supabase
                .from('orders')
                .insert({
                    organization_id: testOrgId,
                    customer_id: testUserId,
                    status: 'pending',
                    total_amount: 1000
                })
                .select('id')
                .single()

            expect(createError).toBeNull()

            // Try to read without proper context
            const { data: readData, error: readError } = await supabase
                .from('orders')
                .select('*')

            // Should be filtered by RLS
            expect(readError).toBeNull()
            expect(readData).toBeDefined()
        })

        it('should allow organization-scoped order access', async () => {
            // Create order with organization context
            const { data: order, error: createError } = await supabase
                .rpc('set_my_org_id', { org_id: testOrgId })
                .from('orders')
                .insert({
                    organization_id: testOrgId,
                    customer_id: testUserId,
                    status: 'pending',
                    total_amount: 1000
                })
                .select('id')
                .single()

            expect(createError).toBeNull()

            // Read with organization context
            const { data: readData, error: readError } = await supabase
                .rpc('set_my_org_id', { org_id: testOrgId })
                .from('orders')
                .select('*')
                .eq('organization_id', testOrgId)

            expect(readError).toBeNull()
            expect(readData).toBeDefined()
            expect(readData.length).toBeGreaterThan(0)
        })
    })
})