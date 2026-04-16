import Anthropic from "@anthropic-ai/sdk"
import { logger } from "@/lib/logger"

const log = logger("ai/anthropic")

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || "",
})

// Wrapper function with error handling and retries
export async function createMessage(params: Anthropic.MessageCreateParams, retries = 3): Promise<Anthropic.Message> {
    let lastError: Error | null = null

    // Check if API key is present
    if (!process.env.ANTHROPIC_API_KEY) {
        log.error("ANTHROPIC_API_KEY is missing in environment variables")
        throw new Error("ANTHROPIC_API_KEY is missing")
    }

    for (let i = 0; i < retries; i++) {
        try {
            log.debug("Calling Anthropic API", { attempt: i + 1, retries })
            const message = await anthropic.messages.create(params) as Anthropic.Message
            log.debug("Anthropic API response received", { attempt: i + 1 })
            return message
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error"
            const errorStatus = typeof error === "object"
                && error !== null
                && "status" in error
                && typeof (error as { status?: unknown }).status === "number"
                ? (error as { status: number }).status
                : undefined

            lastError = error instanceof Error ? error : new Error(errorMessage)
            log.error("Anthropic API error", { attempt: i + 1, retries, message: errorMessage, status: errorStatus })

            // Don't retry on certain errors
            if (errorStatus === 401 || errorStatus === 403) {
                throw new Error(`Authentication error: ${errorMessage}`)
            }

            // Wait before retrying (exponential backoff)
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
            }
        }
    }

    throw new Error(`Failed to get response from Anthropic after ${retries} attempts: ${lastError?.message}`)
}

// Helper to count tokens (approximate)
export function estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4)
}

export { anthropic }
