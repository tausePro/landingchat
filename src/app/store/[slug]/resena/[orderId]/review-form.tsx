"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { t } from "@/lib/i18n/storefront-strings"
import type { SupportedLocale } from "@/types/organization"
import { submitCustomerReviews } from "./actions"

interface ReviewFormProduct {
    productId: string
    name: string
    imageUrl: string | null
}

interface ReviewRequestFormProps {
    orderId: string
    token: string
    locale: SupportedLocale
    storeLink: string
    defaultAuthorName: string
    products: ReviewFormProduct[]
}

interface ProductReviewState {
    rating: number
    title: string
    content: string
    skipped: boolean
}

function StarRating({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => onChange(star)}
                    aria-label={`${star} / 5`}
                    className={`text-2xl transition-transform hover:scale-110 ${star <= value ? "text-amber-400" : "text-slate-300"}`}
                >
                    ★
                </button>
            ))}
        </div>
    )
}

/**
 * Form público de reseñas por producto de la orden. El cliente puede
 * calificar todos o omitir algunos; las reseñas entran sin publicar.
 */
export function ReviewRequestForm({ orderId, token, locale, storeLink, defaultAuthorName, products }: ReviewRequestFormProps) {
    const [authorName, setAuthorName] = useState(defaultAuthorName)
    const [states, setStates] = useState<Record<string, ProductReviewState>>(() =>
        Object.fromEntries(products.map((product) => [
            product.productId,
            { rating: 0, title: "", content: "", skipped: false },
        ]))
    )
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const updateState = (productId: string, patch: Partial<ProductReviewState>) =>
        setStates((prev) => ({ ...prev, [productId]: { ...prev[productId], ...patch } }))

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setError(null)

        const reviews = products
            .filter((product) => {
                const state = states[product.productId]
                return !state.skipped && state.rating >= 1 && state.content.trim().length >= 5
            })
            .map((product) => {
                const state = states[product.productId]
                return {
                    productId: product.productId,
                    rating: state.rating,
                    title: state.title.trim() || undefined,
                    content: state.content.trim(),
                }
            })

        if (reviews.length === 0) {
            setError(t("store.review_request.error_empty", locale))
            return
        }

        setSubmitting(true)
        try {
            const result = await submitCustomerReviews({ orderId, token, authorName: authorName.trim(), reviews })
            if (result.success) {
                setSubmitted(true)
            } else {
                setError(result.error || t("store.review_request.error_generic", locale))
            }
        } catch {
            setError(t("store.review_request.error_generic", locale))
        } finally {
            setSubmitting(false)
        }
    }

    if (submitted) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                    {t("store.review_request.thanks_title", locale)}
                </h2>
                <p className="text-sm text-slate-500 mb-6">
                    {t("store.review_request.thanks_body", locale)}
                </p>
                <Link href={storeLink} className="text-sm font-semibold text-primary hover:underline">
                    {t("store.review_request.back_to_store", locale)}
                </Link>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    {t("store.review_request.name_label", locale)}
                </label>
                <input
                    type="text"
                    value={authorName}
                    onChange={(event) => setAuthorName(event.target.value)}
                    required
                    minLength={2}
                    maxLength={80}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
            </div>

            {products.map((product) => {
                const state = states[product.productId]
                return (
                    <div key={product.productId} className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 ${state.skipped ? "opacity-50" : ""}`}>
                        <div className="flex items-center gap-3 mb-4">
                            {product.imageUrl && (
                                <Image
                                    src={product.imageUrl}
                                    alt={product.name}
                                    width={48}
                                    height={48}
                                    className="rounded-lg object-cover size-12"
                                />
                            )}
                            <h3 className="font-semibold text-slate-900 text-sm flex-1">{product.name}</h3>
                            <button
                                type="button"
                                onClick={() => updateState(product.productId, { skipped: !state.skipped })}
                                className="text-xs text-slate-400 hover:text-slate-600 underline"
                            >
                                {t("store.review_request.skip_product", locale)}
                            </button>
                        </div>

                        {!state.skipped && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        {t("store.review_request.rating_label", locale)}
                                    </label>
                                    <StarRating
                                        value={state.rating}
                                        onChange={(rating) => updateState(product.productId, { rating })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        {t("store.review_request.title_label", locale)}
                                    </label>
                                    <input
                                        type="text"
                                        value={state.title}
                                        maxLength={120}
                                        onChange={(event) => updateState(product.productId, { title: event.target.value })}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        {t("store.review_request.comment_label", locale)}
                                    </label>
                                    <textarea
                                        value={state.content}
                                        rows={3}
                                        maxLength={2000}
                                        placeholder={t("store.review_request.comment_placeholder", locale)}
                                        onChange={(event) => updateState(product.productId, { content: event.target.value })}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}

            {error && (
                <p className="text-sm text-red-600 text-center" role="alert">{error}</p>
            )}

            <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-primary text-white font-semibold py-3 text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
                {submitting
                    ? t("store.review_request.submitting", locale)
                    : t("store.review_request.submit", locale)}
            </button>
        </form>
    )
}
