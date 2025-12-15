/**
 * API de debug para verificar el dominio que llega
 */

import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"

export async function GET(request: NextRequest) {
    const headersList = await headers()
    const host = headersList.get("host") || ""
    const xForwardedHost = headersList.get("x-forwarded-host") || ""
    const pathname = request.nextUrl.pathname
    
    return NextResponse.json({
        host,
        xForwardedHost,
        pathname,
        url: request.url,
        allHeaders: Object.fromEntries(headersList.entries())
    })
}
