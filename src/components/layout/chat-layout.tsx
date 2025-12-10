"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface ChatLayoutProps {
    children: React.ReactNode
    rightSidebar?: React.ReactNode
    organizationName?: string
    logoUrl?: string
    showHistory?: boolean
}

export function ChatLayout({
    children,
    rightSidebar,
    organizationName = "LandingChat",
    logoUrl,
    showHistory = true
}: ChatLayoutProps) {
    return (
        <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background-light dark:bg-background-dark">
            {/* Header */}
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
                    <button className="relative flex cursor-pointer items-center justify-center rounded-full h-10 w-10 bg-slate-100 dark:bg-slate-800 text-text-light-primary dark:text-text-dark-primary hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <span className="material-symbols-outlined text-xl">shopping_cart</span>
                        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                            2
                        </span>
                    </button>
                    <button className="flex cursor-pointer items-center justify-center rounded-full h-10 w-10 bg-slate-100 dark:bg-slate-800 text-text-light-primary dark:text-text-dark-primary hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <span className="material-symbols-outlined text-xl">notifications</span>
                    </button>
                    <div
                        className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10"
                        style={{
                            backgroundImage:
                                'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDmmm9RczVmjBXMiKdkm5pvg1NEelwdSnGZI5XTDSWhTKMukD8Sn8PLtiW7E_bI3Bib79WS_BldOGal6XNZNUt71QYQ-qN8UpXenXXe5EN9AL-06-wJbS_qhZNgQnYXoyrfJgWvx-4Ghyfu67NO1jrcQ36On8CoinRere-8phyVBbNeyNAL7xLP1wwLq1FYV78ZHR0-CKQ2e_-I4Ph2p1CrPeMMtuPZNjIcyK9pF1VWbe81S15u9zLsjRPoK7DTFcmkPgMWqlEo0M8")',
                        }}
                    ></div>
                </div>
            </header>

            <main className="flex flex-1 overflow-hidden">
                {/* Sidebar Left (History) */}
                {showHistory && (
                    <aside className="w-80 flex flex-col border-r border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shrink-0 hidden md:flex">
                        <div className="p-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">
                            <h3 className="font-bold text-text-light-primary dark:text-text-dark-primary">
                                Historial
                            </h3>
                            <button className="text-text-light-secondary dark:text-text-dark-secondary hover:text-primary dark:hover:text-primary">
                                <span className="material-symbols-outlined text-xl">search</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {/* Mock History Items (for now) */}
                            <div className="p-3 rounded-lg bg-primary/10 dark:bg-primary/20 cursor-pointer">
                                <p className="font-semibold text-sm text-primary dark:text-white truncate">
                                    Búsqueda de zapatillas...
                                </p>
                                <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                    Hoy, 10:30 AM
                                </p>
                            </div>
                            <div className="p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                                <p className="font-medium text-sm text-text-light-primary dark:text-text-dark-primary truncate">
                                    Consulta sobre mi pedido
                                </p>
                                <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                    Ayer, 4:15 PM
                                </p>
                            </div>
                        </div>
                        <div className="p-4 border-t border-border-light dark:border-border-dark">
                            <Button variant="outline" className="w-full justify-start gap-2 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800">
                                <span className="material-symbols-outlined text-lg">add</span>
                                <span>Nueva conversación</span>
                            </Button>
                        </div>
                    </aside>
                )}

                {/* Main Content Area */}
                <div className="flex flex-col flex-1 bg-background-light dark:bg-background-dark relative min-w-0">
                    {children}
                </div>

                {/* Right Sidebar (Cart/Details) */}
                {rightSidebar && (
                    <aside className="w-96 flex flex-col border-l border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shrink-0 hidden lg:flex">
                        {rightSidebar}
                    </aside>
                )}
            </main>
        </div>
    )
}
