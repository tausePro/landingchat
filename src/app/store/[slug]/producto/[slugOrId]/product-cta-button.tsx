"use client"

import { useRouter } from "next/navigation"
import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getChatUrl, getStoreLink } from "@/lib/utils/store-urls"

interface ProductCTAButtonProps {
    slug: string
    productId: string
    primaryColor: string
    variant?: 'mobile' | 'desktop'
}

export function ProductCTAButton({ slug, productId, primaryColor, variant = 'mobile' }: ProductCTAButtonProps) {
    const router = useRouter()
    const isSubdomain = useIsSubdomain()

    console.log('ProductCTAButton received slug:', slug)

    const handleClick = () => {
        // Check if customer is already identified
        const customerId = localStorage.getItem(`customer_${slug}`)

        if (customerId) {
            // Navigate directly to chat with product
            const chatUrl = `${getChatUrl(isSubdomain, slug)}?product=${productId}`
            router.push(chatUrl)
        } else {
            // Navigate to store with action=chat to trigger the gate modal
            const storeUrl = getStoreLink(`/?action=chat&product=${productId}`, isSubdomain, slug)
            router.push(storeUrl)
        }
    }

    if (variant === 'desktop') {
        return (
            <button
                onClick={handleClick}
                className="flex w-full items-center justify-center gap-2 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg hover:opacity-90 transition-opacity"
                style={{ backgroundColor: primaryColor }}
            >
                <span className="material-symbols-outlined">chat_bubble</span>
                <span>Chatear para Comprar</span>
            </button>
        )
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 z-50 md:hidden">
            <div className="max-w-md mx-auto">
                <button
                    onClick={handleClick}
                    className="flex w-full items-center justify-center gap-2 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: primaryColor }}
                >
                    <span className="material-symbols-outlined">chat_bubble</span>
                    <span>Chatear para Comprar</span>
                </button>
            </div>
        </div>
    )
}
