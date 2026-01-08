"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

interface UseScrollDepthOptions {
    capture: (event: string, props?: Record<string, unknown>) => void
    enabled?: boolean
}

export function useScrollDepthTracking({ capture, enabled }: UseScrollDepthOptions) {
    const pathname = usePathname()
    // Track which depths have been fired for the current page
    const trackedDepths = useRef<Set<number>>(new Set())
    
    useEffect(() => {
        if (!enabled) return

        // Reset tracked depths when path changes
        trackedDepths.current = new Set()

        const handleScroll = () => {
            const scrollTop = window.scrollY
            const docHeight = document.documentElement.scrollHeight
            const winHeight = window.innerHeight
            
            // Calculate percentage
            const scrollPercent = scrollTop + winHeight >= docHeight 
                ? 100 
                : Math.round((scrollTop / (docHeight - winHeight)) * 100)

            // Define thresholds to track
            const thresholds = [25, 50, 75, 90]

            thresholds.forEach(threshold => {
                if (scrollPercent >= threshold && !trackedDepths.current.has(threshold)) {
                    trackedDepths.current.add(threshold)
                    
                    capture("$scroll_depth", {
                        depth: threshold,
                        path: pathname,
                        $current_url: window.location.href
                    })
                }
            })
        }

        // Throttle scroll event
        let timeoutId: NodeJS.Timeout
        const throttledScroll = () => {
            if (timeoutId) return
            timeoutId = setTimeout(() => {
                handleScroll()
                clearTimeout(timeoutId)
                // @ts-ignore
                timeoutId = null
            }, 500)
        }

        window.addEventListener("scroll", throttledScroll)
        
        // Initial check in case page is short or already scrolled
        handleScroll()

        return () => {
            window.removeEventListener("scroll", throttledScroll)
            if (timeoutId) clearTimeout(timeoutId)
        }
    }, [pathname, enabled, capture])
}
