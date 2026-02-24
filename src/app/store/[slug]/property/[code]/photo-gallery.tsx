"use client"

import { useState } from "react"
import Image from "next/image"

interface PhotoGalleryProps {
  images: Array<{ url: string; position: number }>
  title: string
  primaryColor: string
}

const isValidImageUrl = (url?: string | null) =>
  Boolean(url && url.startsWith("http") && !url.includes("arrendasoft.coimg"))

const shouldBypassOptimization = (url?: string | null) =>
  Boolean(url && url.includes("arrendasoft.co"))

export function PhotoGallery({ images, title, primaryColor }: PhotoGalleryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const validImages = images.filter(img => isValidImageUrl(img.url))

  if (validImages.length === 0) return null

  const goTo = (idx: number) => {
    if (idx < 0) setCurrentIndex(validImages.length - 1)
    else if (idx >= validImages.length) setCurrentIndex(0)
    else setCurrentIndex(idx)
  }

  return (
    <>
      {/* Trigger Button — placed over gallery grid */}
      <button
        onClick={() => { setCurrentIndex(0); setIsOpen(true) }}
        className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm text-slate-900 px-4 py-2 rounded-lg font-bold text-sm border border-slate-200 shadow-lg flex items-center gap-2 z-20 hover:bg-white transition-colors"
      >
        <span className="material-symbols-outlined text-base">grid_view</span>
        Ver {validImages.length} fotos
      </button>

      {/* Lightbox Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 text-white">
            <div>
              <h3 className="font-bold text-lg">{title}</h3>
              <p className="text-white/60 text-sm">{currentIndex + 1} de {validImages.length}</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="size-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Main Image */}
          <div className="flex-1 relative flex items-center justify-center px-16">
            <div className="relative w-full max-w-5xl aspect-[16/10]">
              <Image
                src={validImages[currentIndex].url}
                alt={`${title} - ${currentIndex + 1}`}
                fill
                className="object-contain"
                unoptimized={shouldBypassOptimization(validImages[currentIndex].url)}
                priority
              />
            </div>

            {/* Prev */}
            <button
              onClick={() => goTo(currentIndex - 1)}
              className="absolute left-4 top-1/2 -translate-y-1/2 size-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <span className="material-symbols-outlined text-2xl">chevron_left</span>
            </button>

            {/* Next */}
            <button
              onClick={() => goTo(currentIndex + 1)}
              className="absolute right-4 top-1/2 -translate-y-1/2 size-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <span className="material-symbols-outlined text-2xl">chevron_right</span>
            </button>
          </div>

          {/* Thumbnails */}
          <div className="px-6 py-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <div className="flex gap-2 justify-center">
              {validImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`relative shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-all ${
                    idx === currentIndex ? "border-white opacity-100" : "border-transparent opacity-50 hover:opacity-80"
                  }`}
                >
                  <Image
                    src={img.url}
                    alt={`Miniatura ${idx + 1}`}
                    fill
                    className="object-cover"
                    unoptimized={shouldBypassOptimization(img.url)}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
