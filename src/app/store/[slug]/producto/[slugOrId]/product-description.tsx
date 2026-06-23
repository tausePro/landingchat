"use client"

import { useMemo, useState } from "react"
import type { ProductDescriptionLabels } from "./product-detail-types"

interface ProductDescriptionProps {
    description: string
    primaryColor: string
}

type ProductDescriptionBlock =
    | { id: string; type: "heading"; text: string }
    | { id: string; type: "paragraph"; text: string }
    | { id: string; type: "bulletList"; items: string[] }
    | { id: string; type: "feature"; marker: string; title: string; body?: string }

function stripHtmlTags(value: string): string {
    return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function looksLikeHtml(value: string): boolean {
    return /<\/?[a-z][\s\S]*>/i.test(value)
}

function splitMarker(value: string): { marker: string | null; text: string } {
    const chars = Array.from(value.trim())
    const marker = chars[0] ?? ""
    if (!marker || /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ¿¡]/.test(marker)) {
        return { marker: null, text: value.trim() }
    }

    const text = chars.slice(1).join("").trim()
    return text ? { marker, text } : { marker: null, text: value.trim() }
}

function isBulletLine(value: string): boolean {
    return /^[-*•]\s+/.test(value.trim())
}

function normalizeBulletLine(value: string): string {
    return value.trim().replace(/^[-*•]\s+/, "").trim()
}

function isHeadingLine(value: string): boolean {
    const { text } = splitMarker(value)
    const letters = Array.from(text).filter((char) => /[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/.test(char))
    if (letters.length < 4) {
        return false
    }

    const uppercaseLetters = letters.filter((char) => char === char.toUpperCase())
    const uppercaseRatio = uppercaseLetters.length / letters.length
    return uppercaseRatio >= 0.72 && text.length <= 96
}

function parsePlainDescription(description: string): ProductDescriptionBlock[] {
    const blocks: ProductDescriptionBlock[] = []
    const lines = description
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((line) => line.trim())

    let paragraph: string[] = []
    let bulletItems: string[] = []

    const flushParagraph = () => {
        if (paragraph.length === 0) {
            return
        }

        blocks.push({
            id: `paragraph-${blocks.length}`,
            type: "paragraph",
            text: paragraph.join(" "),
        })
        paragraph = []
    }

    const flushBullets = () => {
        if (bulletItems.length === 0) {
            return
        }

        blocks.push({
            id: `bullets-${blocks.length}`,
            type: "bulletList",
            items: bulletItems,
        })
        bulletItems = []
    }

    lines.forEach((line) => {
        if (!line) {
            flushParagraph()
            flushBullets()
            return
        }

        if (isBulletLine(line)) {
            flushParagraph()
            bulletItems.push(normalizeBulletLine(line))
            return
        }

        if (isHeadingLine(line)) {
            flushParagraph()
            flushBullets()
            blocks.push({
                id: `heading-${blocks.length}`,
                type: "heading",
                text: splitMarker(line).text,
            })
            return
        }

        const marker = splitMarker(line)
        if (marker.marker) {
            flushParagraph()
            flushBullets()
            blocks.push({
                id: `feature-${blocks.length}`,
                type: "feature",
                marker: marker.marker,
                title: marker.text,
            })
            return
        }

        const previousBlock = blocks[blocks.length - 1]
        if (previousBlock?.type === "feature" && !previousBlock.body) {
            previousBlock.body = line
            return
        }

        flushBullets()
        paragraph.push(line)
    })

    flushParagraph()
    flushBullets()

    return blocks
}

interface ProductDescriptionPropsExtended extends ProductDescriptionProps {
    labels: ProductDescriptionLabels
}

export function ProductDescription({ description, primaryColor, labels }: ProductDescriptionPropsExtended) {
    const isHtml = looksLikeHtml(description)
    const plainTextLength = isHtml ? stripHtmlTags(description).length : description.length
    const hasLongDescription = plainTextLength > 520
    const [isExpanded, setIsExpanded] = useState(false)
    const blocks = useMemo(() => isHtml ? [] : parsePlainDescription(description), [description, isHtml])
    const visibleBlocks = isExpanded ? blocks : blocks.slice(0, 7)
    const hasHiddenBlocks = !isHtml && blocks.length > visibleBlocks.length

    return (
        <section className="mt-8 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/50 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ backgroundColor: primaryColor }}>
                    <span className="material-symbols-outlined text-[20px]">auto_stories</span>
                </span>
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{labels.eyebrow}</p>
                    <h2 className="text-xl font-extrabold tracking-[-0.02em] text-slate-950 dark:text-white">{labels.title}</h2>
                </div>
            </div>

            {isHtml ? (
                <div
                    className={`prose prose-slate max-w-none text-slate-600 dark:prose-invert dark:text-slate-300 prose-p:leading-7 prose-headings:tracking-[-0.02em] prose-strong:text-slate-900 dark:prose-strong:text-white ${hasLongDescription && !isExpanded ? "line-clamp-[14]" : ""}`}
                    dangerouslySetInnerHTML={{ __html: description }}
                />
            ) : (
                <div className="space-y-5">
                    {visibleBlocks.map((block) => {
                        if (block.type === "heading") {
                            return (
                                <h3 key={block.id} className="pt-2 text-lg font-extrabold uppercase tracking-[-0.015em] text-slate-950 dark:text-white">
                                    {block.text}
                                </h3>
                            )
                        }

                        if (block.type === "bulletList") {
                            return (
                                <ul key={block.id} className="grid gap-2 sm:grid-cols-2">
                                    {block.items.map((item, index) => (
                                        <li key={`${block.id}-${index}-${item}`} className="flex gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm font-medium leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: primaryColor }} />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            )
                        }

                        if (block.type === "feature") {
                            return (
                                <article key={block.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                                    <div className="flex items-start gap-3">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm dark:bg-slate-950">
                                            {block.marker}
                                        </span>
                                        <div>
                                            <h4 className="font-bold leading-6 text-slate-950 dark:text-white">{block.title}</h4>
                                            {block.body && (
                                                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{block.body}</p>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            )
                        }

                        return (
                            <p key={block.id} className="text-[15px] leading-7 text-slate-600 dark:text-slate-300">
                                {block.text}
                            </p>
                        )
                    })}
                </div>
            )}

            {(hasLongDescription || hasHiddenBlocks) && (
                <button
                    type="button"
                    onClick={() => setIsExpanded((current) => !current)}
                    className="mt-5 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-white"
                    aria-expanded={isExpanded}
                >
                    {isExpanded ? labels.seeLess : labels.seeMore}
                    <span className={`material-symbols-outlined text-[18px] transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                        expand_more
                    </span>
                </button>
            )}
        </section>
    )
}
