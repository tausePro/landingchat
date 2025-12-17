"use client"

import { useEffect } from "react"
import Script from "next/script"

interface MetaPixelProps {
    pixelId: string
}

// Declarar tipos globales para Meta Pixel
declare global {
    interface Window {
        fbq?: (...args: any[]) => void
        _fbq?: (...args: any[]) => void
    }
}

export function MetaPixel({ pixelId }: MetaPixelProps) {
    useEffect(() => {
        // Inicializar Meta Pixel cuando el componente se monta
        if (typeof window !== "undefined" && window.fbq) {
            window.fbq("init", pixelId)
            window.fbq("track", "PageView")
        }
    }, [pixelId])

    if (!pixelId) return null

    return (
        <>
            {/* Meta Pixel Code */}
            <Script
                id="meta-pixel"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                    __html: `
                        !function(f,b,e,v,n,t,s)
                        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                        n.queue=[];t=b.createElement(e);t.async=!0;
                        t.src=v;s=b.getElementsByTagName(e)[0];
                        s.parentNode.insertBefore(t,s)}(window, document,'script',
                        'https://connect.facebook.net/en_US/fbevents.js');
                        fbq('init', '${pixelId}');
                        fbq('track', 'PageView');
                    `,
                }}
            />
            {/* Noscript fallback */}
            <noscript>
                <img
                    height="1"
                    width="1"
                    style={{ display: "none" }}
                    src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
                    alt=""
                />
            </noscript>
        </>
    )
}

// Hook para trackear eventos de Meta Pixel
export function useMetaPixel() {
    const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
        if (typeof window !== "undefined" && window.fbq) {
            window.fbq("track", eventName, parameters)
        }
    }

    const trackCustomEvent = (eventName: string, parameters?: Record<string, any>) => {
        if (typeof window !== "undefined" && window.fbq) {
            window.fbq("trackCustom", eventName, parameters)
        }
    }

    return {
        trackEvent,
        trackCustomEvent,
        // Eventos específicos de e-commerce
        trackViewContent: (contentId: string, contentName: string, value?: number, currency = "COP") => {
            trackEvent("ViewContent", {
                content_ids: [contentId],
                content_name: contentName,
                content_type: "product",
                value: value,
                currency: currency,
            })
        },
        trackAddToCart: (contentId: string, contentName: string, value: number, currency = "COP") => {
            trackEvent("AddToCart", {
                content_ids: [contentId],
                content_name: contentName,
                content_type: "product",
                value: value,
                currency: currency,
            })
        },
        trackInitiateCheckout: (value: number, currency = "COP", contentIds?: string[]) => {
            trackEvent("InitiateCheckout", {
                value: value,
                currency: currency,
                content_ids: contentIds,
                content_type: "product",
            })
        },
        trackPurchase: (value: number, currency = "COP", contentIds?: string[], orderId?: string) => {
            trackEvent("Purchase", {
                value: value,
                currency: currency,
                content_ids: contentIds,
                content_type: "product",
                order_id: orderId,
            })
        },
    }
}