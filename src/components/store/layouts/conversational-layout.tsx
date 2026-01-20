"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface ConversationalLayoutProps {
    children: React.ReactNode
    chatPanel: React.ReactNode
    productTray?: React.ReactNode
    className?: string
}

export function ConversationalLayout({
    children,
    chatPanel,
    productTray,
    className
}: ConversationalLayoutProps) {
    return (
        <div className={cn("flex h-[100dvh] w-full overflow-hidden bg-background-light dark:bg-background-dark", className)}>
            {/* Left Panel: Catalog / Content */}
            {/* Hidden on Mobile (Chat First), 60% on Desktop */}
            <div className="hidden lg:block flex-1 h-full overflow-y-auto overflow-x-hidden relative scrollbar-thin">
                {children}
            </div>

            {/* Right Panel: Persistent Chat */}
            {/* Full width on Mobile, Fixed sidebar on Desktop */}
            <aside className="w-full lg:w-[400px] xl:w-[450px] shrink-0 flex flex-col border-l border-border-light dark:border-border-dark bg-white dark:bg-gray-950 shadow-xl z-20 pb-[100px] lg:pb-0">
                {chatPanel}
            </aside>

            {/* Mobile Product Tray - Sticky Bottom */}
            {productTray && (
                <div className="lg:hidden fixed bottom-0 left-0 w-full z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
                    {productTray}
                </div>
            )}
        </div>
    )
}
