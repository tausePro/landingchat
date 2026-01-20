"use client"

import { FAQContent } from "@/types/page-content"
import { useState } from "react"

interface FAQTemplateProps {
    content: FAQContent
    organizationSlug: string
    primaryColor?: string
    whatsappNumber?: string
}

export function FAQTemplate({ content, organizationSlug, primaryColor = '#2563EB', whatsappNumber: globalWhatsapp }: FAQTemplateProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [activeCategory, setActiveCategory] = useState<string>(content.categories?.[0]?.id || "todos")

    const whatsappToUse = content.cta?.whatsappNumber || globalWhatsapp

    const filteredQuestions = content.questions.filter(q => {
        const matchesSearch = !searchQuery ||
            q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            q.answer.toLowerCase().includes(searchQuery.toLowerCase())

        const matchesCategory = activeCategory === "todos" ||
            !q.category ||
            q.category === activeCategory

        return matchesSearch && matchesCategory
    })

    return (
        <main className="flex-1 flex flex-col items-center py-10 px-4">
            {/* Main Container Card */}
            <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                {/* Page Heading & Search */}
                <div className="p-8 border-b border-gray-50 dark:border-gray-800">
                    <h1 className="text-gray-900 dark:text-white text-4xl font-black leading-tight tracking-tight mb-6">
                        {content.title}
                    </h1>
                    {content.searchPlaceholder && (
                        <div className="relative w-full">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <span className="material-symbols-outlined text-gray-400">search</span>
                            </div>
                            <input
                                className="block w-full pl-11 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-primary/50 text-base"
                                placeholder={content.searchPlaceholder}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    )}
                </div>

                {/* Categories Filter */}
                {content.categories && content.categories.length > 0 && (
                    <div className="px-8 py-4 flex gap-3 overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setActiveCategory("todos")}
                            className={`flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full px-6 transition-colors ${activeCategory !== "todos"
                                ? "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                : "text-white"
                                }`}
                            style={activeCategory === "todos" ? { backgroundColor: primaryColor } : {}}
                        >
                            <p className="text-sm font-semibold">Todos</p>
                        </button>
                        {content.categories.map((category) => (
                            <button
                                key={category.id}
                                onClick={() => setActiveCategory(category.id)}
                                className={`flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full px-6 transition-colors ${activeCategory !== category.id
                                    ? "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    : "text-white"
                                    }`}
                                style={activeCategory === category.id ? { backgroundColor: primaryColor } : {}}
                            >
                                <p className="text-sm font-medium">{category.name}</p>
                            </button>
                        ))}
                    </div>
                )}

                {/* FAQ Accordion */}
                <div className="px-4 pb-4">
                    <div className="flex flex-col">
                        {filteredQuestions.map((item, index) => (
                            <details
                                key={item.id || index}
                                className="group border-b border-gray-100 dark:border-gray-800 transition-all duration-200"
                            >
                                <summary className="flex cursor-pointer items-center justify-between gap-6 px-4 py-5 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                                    <p className="text-gray-900 dark:text-gray-100 text-base font-medium leading-normal">
                                        {item.question}
                                    </p>
                                    <span className="material-symbols-outlined text-gray-400 group-open:rotate-180 transition-transform">
                                        expand_more
                                    </span>
                                </summary>
                                <div className="bg-blue-50/50 dark:bg-primary/5 px-4 py-4 rounded-lg mx-2 mb-4">
                                    <div
                                        className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed prose prose-sm max-w-none"
                                        dangerouslySetInnerHTML={{ __html: item.answer }}
                                    />
                                </div>
                            </details>
                        ))}
                    </div>
                </div>

                {/* Conversational CTA Section */}
                {content.cta && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-8 flex flex-col items-center text-center gap-4">
                        <div className="bg-white dark:bg-gray-900 p-3 rounded-full shadow-sm mb-2">
                            <span className="material-symbols-outlined text-3xl" style={{ color: primaryColor }}>support_agent</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <h3 className="text-gray-900 dark:text-white text-lg font-bold">
                                {content.cta.title}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                {content.cta.description}
                            </p>
                        </div>
                        <a
                            href={whatsappToUse ? `https://wa.me/${whatsappToUse.replace(/\D/g, '')}` : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 flex items-center gap-2 text-white font-bold py-3 px-8 rounded-xl transition-all transform active:scale-95 shadow-lg"
                            style={{ backgroundColor: primaryColor, boxShadow: `0 10px 15px -3px ${primaryColor}33, 0 4px 6px -4px ${primaryColor}33` }}
                        >
                            <span className="material-symbols-outlined text-xl">forum</span>
                            <span>{content.cta.buttonText}</span>
                        </a>
                    </div>
                )}
            </div>

            {/* Footer Link */}
            <div className="mt-8 flex justify-center">
                <a
                    className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors font-medium text-sm group"
                    href="/"
                >
                    <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">
                        arrow_back
                    </span>
                    Volver a la tienda
                </a>
            </div>
        </main>
    )
}
