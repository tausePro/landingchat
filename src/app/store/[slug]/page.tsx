import { getStoreData } from "./actions"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

// Components
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const data = await getStoreData(slug)

    if (!data) {
        return notFound()
    }

    const { organization, products } = data
    const primaryColor = organization.settings?.branding?.primaryColor || "#2b7cee"

    return (
        <div className="min-h-screen bg-white font-sans text-slate-900">
            {/* --- Header --- */}
            <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
                <div className="container mx-auto flex h-16 items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                        {organization.logo_url ? (
                            <img src={organization.logo_url} alt={organization.name} className="h-8 w-auto object-contain" />
                        ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold">
                                {organization.name.substring(0, 1)}
                            </div>
                        )}
                        <span className="text-lg font-bold tracking-tight">{organization.name}</span>
                    </div>
                    <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
                        <a href="#how-it-works" className="hover:text-primary transition-colors">Cómo funciona</a>
                        <a href="#products" className="hover:text-primary transition-colors">Productos</a>
                    </nav>
                    <div className="flex items-center gap-4">
                        <Link href={`/chat/${slug}`}>
                            <Button style={{ backgroundColor: primaryColor }} className="font-bold shadow-lg shadow-blue-500/20">
                                Iniciar Chat
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main>
                {/* --- Hero Section --- */}
                <section className="relative overflow-hidden pt-16 pb-24 lg:pt-32 lg:pb-40">
                    <div className="container mx-auto px-4">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            {/* Text Content */}
                            <div className="max-w-2xl">
                                <Badge variant="outline" className="mb-6 px-3 py-1 text-sm border-blue-200 bg-blue-50 text-blue-700">
                                    ✨ El futuro del e-commerce
                                </Badge>
                                <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl mb-6 leading-[1.1]">
                                    Encuentra tu producto ideal, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">chateando</span>.
                                </h1>
                                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                                    Sin buscar, sin filtros, solo conversación. Nuestro asistente de IA te ayuda a encontrar exactamente lo que necesitas en segundos.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <Link href={`/chat/${slug}`}>
                                        <Button size="lg" style={{ backgroundColor: primaryColor }} className="w-full sm:w-auto text-base px-8 h-14 shadow-xl shadow-blue-600/20 hover:scale-105 transition-transform">
                                            Chatear para Comprar
                                        </Button>
                                    </Link>
                                    <Button variant="outline" size="lg" className="w-full sm:w-auto text-base h-14">
                                        Ver Demo
                                    </Button>
                                </div>
                                <div className="mt-10 flex items-center gap-4 text-sm text-slate-500">
                                    <div className="flex -space-x-2">
                                        {[1, 2, 3, 4].map((i) => (
                                            <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200" />
                                        ))}
                                    </div>
                                    <p>+1,000 compras realizadas hoy</p>
                                </div>
                            </div>

                            {/* Chat Mockup Animation */}
                            <div className="relative mx-auto w-full max-w-[400px] lg:max-w-none">
                                <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform rotate-2 hover:rotate-0 transition-transform duration-500">
                                    {/* Mockup Header */}
                                    <div className="bg-slate-50 border-b p-4 flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-red-400" />
                                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                                        <div className="w-3 h-3 rounded-full bg-green-400" />
                                        <div className="ml-auto text-xs text-slate-400">LandingChat AI</div>
                                    </div>
                                    {/* Mockup Body */}
                                    <div className="p-6 space-y-4 bg-slate-50/50 h-[400px] flex flex-col">
                                        {/* Message 1 (User) */}
                                        <div className="flex justify-end animate-in slide-in-from-bottom-4 fade-in duration-700 delay-100 fill-mode-forwards opacity-0" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
                                            <div className="bg-blue-600 text-white px-4 py-2 rounded-2xl rounded-tr-sm max-w-[80%] shadow-sm">
                                                Busco unos audífonos con buena cancelación de ruido para la oficina.
                                            </div>
                                        </div>
                                        {/* Message 2 (Bot) */}
                                        <div className="flex justify-start animate-in slide-in-from-bottom-4 fade-in duration-700 delay-1000 fill-mode-forwards opacity-0" style={{ animationDelay: '1.5s', animationFillMode: 'forwards' }}>
                                            <div className="bg-white border border-slate-200 text-slate-800 px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%] shadow-sm space-y-2">
                                                <p>¡Tengo justo lo que necesitas! Los <strong>Sony WH-1000XM5</strong> son los líderes en cancelación de ruido.</p>
                                                <div className="flex gap-2 mt-2">
                                                    <div className="w-16 h-16 bg-slate-100 rounded-lg shrink-0" />
                                                    <div className="text-xs">
                                                        <div className="font-bold">Sony WH-1000XM5</div>
                                                        <div className="text-slate-500">$348.00</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Message 3 (User) */}
                                        <div className="flex justify-end animate-in slide-in-from-bottom-4 fade-in duration-700 delay-2000 fill-mode-forwards opacity-0" style={{ animationDelay: '3s', animationFillMode: 'forwards' }}>
                                            <div className="bg-blue-600 text-white px-4 py-2 rounded-2xl rounded-tr-sm max-w-[80%] shadow-sm">
                                                ¡Se ven geniales! ¿Tienen envío rápido?
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* Decorative Elements */}
                                <div className="absolute -top-10 -right-10 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl" />
                                <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-purple-400/20 rounded-full blur-3xl" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- How it Works --- */}
                <section id="how-it-works" className="py-24 bg-slate-50">
                    <div className="container mx-auto px-4">
                        <div className="text-center max-w-2xl mx-auto mb-16">
                            <h2 className="text-3xl font-bold tracking-tight mb-4">Compra en 3 simples pasos</h2>
                            <p className="text-slate-600">Olvídate de navegar por cientos de páginas. Tu asistente personal hace el trabajo pesado por ti.</p>
                        </div>
                        <div className="grid md:grid-cols-3 gap-8">
                            {[
                                { icon: "💬", title: "Cuéntanos qué buscas", desc: "Simplemente escribe lo que necesitas, como si hablaras con un amigo." },
                                { icon: "🤖", title: "Recibe recomendaciones", desc: "Nuestra IA analiza tus gustos y te muestra las mejores opciones al instante." },
                                { icon: "🛍️", title: "Compra sin salir", desc: "Realiza el pago de forma segura directamente en el chat. ¡Listo!" }
                            ].map((step, i) => (
                                <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center hover:shadow-md transition-shadow">
                                    <div className="text-4xl mb-6">{step.icon}</div>
                                    <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                                    <p className="text-slate-600 leading-relaxed">{step.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* --- Featured Products --- */}
                <section id="products" className="py-24">
                    <div className="container mx-auto px-4">
                        <div className="flex items-center justify-between mb-12">
                            <h2 className="text-3xl font-bold tracking-tight">Destacados</h2>
                            <Link href={`/chat/${slug}`} className="text-primary font-medium hover:underline">
                                Ver todo en el chat →
                            </Link>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {products.map((product) => (
                                <div key={product.id} className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300">
                                    <div className="aspect-square bg-slate-100 relative overflow-hidden">
                                        {product.image_url ? (
                                            <img src={product.image_url} alt={product.name} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-slate-300">Sin imagen</div>
                                        )}
                                        <div className="absolute top-3 left-3">
                                            <Badge className="bg-white/90 text-slate-900 hover:bg-white shadow-sm backdrop-blur-sm">
                                                🤖 Recomendado IA
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-bold text-slate-900 mb-1 truncate">{product.name}</h3>
                                        <p className="text-slate-500 text-sm mb-4 line-clamp-2">{product.description}</p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-lg font-bold text-slate-900">${product.price}</span>
                                            <Link href={`/chat/${slug}?product=${product.id}`}>
                                                <Button size="sm" variant="outline" className="rounded-full hover:bg-primary hover:text-white hover:border-primary transition-colors">
                                                    Ver
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* --- Social Proof / Metrics --- */}
                <section className="py-20 bg-slate-900 text-white">
                    <div className="container mx-auto px-4">
                        <div className="grid md:grid-cols-3 gap-12 text-center">
                            <div>
                                <div className="text-4xl font-black text-blue-400 mb-2">3 min</div>
                                <div className="text-slate-400 font-medium">Tiempo promedio de compra</div>
                            </div>
                            <div>
                                <div className="text-4xl font-black text-purple-400 mb-2">95%</div>
                                <div className="text-slate-400 font-medium">Satisfacción en recomendaciones</div>
                            </div>
                            <div>
                                <div className="text-4xl font-black text-green-400 mb-2">24/7</div>
                                <div className="text-slate-400 font-medium">Atención inmediata</div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* --- Footer --- */}
            <footer className="bg-slate-50 border-t border-slate-200 py-12">
                <div className="container mx-auto px-4 text-center text-slate-500 text-sm">
                    <p className="mb-4">© 2025 {organization.name}. Todos los derechos reservados.</p>
                    <div className="flex justify-center gap-6">
                        <a href="#" className="hover:text-slate-900">Privacidad</a>
                        <a href="#" className="hover:text-slate-900">Términos</a>
                        <a href="#" className="hover:text-slate-900">Contacto</a>
                    </div>
                </div>
            </footer>
        </div>
    )
}
