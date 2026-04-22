"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useTracking } from "./tracking-provider"

export function StorefrontPageTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { trackPageView } = useTracking()

  useEffect(() => {
    const query = searchParams.toString()
    const path = query ? `${pathname}?${query}` : pathname

    trackPageView(path, {
      page_group: "storefront",
    })
  }, [pathname, searchParams, trackPageView])

  return null
}
