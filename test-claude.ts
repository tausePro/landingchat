// Test Claude API
import Anthropic from "@anthropic-ai/sdk"

const apiKey = process.env.ANTHROPIC_API_KEY

console.log("API Key exists:", !!apiKey)
console.log("API Key length:", apiKey?.length)
console.log("API Key starts with:", apiKey?.substring(0, 15))

if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not found in environment!")
    console.log("Available env vars:", Object.keys(process.env).filter(k => k.includes('ANTHROPIC')))
    process.exit(1)
}

const anthropic = new Anthropic({
    apiKey: apiKey,
})

async function testClaude() {
    try {
        console.log("\nTesting Claude API...")
        const message = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 100,
            messages: [{ role: "user", content: "Say hello in Spanish" }],
        })

        console.log("\n✅ SUCCESS! Response:", message.content)
    } catch (error: any) {
        console.error("\n❌ ERROR:", error.message)
        console.error("Status:", error.status)
        console.error("Type:", error.type)
    }
}

testClaude()
