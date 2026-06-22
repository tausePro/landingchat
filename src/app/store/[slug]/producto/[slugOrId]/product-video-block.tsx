"use client"

import type { ProductVideoBlockLabels } from "./product-detail-types"

function getYouTubeEmbedUrl(value: string): string | null {
    try {
        const url = new URL(value)
        if (url.hostname.includes("youtu.be")) {
            const id = url.pathname.replace("/", "")
            return id ? `https://www.youtube.com/embed/${id}` : null
        }

        if (url.hostname.includes("youtube.com")) {
            const id = url.searchParams.get("v")
            return id ? `https://www.youtube.com/embed/${id}` : value.replace("/watch", "/embed")
        }

        return null
    } catch {
        return null
    }
}

export function ProductVideoBlock({ videoUrl, primaryColor, labels }: { videoUrl: string; primaryColor: string; labels: ProductVideoBlockLabels }) {
    const youtubeEmbedUrl = getYouTubeEmbedUrl(videoUrl)

    return (
        <section id="product-video" className="mt-8 scroll-mt-28 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{labels.eyebrow}</p>
                <h3 className="mt-1 text-lg font-extrabold tracking-[-0.02em] text-slate-950 dark:text-white">{labels.title}</h3>
            </div>
            <div className="bg-black">
                {youtubeEmbedUrl ? (
                    <iframe
                        src={youtubeEmbedUrl}
                        title={labels.iframeTitle}
                        className="aspect-video w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                ) : (
                    <video
                        src={videoUrl}
                        className="aspect-video w-full object-cover"
                        controls
                        playsInline
                    />
                )}
            </div>
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm text-slate-600 dark:text-slate-300 sm:px-5">
                <span className="material-symbols-outlined text-[18px]" style={{ color: primaryColor }}>play_circle</span>
                <span>{labels.description}</span>
            </div>
        </section>
    )
}
