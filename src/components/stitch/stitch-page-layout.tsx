"use client"

export function StitchFAQLayout({ content }: { content: string }) {
    return (
        <main className="flex-1 flex flex-col items-center py-10 px-4 bg-background-light dark:bg-background-dark">
            {/* Main Container Card */}
            <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                {/* Page Heading & Search */}
                <div className="p-8 border-b border-gray-50 dark:border-gray-800">
                    <h1 className="text-gray-900 dark:text-white text-4xl font-black leading-tight tracking-tight mb-6">
                        Preguntas Frecuentes
                    </h1>
                    <div className="relative w-full">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="material-symbols-outlined text-gray-400">search</span>
                        </div>
                        <input
                            className="block w-full pl-11 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-primary/50 text-base"
                            placeholder="¿En qué podemos ayudarte?"
                            type="text"
                        />
                    </div>
                </div>

                {/* Categories Filter */}
                <div className="px-8 py-4 flex gap-3 overflow-x-auto no-scrollbar">
                    <button className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full bg-primary px-6 transition-colors">
                        <p className="text-white text-sm font-semibold">General</p>
                    </button>
                    <button className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full bg-gray-50 dark:bg-gray-800 px-6 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">Mi Cuenta</p>
                    </button>
                    <button className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full bg-gray-50 dark:bg-gray-800 px-6 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">Pagos</p>
                    </button>
                    <button className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full bg-gray-50 dark:bg-gray-800 px-6 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">Devoluciones</p>
                    </button>
                    <button className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full bg-gray-50 dark:bg-gray-800 px-6 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">Envíos</p>
                    </button>
                </div>

                {/* FAQ Content - Direct HTML */}
                <div className="px-4 pb-4">
                    <div className="flex flex-col" dangerouslySetInnerHTML={{ __html: content }} />
                </div>

                {/* Conversational CTA Section */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-8 flex flex-col items-center text-center gap-4">
                    <div className="bg-white dark:bg-gray-900 p-3 rounded-full shadow-sm mb-2">
                        <span className="material-symbols-outlined text-primary text-3xl">support_agent</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <h3 className="text-gray-900 dark:text-white text-lg font-bold">
                            ¿No encontraste lo que buscabas?
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                            Nuestro equipo de soporte está disponible 24/7 para ayudarte.
                        </p>
                    </div>
                    <button className="mt-2 flex items-center gap-2 bg-primary hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-xl transition-all transform active:scale-95 shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined text-xl">forum</span>
                        <span>Chatear con un experto</span>
                    </button>
                </div>
            </div>

            {/* Footer Link */}
            <div className="mt-8 flex justify-center">
                <a className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors font-medium text-sm group" href="#">
                    <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">
                        arrow_back
                    </span>
                    Volver a la tienda
                </a>
            </div>
        </main>
    )
}
