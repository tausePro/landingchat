import { PageContent } from "@/types/page-content"

/**
 * Helper to parse page content with fallback logic:
 * 1. Try content_jsonb (new JSONB column)
 * 2. Fallback to content (legacy TEXT column wrapped as HTML)
 */
export function parsePageContent(page: {
    content: string | null
    content_jsonb: any | null
}): PageContent {
    // Priority 1: Use content_jsonb if available and not empty
    if (page.content_jsonb && Object.keys(page.content_jsonb).length > 0) {
        return page.content_jsonb as PageContent
    }

    // Priority 2: Fallback to content (TEXT) wrapped as HTML
    if (page.content) {
        return {
            type: 'html',
            html: page.content
        }
    }

    // Default: Empty HTML
    return {
        type: 'html',
        html: ''
    }
}
