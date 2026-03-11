import { createServiceClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { ecommerceToolHandlers } from "./ecommerce"
import { realEstateToolHandlers } from "./real-estate"
import { sharedToolHandlers } from "./shared"
import type { ToolContext, ToolHandler, ToolResult } from "./types"

const log = logger("ai/tool-executor")

const toolHandlers: Record<string, ToolHandler> = {
    ...sharedToolHandlers,
    ...ecommerceToolHandlers,
    ...realEstateToolHandlers,
}

export async function executeTool(
    toolName: string,
    input: any,
    context: ToolContext
): Promise<ToolResult> {
    log.info(`Executing: ${toolName}`, { input: typeof input === "object" ? Object.keys(input) : input })

    const handler = toolHandlers[toolName]
    if (!handler) {
        return { success: false, error: `Unknown tool: ${toolName}` }
    }

    const supabase = createServiceClient()

    try {
        return await handler(supabase, input, context)
    } catch (error: any) {
        log.error(`Error in ${toolName}`, { error: error.message })
        return { success: false, error: error.message }
    }
}

export type { ToolContext, ToolResult } from "./types"
