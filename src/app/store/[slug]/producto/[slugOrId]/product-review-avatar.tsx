"use client"

import Image from "next/image"
import type { ProductReview } from "@/types/product"

function getReviewInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("")

    return initials || "•"
}

function isValidReviewImageUrl(value: string | null | undefined): value is string {
    if (!value) return false

    try {
        const url = new URL(value)
        return url.protocol === "https:"
    } catch {
        return false
    }
}

export function ReviewAvatar({ review, accentColor, size = 44 }: { review: ProductReview; accentColor: string; size?: number }) {
    const validImageUrl = isValidReviewImageUrl(review.author_image_url) ? review.author_image_url : null

    return (
        <div
            className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white"
            style={{ width: size, height: size, backgroundColor: accentColor }}
        >
            {validImageUrl ? (
                <Image
                    src={validImageUrl}
                    alt={`Foto de ${review.author_name}`}
                    fill
                    className="object-cover"
                    sizes={`${size}px`}
                />
            ) : (
                getReviewInitials(review.author_name)
            )}
        </div>
    )
}
