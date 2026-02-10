"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Search, Smartphone, Globe, Bot } from "lucide-react"
import type { ConsoleChatItem } from "../../actions"

interface ChatListProps {
    chats: ConsoleChatItem[]
    selectedChatId: string | null
    searchQuery: string
    onSearch: (query: string) => void
    onSelectChat: (chatId: string) => void
    isLoading: boolean
}

function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return ""
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "ahora"
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString("es", { day: "numeric", month: "short" })
}

function getChannelIcon(channel: string) {
    if (channel === "whatsapp") return <Smartphone className="size-3 text-green-500" />
    return <Globe className="size-3 text-blue-500" />
}

function getSenderPrefix(senderType: string | null): string {
    if (senderType === "agent") return "Tú: "
    if (senderType === "bot") return "Bot: "
    return ""
}

export function ChatList({
    chats,
    selectedChatId,
    searchQuery,
    onSearch,
    onSelectChat,
    isLoading,
}: ChatListProps) {
    const [localSearch, setLocalSearch] = useState(searchQuery)

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setLocalSearch(value)
        // Debounce: buscar después de 300ms sin escribir
        const timeout = setTimeout(() => onSearch(value), 300)
        return () => clearTimeout(timeout)
    }, [onSearch])

    return (
        <div className="flex flex-col h-full">
            {/* Search bar */}
            <div className="p-3 border-b border-border-light dark:border-border-dark">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-light-secondary dark:text-text-dark-secondary" />
                    <input
                        type="text"
                        placeholder="Buscar conversación..."
                        value={localSearch}
                        onChange={handleSearchChange}
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm text-text-light-primary dark:text-text-dark-primary placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 border-0"
                    />
                </div>
            </div>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto">
                {isLoading && chats.length === 0 ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                    </div>
                ) : chats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-text-light-secondary dark:text-text-dark-secondary text-sm">
                        <p>No hay conversaciones</p>
                        {searchQuery && (
                            <p className="text-xs mt-1">Intenta otra búsqueda</p>
                        )}
                    </div>
                ) : (
                    chats.map((chat) => {
                        const isSelected = chat.id === selectedChatId
                        const displayName = chat.customer_name || chat.customer_phone || chat.phone_number || "Sin nombre"

                        return (
                            <button
                                key={chat.id}
                                onClick={() => onSelectChat(chat.id)}
                                className={cn(
                                    "w-full flex items-start gap-3 px-4 py-3 border-b border-border-light/50 dark:border-border-dark/50 transition-colors text-left",
                                    isSelected
                                        ? "bg-primary/5 border-l-2 border-l-primary"
                                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                )}
                            >
                                {/* Avatar */}
                                <div className="relative flex-shrink-0">
                                    <div className={cn(
                                        "size-10 rounded-full flex items-center justify-center text-sm font-medium",
                                        isSelected
                                            ? "bg-primary/20 text-primary"
                                            : "bg-slate-200 dark:bg-slate-700 text-text-light-secondary dark:text-text-dark-secondary"
                                    )}>
                                        {displayName.charAt(0).toUpperCase()}
                                    </div>
                                    {/* Canal indicator */}
                                    <div className="absolute -bottom-0.5 -right-0.5 bg-white dark:bg-slate-900 rounded-full p-0.5">
                                        {getChannelIcon(chat.channel)}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={cn(
                                            "text-sm truncate",
                                            chat.unread_count > 0
                                                ? "font-semibold text-text-light-primary dark:text-text-dark-primary"
                                                : "font-medium text-text-light-primary dark:text-text-dark-primary"
                                        )}>
                                            {displayName}
                                        </span>
                                        <span className="text-xs text-text-light-secondary dark:text-text-dark-secondary flex-shrink-0">
                                            {formatRelativeTime(chat.last_message_at || chat.updated_at)}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 mt-0.5">
                                        <p className={cn(
                                            "text-xs truncate",
                                            chat.unread_count > 0
                                                ? "text-text-light-primary dark:text-text-dark-primary"
                                                : "text-text-light-secondary dark:text-text-dark-secondary"
                                        )}>
                                            {chat.last_message
                                                ? `${getSenderPrefix(chat.last_message_sender)}${chat.last_message}`
                                                : "Sin mensajes"
                                            }
                                        </p>
                                        {chat.unread_count > 0 && (
                                            <span className="flex-shrink-0 bg-primary text-white text-[10px] font-bold rounded-full size-5 flex items-center justify-center">
                                                {chat.unread_count > 99 ? "99+" : chat.unread_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        )
                    })
                )}
            </div>
        </div>
    )
}
