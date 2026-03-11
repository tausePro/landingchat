import { createServiceClient } from "@/lib/supabase/server"

export interface ToolContext {
    chatId: string
    organizationId: string
    customerId?: string
    channel?: string
}

export interface ToolResult {
    success: boolean
    data?: any
    error?: string
}

export type ToolSupabaseClient = ReturnType<typeof createServiceClient>

export type ToolHandler = (
    supabase: ToolSupabaseClient,
    input: any,
    context: ToolContext
) => Promise<ToolResult>
