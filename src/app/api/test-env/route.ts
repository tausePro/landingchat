import { NextResponse } from "next/server"

export async function GET() {
    const hasKey = !!process.env.ANTHROPIC_API_KEY
    const keyPreview = process.env.ANTHROPIC_API_KEY
        ? `${process.env.ANTHROPIC_API_KEY.substring(0, 20)}...`
        : "NOT SET"

    return NextResponse.json({
        hasKey,
        keyPreview,
        allEnvKeys: Object.keys(process.env).filter(k => k.includes('ANTHROPIC'))
    })
}
