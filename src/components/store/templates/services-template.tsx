import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Star, CheckCircle2, MessageSquare } from "lucide-react"

interface ServicesTemplateProps {
    organization: any
    products: any[]
    primaryColor: string
    heroSettings: any
    onStartChat: (productId?: string) => void
}

export function ServicesTemplate({
    organization,
    products,
    primaryColor,
    heroSettings,
    onStartChat
}: ServicesTemplateProps) {
    const heroTitle = heroSettings.title || "Soluciones profesionales a tu medida."
    const heroSubtitle = heroSettings.subtitle || "Expertos dedicados a impulsar tu éxito con servicios de alta calidad y atención personalizada."
    const heroBackgroundImage = heroSettings.backgroundImage || ""
    const showChatButton = heroSettings.showChatButton ?? true
    const chatButtonText = heroSettings.chatButtonText || "Agendar Consulta"

    const templateConfig = organization.settings?.storefront?.templateConfig?.services || {}
    const testimonials = templateConfig.testimonials || [
        { id: "1", title: "Cliente Verificado", description: "El servicio superó todas mis expectativas. La atención al detalle y la profesionalidad del equipo son inigualables." },
        { id: "2", title: "CEO, Tech Company", description: "Increíble experiencia de trabajo. Altamente recomendados para cualquier proyecto serio." }
    ]

    return (
        <>
            {/* Hero Section - Services */}
            <section
                className="relative overflow-hidden pt-20 pb-32 lg:pt-40 lg:pb-52 bg-slate-900 text-white"
                style={{
                    backgroundImage: heroBackgroundImage ? `url(${heroBackgroundImage})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            >
                <div className={`absolute inset-0 ${heroBackgroundImage ? 'bg-slate-900/80' : 'bg-slate-900'}`} />

                {/* Decorative gradients */}
                {!heroBackgroundImage && (
                    <>
                        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-900/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 w-1/2 h-full bg-gradient-to-tr from-purple-900/20 to-transparent" />
                    </>
                )}

                <div className="container mx-auto px-4 relative z-10 text-center">
                    <Badge variant="outline" className="mb-8 px-4 py-1.5 text-sm border-white/20 bg-white/10 text-white backdrop-blur-sm">
                        🚀 Servicios Profesionales
                    </Badge>
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-8 tracking-tight max-w-4xl mx-auto leading-tight">
                        {heroTitle}
                    </h1>
                    <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-2xl mx-auto leading-relaxed">
                        {heroSubtitle}
                    </p>
                    {showChatButton && (
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button
                                onClick={() => onStartChat()}
                                size="lg"
                                style={{ backgroundColor: primaryColor }}
                                className="text-lg px-8 h-14 shadow-lg shadow-blue-900/20 hover:scale-105 transition-transform"
                            >
                                {chatButtonText}
                            </Button>
                            <Button
                                variant="outline"
                                size="lg"
                                className="text-lg h-14 border-white/20 text-white hover:bg-white/10"
                            >
                                Ver Servicios
                            </Button>
                        </div>
                    )}
                </div>
            </section>

            {/* Services Grid */}
            <section id="products" className="py-24 bg-white">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl font-bold mb-4 text-slate-900">Nuestros Servicios</h2>
                        <p className="text-slate-600 text-lg">Descubre cómo podemos ayudarte a alcanzar tus objetivos.</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {products.map((product) => (
                            <div key={product.id} className="group relative bg-white rounded-2xl border border-slate-100 p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                                <div className="w-14 h-14 rounded-xl bg-slate-50 flex items-center justify-center mb-6 group-hover:bg-blue-50 transition-colors">
                                    {product.image_url ? (
                                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-xl" />
                                    ) : (
                                        <CheckCircle2 className="w-7 h-7 text-slate-400 group-hover:text-blue-600 transition-colors" />
                                    )}
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{product.name}</h3>
                                <p className="text-slate-600 mb-6 line-clamp-3 leading-relaxed">
                                    {product.description || "Descripción del servicio. Detalles sobre lo que incluye y cómo beneficia al cliente."}
                                </p>
                                <div className="flex items-center justify-between mt-auto pt-6 border-t border-slate-50">
                                    <span className="font-bold text-lg text-slate-900">
                                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.price)}
                                    </span>
                                    <button
                                        onClick={() => onStartChat(product.id)}
                                        className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                                    >
                                        Consultar <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonials / Social Proof */}
            <section className="py-24 bg-slate-50">
                <div className="container mx-auto px-4">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <h2 className="text-3xl font-bold mb-6 text-slate-900">Confianza que se construye con resultados</h2>
                            <p className="text-slate-600 text-lg mb-8 leading-relaxed">
                                Nos enorgullece trabajar con clientes exigentes y superar sus expectativas en cada proyecto. Tu éxito es nuestra prioridad.
                            </p>
                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <div className="text-4xl font-bold text-slate-900 mb-1">98%</div>
                                    <div className="text-slate-500">Clientes Satisfechos</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-bold text-slate-900 mb-1">24/7</div>
                                    <div className="text-slate-500">Soporte Dedicado</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-bold text-slate-900 mb-1">+500</div>
                                    <div className="text-slate-500">Proyectos Exitosos</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-bold text-slate-900 mb-1">5.0</div>
                                    <div className="text-slate-500">Calificación Promedio</div>
                                </div>
                            </div>
                        </div>
                        <div className="grid gap-6">
                            {testimonials.map((testimonial: any, index: number) => (
                                <div key={testimonial.id || index} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                    <div className="flex gap-1 text-yellow-400 mb-4">
                                        {[1, 2, 3, 4, 5].map((s) => <Star key={s} className="w-4 h-4 fill-current" />)}
                                    </div>
                                    <p className="text-slate-700 mb-4 italic">"{testimonial.description}"</p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-200" />
                                        <div>
                                            <div className="font-bold text-sm text-slate-900">{testimonial.title}</div>
                                            <div className="text-xs text-slate-500">Cliente Verificado</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA / Contact */}
            <section className="py-24 bg-white">
                <div className="container mx-auto px-4 text-center">
                    <div className="max-w-3xl mx-auto bg-slate-900 rounded-3xl p-12 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500 rounded-full blur-3xl opacity-20 translate-y-1/2 -translate-x-1/2" />

                        <div className="relative z-10">
                            <h2 className="text-3xl font-bold text-white mb-6">¿Listo para transformar tu negocio?</h2>
                            <p className="text-slate-300 mb-8 text-lg">
                                Hablemos sobre tu proyecto y encontremos la mejor solución para ti.
                            </p>
                            <Button
                                onClick={() => onStartChat()}
                                size="lg"
                                style={{ backgroundColor: primaryColor }}
                                className="text-lg px-10 h-14 shadow-xl hover:scale-105 transition-transform"
                            >
                                <MessageSquare className="w-5 h-5 mr-2" />
                                {chatButtonText}
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-50 py-12 border-t border-slate-200">
                <div className="container mx-auto px-4">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-slate-900">{organization.name}</span>
                        </div>
                        <div className="flex gap-8 text-sm text-slate-600">
                            <a href="#" className="hover:text-slate-900">Servicios</a>
                            <a href="#" className="hover:text-slate-900">Nosotros</a>
                            <a href="#" className="hover:text-slate-900">Contacto</a>
                        </div>
                        <p className="text-slate-500 text-sm">© {new Date().getFullYear()} {organization.name}</p>
                    </div>
                </div>
            </footer>
        </>
    )
}
