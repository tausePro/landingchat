"use client"

import { useState } from "react"

interface LivePreviewProps {
    slug: string
}

export function LivePreview({ slug }: LivePreviewProps) {
    const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop")
    const [key, setKey] = useState(0)

    const handleRefresh = () => {
        setKey(prev => prev + 1)
    }

    return (
        <div className="sticky top-6 rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border-light dark:border-border-dark bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <div className="flex h-9 items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-800 p-1">
                        <button
                            onClick={() => setViewMode("desktop")}
                            className={`flex items-center justify-center gap-2 h-full px-3 rounded-md text-sm font-medium transition-colors ${viewMode === "desktop"
                                    ? "bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-gray-100"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                }`}
                        >
                            <span className="material-symbols-outlined !text-xl">desktop_windows</span>
                            <span>Desktop</span>
                        </button>
                        <button
                            onClick={() => setViewMode("mobile")}
                            className={`flex items-center justify-center gap-2 h-full px-3 rounded-md text-sm font-medium transition-colors ${viewMode === "mobile"
                                    ? "bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-gray-100"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                }`}
                        >
                            <span className="material-symbols-outlined !text-xl">smartphone</span>
                            <span>Móvil</span>
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 font-medium">
                        <div className="h-2 w-2 rounded-full bg-green-400"></div>
                        <span>Vista previa en vivo</span>
                    </div>
                    <button
                        onClick={handleRefresh}
                        className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                        title="Refrescar preview"
                    >
                        <span className="material-symbols-outlined !text-2xl">refresh</span>
                    </button>
                </div>
            </div>

            {/* Preview Area */}
            <div className="bg-gray-50 dark:bg-gray-900 p-8 flex items-center justify-center min-h-[600px]">
                <div
                    className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 ${viewMode === "desktop" ? "w-full max-w-5xl" : "w-full max-w-sm"
                        }`}
                >
                    {/* Browser Chrome */}
                    <div className="flex items-center h-10 px-4 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                            <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                        </div>
                    </div>

                    {/* Iframe */}
                    <div className={`${viewMode === "desktop" ? "h-[500px]" : "h-[600px]"} overflow-hidden`}>
                        <iframe
                            key={key}
                            src={`/store/${slug}`}
                            className="w-full h-full border-0"
                            title="Storefront Preview"
                        />
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-border-light dark:border-border-dark bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm">
                <div className="flex items-center gap-4 bg-gray-100 dark:bg-gray-800/50 p-2 rounded-lg">
                    <div className="text-gray-500 dark:text-gray-400 flex items-center justify-center shrink-0 size-7">
                        <span className="material-symbols-outlined !text-xl">link</span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 text-sm font-mono leading-normal flex-1 truncate">
                        landingchat.co/store/{slug}
                    </p>
                    <button
                        onClick={() => navigator.clipboard.writeText(`https://landingchat.co/store/${slug}`)}
                        className="flex items-center justify-center h-8 px-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                        <span className="truncate">Copiar</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
