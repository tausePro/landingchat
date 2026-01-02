"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface ChatHistoryItem {
    id: string
    title: string
    created_at: string
    updated_at?: string
}

interface ChatLayoutProps {
    children: React.ReactNode
    organizationName?: string
    logoUrl?: string
    showHistory?: boolean
    // Dynamic data props
    chatHistory?: ChatHistoryItem[]
    currentChatId?: string
    cartItemCount?: number
    onChatSelect?: (chatId: string) => void
    onNewConversation?: () => void
    onCartClick?: () => void
    onDeleteChat?: (chatId: string) => void
    customHeader?: React.ReactNode
    activeProducts?: any[]
}

export function ChatLayout({
    children,
    organizationName = "LandingChat",
    logoUrl,
    showHistory = true,
    chatHistory = [],
    currentChatId,
    cartItemCount = 0,
    onChatSelect,
    onNewConversation,
    onCartClick,
    onDeleteChat,
    customHeader,
    activeProducts = []
}: ChatLayoutProps) {
    const [activeTab, setActiveTab] = React.useState<'para-ti' | 'historial'>('para-ti')

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffTime = now.getTime() - date.getTime()
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

        if (diffDays === 0) {
            return `Hoy, ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
        } else if (diffDays === 1) {
            return `Ayer, ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
        } else {
            return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
        }
    }

    return (
        <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background-light dark:bg-background-dark">
            {/* Header */}
            {customHeader ? customHeader : (
                <header className="flex items-center justify-between whitespace-nowrap border-b border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark px-6 py-3 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="size-8 rounded overflow-hidden">
                            {logoUrl ? (
                                <img src={logoUrl} alt={organizationName} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-primary flex items-center justify-center text-white">
                                    <svg fill="none" viewBox="0 0 48 48" className="size-5" xmlns="http://www.w3.org/2000/svg">
                                        <path
                                            clipRule="evenodd"
                                            d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z"
                                            fill="currentColor"
                                            fillRule="evenodd"
                                        ></path>
                                    </svg>
                                </div>
                            )}
                        </div>
                        <h2 className="text-text-light-primary dark:text-text-dark-primary text-lg font-bold tracking-[-0.015em]">
                            {organizationName}
                        </h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onCartClick}
                            className="relative flex cursor-pointer items-center justify-center rounded-full h-10 w-10 bg-slate-100 dark:bg-slate-800 text-text-light-primary dark:text-text-dark-primary hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <span className="material-symbols-outlined text-xl">shopping_cart</span>
                            {cartItemCount > 0 && (
                                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                                    {cartItemCount > 9 ? '9+' : cartItemCount}
                                </span>
                            )}
                        </button>
                        <button className="flex cursor-pointer items-center justify-center rounded-full h-10 w-10 bg-slate-100 dark:bg-slate-800 text-text-light-primary dark:text-text-dark-primary hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                            <span className="material-symbols-outlined text-xl">notifications</span>
                        </button>
                        <div
                            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 bg-gray-200"
                        ></div>
                    </div>
                </header>
            )}

            <main className="flex flex-1 overflow-hidden">
                {/* Sidebar Left (Tabs: Para ti / Historial) */}
                {showHistory && (
                    <aside className="w-72 flex flex-col border-r border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shrink-0 hidden md:flex">
                        {/* Tab Header */}
                        <div className="p-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">
                            <h3 className="font-bold text-text-light-primary dark:text-text-dark-primary">
                                {activeTab === 'para-ti' ? 'Para ti' : 'Historial'}
                            </h3>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setActiveTab('para-ti')}
                                    className={cn(
                                        "flex items-center justify-center size-8 rounded-lg transition-colors",
                                        activeTab === 'para-ti'
                                            ? "bg-primary/20 text-primary"
                                            : "text-text-light-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800"
                                    )}
                                    title="Para ti"
                                >
                                    <span className="material-symbols-outlined text-xl" style={activeTab === 'para-ti' ? { fontVariationSettings: "'FILL' 1" } : {}}>lightbulb</span>
                                </button>
                                <div className="w-px h-5 bg-border-light dark:bg-border-dark mx-1"></div>
                                <button
                                    onClick={() => setActiveTab('historial')}
                                    className={cn(
                                        "flex items-center justify-center size-8 rounded-lg transition-colors",
                                        activeTab === 'historial'
                                            ? "bg-primary/20 text-primary"
                                            : "text-text-light-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800"
                                    )}
                                    title="Historial"
                                >
                                    <span className="material-symbols-outlined text-xl" style={activeTab === 'historial' ? { fontVariationSettings: "'FILL' 1" } : {}}>history</span>
                                </button>
                            </div>
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {activeTab === 'para-ti' ? (
                                <>
                                    {/* Active Context Products - Living Sidebar */}
                                    {activeProducts.length > 0 && (
                                        <section>
                                            <h4 className="text-sm font-bold text-text-light-primary dark:text-text-dark-primary mb-3 flex items-center gap-2">
                                                <span className="size-2 rounded-full bg-green-500 animate-pulse"></span>
                                                En conversación
                                            </h4>
                                            <div className="space-y-3">
                                                {activeProducts.map((prod) => (
                                                    <div key={prod.id} className="flex gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                                        <div 
                                                            className="size-12 rounded-md bg-cover bg-center shrink-0 border border-slate-200 dark:border-slate-700"
                                                            style={{ backgroundImage: `url("${prod.image_url}")` }}
                                                        />
                                                        <div className="flex flex-col justify-center min-w-0">
                                                            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                                                {prod.name}
                                                            </p>
                                                            <p className="text-xs text-primary font-bold">
                                                                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(prod.price)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {/* Agent Recommendations */}
                                    <section>
                                        <h4 className="text-sm font-bold text-text-light-primary dark:text-text-dark-primary mb-3">Recomendaciones del Agente</h4>
                                        <div className="flex space-x-3 overflow-x-auto pb-2 -mx-4 px-4">
                                            {/* Placeholder recommendations - will be dynamic later */}
                                            <div className="flex-shrink-0 w-32">
                                                <div className="bg-gray-100 dark:bg-gray-800 aspect-square rounded-lg flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-3xl text-gray-400">inventory_2</span>
                                                </div>
                                                <div className="mt-2">
                                                    <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                                        Pregunta por productos y te haré recomendaciones personalizadas
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Active Offers */}
                                    <section>
                                        <h4 className="text-sm font-bold text-text-light-primary dark:text-text-dark-primary mb-3">Ofertas Activas</h4>
                                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                                            <p className="text-sm font-semibold text-primary">¡Envío gratis en pedidos superiores a $120.000!</p>
                                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Aplica automáticamente en tu carrito.</p>
                                        </div>
                                    </section>

                                    {/* FAQ */}
                                    <section>
                                        <h4 className="text-sm font-bold text-text-light-primary dark:text-text-dark-primary mb-3">Preguntas Frecuentes</h4>
                                        <ul className="space-y-2 text-sm">
                                            <li>
                                                <button className="text-left text-text-light-secondary dark:text-text-dark-secondary hover:text-primary dark:hover:text-white hover:underline">
                                                    ¿Cuánto tarda el envío?
                                                </button>
                                            </li>
                                            <li>
                                                <button className="text-left text-text-light-secondary dark:text-text-dark-secondary hover:text-primary dark:hover:text-white hover:underline">
                                                    ¿Cuál es su política de devoluciones?
                                                </button>
                                            </li>
                                            <li>
                                                <button className="text-left text-text-light-secondary dark:text-text-dark-secondary hover:text-primary dark:hover:text-white hover:underline">
                                                    ¿Cómo uso los productos?
                                                </button>
                                            </li>
                                        </ul>
                                    </section>
                                </>
                            ) : (
                                <>
                                    {/* Chat History */}
                                    <div className="space-y-1">
                                        {chatHistory.length === 0 ? (
                                            <div className="text-center text-sm text-text-light-secondary dark:text-text-dark-secondary p-4">
                                                No hay conversaciones anteriores
                                            </div>
                                        ) : (
                                            chatHistory.map((chat) => (
                                                <div
                                                    key={chat.id}
                                                    className={cn(
                                                        "p-3 rounded-lg cursor-pointer transition-colors group relative",
                                                        chat.id === currentChatId
                                                            ? "bg-primary/10 dark:bg-primary/20"
                                                            : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                                                    )}
                                                >
                                                    <div onClick={() => onChatSelect?.(chat.id)}>
                                                        <p className={cn(
                                                            "text-sm truncate pr-6",
                                                            chat.id === currentChatId
                                                                ? "font-semibold text-primary dark:text-white"
                                                                : "font-medium text-text-light-primary dark:text-text-dark-primary"
                                                        )}>
                                                            {chat.title}
                                                        </p>
                                                        <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                                            {formatDate(chat.updated_at || chat.created_at)}
                                                        </p>
                                                    </div>
                                                    {/* Delete button on hover */}
                                                    {onDeleteChat && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                onDeleteChat(chat.id)
                                                            }}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-text-light-secondary hover:text-red-500"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">delete</span>
                                                        </button>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* New Conversation Button */}
                        <div className="p-2 border-t border-border-light dark:border-border-dark">
                            <Button
                                variant="outline"
                                className="w-full justify-start gap-2 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
                                onClick={onNewConversation}
                            >
                                <span className="material-symbols-outlined text-lg">add</span>
                                <span>Nueva conversación</span>
                            </Button>
                        </div>
                    </aside>
                )}

                {/* Main Content Area - Now full width since cart is a modal */}
                <div className="flex flex-col flex-1 bg-background-light dark:bg-background-dark relative min-w-0">
                    {children}
                </div>
            </main>
        </div>
    )
}
