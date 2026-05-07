"use client"

import Image from "next/image"
import Script from "next/script"

interface MetaPixelProps {
    pixelId: string
}

// Declarar tipos globales para Meta Pixel
declare global {
    interface Window {
        fbq?: (...args: unknown[]) => void
        _fbq?: (...args: unknown[]) => void
    }
}

export function MetaPixel({ pixelId }: MetaPixelProps) {
    // Init y PageView se disparan exactamente una vez desde el <Script> inline.
    // No re-inicializar en un useEffect: causaba doble init y doble PageView.
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
                <Image
                    height="1"
                    width="1"
                    unoptimized
                    style={{ display: "none" }}
                    src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
                    alt=""
                />
            </noscript>
        </>
    )
}

/**
 * Manual Advanced Matching para Meta Pixel.
 * Re-inicializa el Pixel pasando datos del cliente (email, teléfono, nombre, etc.)
 * para que Meta los hashee client-side y mejore Event Match Quality.
 *
 * Llamar cuando el usuario se identifica (login, checkout) y antes de eventos clave.
 * Meta hashea automáticamente los valores en plano; no enviarlos pre-hasheados.
 *
 * https://developers.facebook.com/docs/meta-pixel/advanced/advanced-matching
 */
export interface MetaPixelAdvancedMatchingData {
    em?: string // email en plano
    ph?: string // teléfono en plano (E.164 sin "+")
    fn?: string // first name en plano
    ln?: string // last name en plano
    ct?: string // city en plano
    st?: string // state/region en plano
    zp?: string // postal code en plano
    country?: string // ISO-2 lowercase ("co")
    external_id?: string
}

export function setMetaPixelAdvancedMatching(
    pixelId: string,
    data: MetaPixelAdvancedMatchingData
): void {
    if (typeof window === "undefined" || !window.fbq || !pixelId) return

    // Filtrar campos vacíos para no contaminar el matching.
    const sanitized: Record<string, string> = {}
    for (const [key, value] of Object.entries(data)) {
        if (typeof value === "string" && value.trim().length > 0) {
            sanitized[key] = value.trim()
        }
    }

    if (Object.keys(sanitized).length === 0) return

    // Re-init con datos. Meta hashea SHA256 client-side automáticamente.
    window.fbq("init", pixelId, sanitized)
}

// Hook para trackear eventos de Meta Pixel
export function useMetaPixel() {
    const trackEvent = (eventName: string, parameters?: Record<string, unknown>, eventId?: string) => {
        if (typeof window !== "undefined" && window.fbq) {
            if (eventId) {
                window.fbq("track", eventName, parameters, { eventID: eventId })
                return
            }
            window.fbq("track", eventName, parameters)
        }
    }

    const trackCustomEvent = (eventName: string, parameters?: Record<string, unknown>) => {
        if (typeof window !== "undefined" && window.fbq) {
            window.fbq("trackCustom", eventName, parameters)
        }
    }

    return {
        trackEvent,
        trackCustomEvent,
        // Eventos específicos de e-commerce
        trackViewContent: (contentId: string, contentName: string, value?: number, currency = "COP", eventId?: string) => {
            trackEvent("ViewContent", {
                content_ids: [contentId],
                content_name: contentName,
                content_type: "product",
                value: value,
                currency: currency,
            }, eventId)
        },
        trackAddToCart: (contentId: string, contentName: string, value: number, currency = "COP", eventId?: string) => {
            trackEvent("AddToCart", {
                content_ids: [contentId],
                content_name: contentName,
                content_type: "product",
                value: value,
                currency: currency,
            }, eventId)
        },
        trackInitiateCheckout: (value: number, currency = "COP", contentIds?: string[], eventId?: string) => {
            trackEvent("InitiateCheckout", {
                value: value,
                currency: currency,
                content_ids: contentIds,
                content_type: "product",
            }, eventId)
        },
        trackPurchase: (value: number, currency = "COP", contentIds?: string[], orderId?: string, eventId?: string) => {
            if (typeof window !== "undefined" && window.fbq) {
                window.fbq("track", "Purchase", {
                    value: value,
                    currency: currency,
                    content_ids: contentIds,
                    content_type: "product",
                    order_id: orderId,
                }, { eventID: eventId || (orderId ? `purchase_${orderId}` : undefined) })
            }
        },
        trackViewCategory: (categoryId: string, categoryName: string) => {
            trackEvent("ViewCategory", {
                content_category: categoryName,
                content_ids: [categoryId],
                content_type: "product_group",
            })
        },
        trackSearch: (searchQuery: string, contentIds?: string[]) => {
            trackEvent("Search", {
                search_string: searchQuery,
                content_ids: contentIds,
                content_type: "product",
            })
        },
    }
}