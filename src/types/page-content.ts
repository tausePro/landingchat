// Page template types based on Stitch prototypes

export type PageType = 'faq' | 'legal' | 'about' | 'html'

// FAQ Template (Prototype 42)
export interface FAQContent {
    type: 'faq'
    title: string
    searchPlaceholder?: string
    categories: Array<{
        id: string
        name: string
    }>
    questions: Array<{
        id: string
        question: string
        answer: string
        category?: string
    }>
    cta?: {
        title: string
        description: string
        buttonText: string
    }
}

// Legal Template (Prototypes 43, 44 - Terms & Privacy)
export interface LegalContent {
    type: 'legal'
    title: string
    lastUpdated?: string
    sections: Array<{
        id: string
        title: string
        content: string
        subsections?: Array<{
            id: string
            title: string
            content: string
        }>
    }>
}

// About Template (Prototype 45)
export interface AboutContent {
    type: 'about'
    hero?: {
        title: string
        subtitle: string
        image?: string
        ctaText?: string
    }
    story?: {
        tagline: string
        title: string
        paragraphs: string[]
        image?: string
        ctaText?: string
    }
    values?: Array<{
        icon: string
        title: string
        description: string
    }>
    stats?: Array<{
        value: string
        label: string
    }>
    team?: Array<{
        name: string
        role: string
        image?: string
        email?: string
    }>
    cta?: {
        title: string
        description: string
        buttonText: string
    }
}

// Simple HTML fallback
export interface HTMLContent {
    type: 'html'
    html: string
}

export type PageContent = FAQContent | LegalContent | AboutContent | HTMLContent

// Helper to determine page type
export function getPageType(content: PageContent): PageType {
    return content.type
}

// Type guards - updated to handle null
export function isFAQContent(content: PageContent | null | undefined): content is FAQContent {
    return content?.type === 'faq'
}

export function isLegalContent(content: PageContent | null | undefined): content is LegalContent {
    return content?.type === 'legal'
}

export function isAboutContent(content: PageContent | null | undefined): content is AboutContent {
    return content?.type === 'about'
}

export function isHTMLContent(content: PageContent | null | undefined): content is HTMLContent {
    return content?.type === 'html'
}
