"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getStoreLink } from "@/lib/utils/store-urls"

interface Chat {
    id: string
    created_at: string
    last_message: string
    last_message_at: string
}

interface ChatSidebarProps {
    slug: string
}

export function ChatSidebar({ slug }: ChatSidebarProps) {
    const router = useRouter()
    const pathname = usePathname()
    const isSubdomain = useIsSubdomain()
    const [chats, setChats] = useState<Chat[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [customerId, setCustomerId] = useState<string | null>(null)

    useEffect(() => {
        const storedCustomerId = localStorage.getItem(`customer_${slug}`)
        if (storedCustomerId) {
            setCustomerId(storedCustomerId)
            fetchHistory(storedCustomerId)
        } else {
            setIsLoading(false)
        }
    }, [slug])

    const fetchHistory = async (custId: string) => {
        try {
            const res = await fetch(`/api/store/${slug}/chat/customer/${custId}`)
            if (res.ok) {
                const data = await res.json()
                setChats(data.chats || [])
            }
        } catch (error) {
            console.error("Error fetching chat history:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleNewChat = () => {
        // Remove chatId from localStorage to force new chat creation on next init
        localStorage.removeItem(`chatId_${slug}`)

        // Navigate to base chat URL
        const url = getStoreLink('/chat', isSubdomain, slug)
        router.push(url)

        // Force refresh to trigger new chat init
        router.refresh()
    }

    const handleChatClick = (chatId: string) => {
        // Save selected chat ID
        localStorage.setItem(`chatId_${slug}`, chatId)

        // Navigate (if we had a route for specific chat, but currently we use /chat and init loads from localStorage)
        // So we just reload the page or trigger a re-init. 
        // Ideally, the URL should be /chat/[chatId], but for now let's stick to the current pattern
        // and just reload to let ChatPage pick up the new ID.
        window.location.reload()
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))

        if (days === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        } else if (days === 1) {
            return 'Ayer'
        } else {
            return date.toLocaleDateString()
        }
    }

    if (isLoading) {
        return (
            <aside className="w-64 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 shrink-0 hidden md:flex">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="h-6 w-24 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                </div>
                <div className="p-2 space-y-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800/50 rounded-lg animate-pulse"></div>
                    ))}
                </div>
            </aside>
        )
    }

    return (
        <aside className="w-64 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 shrink-0 hidden md:flex">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white">Historial</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {chats.length === 0 ? (
                    <div className="text-center p-4 text-gray-500 text-sm">
                        No hay conversaciones recientes
                    </div>
                ) : (
                    chats.map((chat) => (
                        <div
                            key={chat.id}
                            onClick={() => handleChatClick(chat.id)}
                            className="p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/60 cursor-pointer transition-colors group"
                        >
                            <p className="font-medium text-sm text-slate-900 dark:text-gray-300 truncate group-hover:text-primary transition-colors">
                                {chat.last_message}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {formatDate(chat.last_message_at)}
                            </p>
                        </div>
                    ))
                )}
            </div>

            <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                <button
                    onClick={handleNewChat}
                    className="flex w-full items-center justify-center gap-2 rounded-md h-10 text-sm font-medium bg-gray-100 dark:bg-gray-800 text-slate-900 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                    <span className="material-symbols-outlined text-lg">add_comment</span>
                    <span>Nueva conversación</span>
                </button>
            </div>
        </aside>
    )
}
