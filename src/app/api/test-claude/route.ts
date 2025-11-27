import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

export async function GET() {
    try {
        console.log("Testing Claude API...")
        console.log("API Key present:", !!process.env.ANTHROPIC_API_KEY)

        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        })

        const message = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 100,
            messages: [{
                role: "user",
                content: "Di 'hola' en una palabra"
            }]
        })

        console.log("Claude response:", message)

        return NextResponse.json({
            success: true,
            response: message.content[0].type === 'text' ? message.content[0].text : 'No text',
            model: message.model
        })
    } catch (error: any) {
        console.error("Claude API test error:", error)
        return NextResponse.json({
            success: false,
            error: error.message,
            details: JSON.stringify(error, Object.getOwnPropertyNames(error))
        }, { status: 500 })
    }
}
