"use client"

import { useState, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
    getChatsForConsole,
    getChatDetail,
    sendAgentMessage,
    updateChatStatus,
} from "../actions"
import type { ConsoleChatsResult, ConsoleChatItem, ChatDetailData } from "../actions"
import { SidebarFolders } from "./components/sidebar-folders"
import { ChatList } from "./components/chat-list"
import { ChatPanel } from "./components/chat-panel"
import { CustomerSidebar } from "./components/customer-sidebar"
import { ArrowLeft, Layers } from "lucide-react"
import Link from "next/link"

interface ChatConsoleProps {
    initialData: ConsoleChatsResult
}

export function ChatConsole({ initialData }: ChatConsoleProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    // Estado global de la consola
    const [chats, setChats] = useState<ConsoleChatItem[]>(initialData.chats)
    const [counts, setCounts] = useState(initialData.counts)
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
    const [chatDetail, setChatDetail] = useState<ChatDetailData | null>(null)
    const [loadingDetail, setLoadingDetail] = useState(false)

    // Filtros
    const [activeFolder, setActiveFolder] = useState("all")
    const [activeChannel, setActiveChannel] = useState<string | undefined>(undefined)
    const [searchQuery, setSearchQuery] = useState("")

    // Recargar lista de chats con filtros
    const refreshChats = useCallback(async (folder?: string, channel?: string, search?: string) => {
        const f = folder ?? activeFolder
        const ch = channel ?? activeChannel
        const s = search ?? searchQuery

        const result = await getChatsForConsole(f, ch, s)
        if (result.success) {
            setChats(result.data.chats)
            setCounts(result.data.counts)
        }
    }, [activeFolder, activeChannel, searchQuery])

    // Seleccionar un chat
    const handleSelectChat = useCallback(async (chatId: string) => {
        if (chatId === selectedChatId) return
        setSelectedChatId(chatId)
        setLoadingDetail(true)

        const result = await getChatDetail(chatId)
        if (result.success) {
            setChatDetail(result.data)
        }
        setLoadingDetail(false)
    }, [selectedChatId])

    // Cambiar carpeta
    const handleFolderChange = useCallback((folder: string) => {
        setActiveFolder(folder)
        setSelectedChatId(null)
        setChatDetail(null)
        startTransition(() => {
            refreshChats(folder, activeChannel, searchQuery)
        })
    }, [activeChannel, searchQuery, refreshChats])

    // Cambiar canal
    const handleChannelChange = useCallback((channel?: string) => {
        setActiveChannel(channel)
        setSelectedChatId(null)
        setChatDetail(null)
        startTransition(() => {
            refreshChats(activeFolder, channel, searchQuery)
        })
    }, [activeFolder, searchQuery, refreshChats])

    // Búsqueda
    const handleSearch = useCallback((query: string) => {
        setSearchQuery(query)
        startTransition(() => {
            refreshChats(activeFolder, activeChannel, query)
        })
    }, [activeFolder, activeChannel, refreshChats])

    // Enviar mensaje
    const handleSendMessage = useCallback(async (content: string, isInternal: boolean = false) => {
        if (!selectedChatId) return

        const result = await sendAgentMessage(selectedChatId, content, isInternal)
        if (result.success) {
            // Recargar detalle del chat para ver el mensaje nuevo
            // (también lo hará Realtime, pero por si acaso)
            refreshChats()
        }
        return result
    }, [selectedChatId, refreshChats])

    // Resolver/reabrir chat
    const handleStatusChange = useCallback(async (status: "active" | "closed" | "pending") => {
        if (!selectedChatId) return

        const result = await updateChatStatus(selectedChatId, status)
        if (result.success) {
            // Actualizar el estado local
            setChatDetail(prev => prev ? { ...prev, status } : null)
            refreshChats()
        }
        return result
    }, [selectedChatId, refreshChats])

    return (
        <div className="flex h-screen w-full bg-background-light dark:bg-background-dark overflow-hidden">
            {/* Panel 1: Sidebar Carpetas */}
            <div className="w-64 flex-shrink-0 border-r border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark flex flex-col">
                {/* Header con logo y back */}
                <div className="h-14 flex items-center gap-2 px-4 border-b border-border-light dark:border-border-dark">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 text-text-light-secondary dark:text-text-dark-secondary hover:text-primary transition-colors"
                    >
                        <ArrowLeft className="size-4" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-lg bg-landing-deep text-white">
                            <Layers className="size-4" />
                        </div>
                        <span className="font-semibold text-sm text-text-light-primary dark:text-text-dark-primary">
                            Live Chat
                        </span>
                    </div>
                </div>

                <SidebarFolders
                    counts={counts}
                    activeFolder={activeFolder}
                    activeChannel={activeChannel}
                    onFolderChange={handleFolderChange}
                    onChannelChange={handleChannelChange}
                />
            </div>

            {/* Panel 2: Lista de Chats */}
            <div className="w-80 flex-shrink-0 border-r border-border-light dark:border-border-dark bg-white dark:bg-slate-900 flex flex-col">
                <ChatList
                    chats={chats}
                    selectedChatId={selectedChatId}
                    searchQuery={searchQuery}
                    onSearch={handleSearch}
                    onSelectChat={handleSelectChat}
                    isLoading={isPending}
                />
            </div>

            {/* Panel 3: Chat Central */}
            <div className="flex-1 flex flex-col min-w-0">
                <ChatPanel
                    chatDetail={chatDetail}
                    loading={loadingDetail}
                    onSendMessage={handleSendMessage}
                    onStatusChange={handleStatusChange}
                />
            </div>

            {/* Panel 4: Perfil Cliente */}
            {chatDetail && (
                <div className="w-80 flex-shrink-0 border-l border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-y-auto">
                    <CustomerSidebar chatDetail={chatDetail} />
                </div>
            )}
        </div>
    )
}
