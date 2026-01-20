"use client"

import { LegalContent } from "@/types/page-content"

interface LegalTemplateProps {
    content: LegalContent
    organizationSlug: string
    primaryColor?: string
}

export function LegalTemplate({ content, organizationSlug, primaryColor = '#2563EB' }: LegalTemplateProps) {
    return (
        <main className="max-w-[1200px] mx-auto px-6 py-10">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 mb-8 text-sm font-medium text-slate-500 dark:text-slate-400">
                <a className="hover:text-primary flex items-center gap-1" href={`/store/${organizationSlug}`}>
                    <span className="material-symbols-outlined text-lg">home</span>
                    Inicio
                </a>
                <span className="material-symbols-outlined text-sm">chevron_right</span>
                <span className="text-slate-900 dark:text-white">{content.title}</span>
            </nav>

            <div className="flex flex-col lg:flex-row gap-10">
                {/* Sidebar Navigation (Sticky) */}
                {content.sections.length > 0 && (
                    <aside className="hidden lg:block w-64 shrink-0">
                        <div className="sticky top-28 space-y-1">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-3">
                                Contenido
                            </p>
                            {content.sections.map((section, index) => (
                                <a
                                    key={section.id || index}
                                    href={`#section-${index + 1}`}
                                    className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                    {index + 1}. {section.title}
                                </a>
                            ))}

                            <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800">
                                <button
                                    onClick={() => window.print()}
                                    className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                                    Descargar en PDF
                                </button>
                            </div>
                        </div>
                    </aside>
                )}

                {/* Main Content Area */}
                <div className="flex-1 max-w-4xl">
                    {/* Page Heading */}
                    <div className="mb-8">
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-4 leading-tight">
                            {content.title}
                        </h1>
                        {content.lastUpdated && (
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                <span className="material-symbols-outlined text-lg">schedule</span>
                                <p className="text-base">
                                    Última actualización: {content.lastUpdated}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Content Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-lg border border-[#e2e8f0] dark:border-slate-800 shadow-sm overflow-hidden">
                        {/* Responsive Tabs (Mobile Only) */}
                        {content.sections.length > 0 && (
                            <div className="lg:hidden flex border-b border-[#e2e8f0] dark:border-slate-800 overflow-x-auto no-scrollbar">
                                {content.sections.slice(0, 3).map((section, index) => (
                                    <button
                                        key={index}
                                        className="px-6 py-4 text-sm font-medium text-slate-500 whitespace-nowrap"
                                    >
                                        {section.title}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="p-8 md:p-12 legal-content text-slate-700 dark:text-slate-300">
                            {/* Sections */}
                            {content.sections.map((section, index) => (
                                <section
                                    key={section.id || index}
                                    id={`section-${index + 1}`}
                                    className="scroll-mt-28 mb-12"
                                >
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                        <span className="flex items-center justify-center size-8 bg-slate-100 dark:bg-slate-800 rounded text-slate-900 dark:text-white text-sm">
                                            {index + 1}
                                        </span>
                                        {section.title}
                                    </h3>
                                    <div
                                        className="prose prose-slate dark:prose-invert max-w-none"
                                        dangerouslySetInnerHTML={{ __html: section.content }}
                                    />
                                </section>
                            ))}

                            {/* Footer Actions inside Card */}
                            <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
                                <a href={`/store/${organizationSlug}`}>
                                    <button
                                        className="w-full md:w-auto px-8 py-4 text-white rounded-lg font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2"
                                        style={{ backgroundColor: primaryColor }}
                                    >
                                        Aceptar y Volver a la Tienda
                                        <span className="material-symbols-outlined">arrow_forward</span>
                                    </button>
                                </a>
                                <button
                                    onClick={() => window.print()}
                                    className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-primary transition-colors"
                                >
                                    <span className="material-symbols-outlined text-xl">print</span>
                                    Imprimir este documento
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Mobile PDF Link */}
                    <div className="lg:hidden mt-8 text-center">
                        <button
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 bg-white dark:bg-slate-900 px-6 py-3 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm"
                        >
                            <span className="material-symbols-outlined text-lg" style={{ color: primaryColor }}>picture_as_pdf</span>
                            Descargar {content.title} en PDF
                        </button>
                    </div>

                    {/* Secondary Info */}
                    {/* footerNote removed - not in type definition */}
                </div>
            </div>
        </main>
    )
}
