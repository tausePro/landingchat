"use client"

import { useEffect, useRef } from "react"
import { useTracking } from "./tracking-provider"

interface CategoryTrackerProps {
    categoryId: string
    categoryName: string
}

export function CategoryTracker({ categoryId, categoryName }: CategoryTrackerProps) {
    const { trackViewCategory } = useTracking()
    const hasTracked = useRef(false)

    useEffect(() => {
        if (hasTracked.current) return
        
        // Función para intentar trackear
        const attemptTrack = () => {
            if (typeof window !== "undefined" && window.fbq) {
                trackViewCategory(categoryId, categoryName)
                hasTracked.current = true
                return true
            }
            return false
        }
        
        // Intentar inmediatamente
        if (attemptTrack()) return
        
        // Si no está disponible, reintentar
        let attempts = 0
        const maxAttempts = 10
        const interval = setInterval(() => {
            attempts++
            if (attemptTrack() || attempts >= maxAttempts) {
                clearInterval(interval)
                if (!hasTracked.current) {
                    trackViewCategory(categoryId, categoryName)
                    hasTracked.current = true
                }
            }
        }, 500)
        
        return () => clearInterval(interval)
    }, [categoryId, categoryName, trackViewCategory])

    return null
}
