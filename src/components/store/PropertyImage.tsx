"use client"

import { useState } from "react"
import Image from "next/image"

interface PropertyImageProps {
  src: string
  alt: string
  fill?: boolean
  className?: string
  sizes?: string
  priority?: boolean
  unoptimized?: boolean
  placeholderIcon?: string
  placeholderIconSize?: number
}

export function PropertyImage({
  src,
  alt,
  fill = true,
  className = "object-cover",
  sizes,
  priority,
  unoptimized,
  placeholderIcon = "home",
  placeholderIconSize = 48,
}: PropertyImageProps) {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return (
      <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
        <span className="material-symbols-outlined" style={{ fontSize: placeholderIconSize }}>
          {placeholderIcon}
        </span>
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      className={className}
      sizes={sizes}
      priority={priority}
      unoptimized={unoptimized}
      onError={() => setHasError(true)}
    />
  )
}
