import Anthropic from "@anthropic-ai/sdk"

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || "",
})

// Wrapper function with error handling and retries
export async function createMessage(params: Anthropic.MessageCreateParams, retries = 3): Promise<Anthropic.Message> {
    let lastError: Error | null = null

    // Check if API key is present
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error("ANTHROPIC_API_KEY is missing in environment variables")
        throw new Error("ANTHROPIC_API_KEY is missing")
    }

    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Calling Anthropic API (attempt ${i + 1})...`)
            const message = await anthropic.messages.create(params) as Anthropic.Message
            console.log("Anthropic API response received")
            return message
        } catch (error: any) {
            lastError = error
            console.error(`Anthropic API error (attempt ${i + 1}/${retries}):`, error.message)

            // Don't retry on certain errors
            if (error.status === 401 || error.status === 403) {
                throw new Error(`Authentication error: ${error.message}`)
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
