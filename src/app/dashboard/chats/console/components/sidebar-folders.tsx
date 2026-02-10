"use client"

import { cn } from "@/lib/utils"
import {
    Inbox,
    MessageCircle,
    Clock,
    CheckCircle2,
    Smartphone,
    Globe,
} from "lucide-react"

interface SidebarFoldersProps {
    counts: {
        all: number
        active: number
        pending: number
        closed: number
        whatsapp: number
        web: number
    }
    activeFolder: string
    activeChannel?: string
    onFolderChange: (folder: string) => void
    onChannelChange: (channel?: string) => void
}

const FOLDERS = [
    { id: "all", label: "Todas", icon: Inbox, countKey: "all" as const },
    { id: "active", label: "Activas", icon: MessageCircle, countKey: "active" as const },
    { id: "pending", label: "Pendientes", icon: Clock, countKey: "pending" as const },
    { id: "closed", label: "Resueltas", icon: CheckCircle2, countKey: "closed" as const },
]

const CHANNELS = [
    { id: "whatsapp", label: "WhatsApp", icon: Smartphone, countKey: "whatsapp" as const },
    { id: "web", label: "Web Chat", icon: Globe, countKey: "web" as const },
]

export function SidebarFolders({
    counts,
    activeFolder,
    activeChannel,
    onFolderChange,
    onChannelChange,
}: SidebarFoldersProps) {
    return (
        <div className="flex-1 overflow-y-auto p-3 space-y-6">
            {/* Carpetas por estado */}
            <div>
                <p className="text-xs font-semibold text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-wider px-2 mb-2">
                    Conversaciones
                </p>
                <div className="space-y-0.5">
                    {FOLDERS.map((folder) => {
                        const Icon = folder.icon
                        const count = counts[folder.countKey]
                        const isActive = activeFolder === folder.id && !activeChannel

                        return (
                            <button
                                key={folder.id}
                                onClick={() => {
                                    onChannelChange(undefined)
                                    onFolderChange(folder.id)
                                }}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
                                    isActive
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-text-light-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800"
                                )}
                            >
                                <Icon className="size-4 flex-shrink-0" />
                                <span className="flex-1 text-left">{folder.label}</span>
                                {count > 0 && (
                                    <span className={cn(
                                        "text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                                        isActive
                                            ? "bg-primary/20 text-primary"
                                            : "bg-slate-200 dark:bg-slate-700 text-text-light-secondary dark:text-text-dark-secondary"
                                    )}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Filtro por canal */}
            <div>
                <p className="text-xs font-semibold text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-wider px-2 mb-2">
                    Canales
                </p>
                <div className="space-y-0.5">
                    {CHANNELS.map((channel) => {
                        const Icon = channel.icon
                        const count = counts[channel.countKey]
                        const isActive = activeChannel === channel.id

                        return (
                            <button
                                key={channel.id}
                                onClick={() => {
                                    if (isActive) {
                                        onChannelChange(undefined)
                                    } else {
                                        onChannelChange(channel.id)
                                    }
                                }}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
                                    isActive
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-text-light-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800"
                                )}
                            >
                                <Icon className="size-4 flex-shrink-0" />
                                <span className="flex-1 text-left">{channel.label}</span>
                                {count > 0 && (
                                    <span className={cn(
                                        "text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                                        isActive
                                            ? "bg-primary/20 text-primary"
                                            : "bg-slate-200 dark:bg-slate-700 text-text-light-secondary dark:text-text-dark-secondary"
                                    )}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
