import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

export default async function LandingPage() {
    const supabase = await createClient()

    // Check maintenance mode
    const { data: maintenanceSetting } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .single()

    const maintenanceMode = maintenanceSetting?.value as { isActive: boolean, message: string } | undefined

    if (maintenanceMode?.isActive) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background-light dark:bg-background-dark p-4 text-center">
                <div className="mb-8 flex size-20 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400">
                    <svg className="size-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                </div>
                <h1 className="mb-4 text-3xl font-bold text-slate-900 dark:text-white">Mantenimiento Programado</h1>
                <p className="mb-8 max-w-md text-slate-600 dark:text-slate-400">
                    {maintenanceMode.message || "Estamos realizando mejoras en nuestra plataforma. Volveremos en breve."}
                </p>
                <div className="flex gap-4">
                    <Link href="/login">
                        <Button variant="outline">Acceso Admin</Button>
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="relative flex w-full flex-col group/design-root overflow-x-hidden">
            <div className="layout-container flex h-full grow flex-col">
                <header className="sticky top-0 z-50 flex items-center justify-center bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 px-4 sm:px-10 py-3 w-full max-w-7xl">
                        <div className="flex items-center gap-4 text-slate-900 dark:text-white">
                            <div className="size-6 text-primary">
                                <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                    <path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fill="currentColor" fillRule="evenodd"></path>
                                </svg>
                            </div>
                            <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">LandingChat</h2>
                        </div>
                        <div className="hidden md:flex flex-1 justify-end gap-8">
                            <nav className="flex items-center gap-9">
                                <Link className="text-sm font-medium leading-normal text-slate-700 dark:text-slate-300 hover:text-primary dark:hover:text-primary" href="#">Características</Link>
                                <Link className="text-sm font-medium leading-normal text-slate-700 dark:text-slate-300 hover:text-primary dark:hover:text-primary" href="#">Precios</Link>
                                <Link className="text-sm font-medium leading-normal text-slate-700 dark:text-slate-300 hover:text-primary dark:hover:text-primary" href="#">Sobre nosotros</Link>
                            </nav>
                            <Link href="/registro">
                                <Button className="h-10 px-4 text-sm font-bold">
                                    <span className="truncate">Iniciar Sesión / Registrarse</span>
                                </Button>
                            </Link>
                        </div>
                    </div>
                </header>
                <main className="flex flex-col items-center px-4 sm:px-10 py-5">
                    <div className="flex flex-col w-full max-w-5xl">
                        <section className="py-16 sm:py-24">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                                <div className="flex flex-col gap-6 text-left">
                                    <h1 className="text-4xl font-black leading-tight tracking-[-0.033em] text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
                                        Crea Tu ChatCommerce: <br className="hidden lg:block" />
                                        <span className="text-primary">El Futuro de las Ventas</span>
                                    </h1>
                                    <p className="text-base font-normal leading-normal text-slate-600 dark:text-slate-400 sm:text-lg">
                                        Diseña y lanza tu propia experiencia de comercio conversacional, potenciando tus ventas directamente desde el chat.
                                    </p>
                                    <div className="flex flex-wrap gap-3 mt-4">
                                        <Link href="/registro">
                                            <Button className="h-12 px-5 text-base font-bold">
                                                <span className="truncate">Crea Tu ChatCommerce Gratis</span>
                                            </Button>
                                        </Link>
                                        <Button variant="secondary" className="h-12 px-5 text-base font-bold bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-50 hover:bg-slate-300 dark:hover:bg-slate-700">
                                            <span className="truncate">Explorar la Plataforma</span>
                                        </Button>
                                    </div>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-800 aspect-square bg-cover rounded-xl overflow-hidden">
                                    <img alt="Una persona usando un smartphone para comprar en línea, representando el comercio conversacional." className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAhUyZo8qfoQ0DY7_YII5kRdCDtH91HtAqiq3yKy5EQ2000acK9v-IlR0DZ6BYb_hGnpfZLFYDWPxmqZvLV8jgz61etqswcrXvy1z6QbQ1c8krcVcY8hmwr7s-XJFkpz0XLupWu1bot75qz6ejq_oM4BxhqtiDmuKUumRgaKG1R_KNEqoIXaDHPGe43_jzH2JyKQutv2cfRWE7IcxLbJcJqZkjB7ycRYW81b3I--fjg4jKVpjsOtJwZBAkgBRkJa83tacZ0MJS8cpM" />
                                </div>
                            </div>
                        </section>
                        <section className="py-16 sm:py-24">
                            <div className="flex flex-col gap-10">
                                <div className="flex flex-col gap-4 text-center">
                                    <h2 className="text-3xl font-bold leading-tight tracking-[-0.015em] text-slate-900 dark:text-white sm:text-4xl">La solución integral para tu propio ChatCommerce</h2>
                                    <p className="text-base font-normal leading-normal max-w-3xl mx-auto text-slate-600 dark:text-slate-400 sm:text-lg">Nuestra plataforma SaaS te permite integrar el poder del comercio electrónico y la mensajería instantánea para ofrecer a tus clientes una experiencia de compra conversacional única y personalizada.</p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div className="flex flex-1 flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-background-light dark:bg-slate-900/50 p-6">
                                        <div className="flex items-center justify-center size-12 rounded-lg bg-primary/10 text-primary">
                                            <span className="material-symbols-outlined text-3xl">chat_bubble</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">Asistente de Ventas IA Personalizado</h3>
                                            <p className="text-sm font-normal leading-normal text-slate-600 dark:text-slate-400">Implementa un asistente de chat con IA que guía a tus clientes y ofrece recomendaciones de productos a medida.</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-1 flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-background-light dark:bg-slate-900/50 p-6">
                                        <div className="flex items-center justify-center size-12 rounded-lg bg-primary/10 text-primary">
                                            <span className="material-symbols-outlined text-3xl">view_carousel</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">Catálogos de Productos Interactivos</h3>
                                            <p className="text-sm font-normal leading-normal text-slate-600 dark:text-slate-400">Permite a tus clientes explorar tus productos y colecciones directamente a través de carruseles en el chat.</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-1 flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-background-light dark:bg-slate-900/50 p-6">
                                        <div className="flex items-center justify-center size-12 rounded-lg bg-primary/10 text-primary">
                                            <span className="material-symbols-outlined text-3xl">credit_card</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">Procesamiento de Pagos Seguro</h3>
                                            <p className="text-sm font-normal leading-normal text-slate-600 dark:text-slate-400">Ofrece a tus clientes un checkout rápido y seguro directamente dentro de la conversación del chat.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                        <section className="py-16 sm:py-24">
                            <div className="flex flex-col gap-12 items-center">
                                <h2 className="text-3xl font-bold leading-tight tracking-[-0.015em] text-center text-slate-900 dark:text-white sm:text-4xl">Crea tu ChatCommerce en 3 Simples Pasos</h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 w-full">
                                    <div className="flex flex-col sm:flex-row md:flex-col items-center gap-4 text-center">
                                        <div className="flex items-center justify-center size-16 rounded-full border-2 border-primary text-primary text-2xl font-bold bg-primary/10">1</div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">Regístrate y Configura</h3>
                                            <p className="text-sm font-normal leading-normal text-slate-600 dark:text-slate-400">Crea tu cuenta, importa tu catálogo de productos y personaliza tu asistente de chat.</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row md:flex-col items-center gap-4 text-center">
                                        <div className="flex items-center justify-center size-16 rounded-full border-2 border-primary text-primary text-2xl font-bold bg-primary/10">2</div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">Integra en tu Web</h3>
                                            <p className="text-sm font-normal leading-normal text-slate-600 dark:text-slate-400">Añade fácilmente el widget de chat a tu sitio web o canal de ventas con unas pocas líneas de código.</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row md:flex-col items-center gap-4 text-center">
                                        <div className="flex items-center justify-center size-16 rounded-full border-2 border-primary text-primary text-2xl font-bold bg-primary/10">3</div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">Empieza a Vender por Chat</h3>
                                            <p className="text-sm font-normal leading-normal text-slate-600 dark:text-slate-400">Observa cómo tus clientes interactúan, reciben recomendaciones y compran directamente en el chat.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                        <section className="py-16 sm:py-24">
                            <div className="bg-primary/10 dark:bg-primary/20 rounded-xl p-8 sm:p-16 text-center">
                                <div className="flex flex-col gap-6 items-center">
                                    <h2 className="text-3xl font-bold leading-tight tracking-[-0.015em] text-slate-900 dark:text-white sm:text-4xl">¿Listo para crear tu propio ChatCommerce?</h2>
                                    <p className="text-base font-normal leading-normal max-w-2xl text-slate-600 dark:text-slate-300 sm:text-lg">Únete a LandingChat hoy y transforma tu estrategia de ventas. Es rápido, personal y la nueva forma de conectar con tus clientes.</p>
                                    <Link href="/dashboard">
                                        <Button className="h-12 px-5 text-base font-bold mt-2">
                                            <span className="truncate">Empieza Gratis</span>
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </section>
                    </div>
                </main>
                <footer className="flex justify-center border-t border-slate-200 dark:border-slate-800 px-4 sm:px-10 py-8 bg-slate-100 dark:bg-slate-900">
                    <div className="w-full max-w-7xl">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="size-6 text-primary">
                                        <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                            <path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fill="currentColor" fillRule="evenodd"></path>
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">LandingChat</h2>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400">El futuro de las compras es una conversación.</p>
                            </div>
                            <div className="flex flex-col gap-4">
                                <h3 className="font-semibold text-slate-900 dark:text-white">Empresa</h3>
                                <Link className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary" href="#">Sobre nosotros</Link>
                                <Link className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary" href="#">Características</Link>
                                <Link className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary" href="#">Precios</Link>
                                <Link className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary" href="#">Empleo</Link>
                            </div>
                            <div className="flex flex-col gap-4">
                                <h3 className="font-semibold text-slate-900 dark:text-white">Recursos</h3>
                                <Link className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary" href="#">Centro de Ayuda</Link>
                                <Link className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary" href="#">Contáctanos</Link>
                                <Link className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary" href="#">Política de Privacidad</Link>
                                <Link className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary" href="#">Términos de Servicio</Link>
                            </div>
                            <div className="flex flex-col gap-4">
                                <h3 className="font-semibold text-slate-900 dark:text-white">Síguenos</h3>
                                <div className="flex gap-4">
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
                            <p>© {new Date().getFullYear()} LandingChat. Todos los derechos reservados.</p>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    )
}
