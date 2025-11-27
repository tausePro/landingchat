import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ShoppingBag, MessageCircle, Truck, ShieldCheck } from "lucide-react"

interface CompleteTemplateProps {
    organization: any
    products: any[]
    primaryColor: string
    heroSettings: any
    onStartChat: (productId?: string) => void
}

export function CompleteTemplate({
    organization,
    products,
    primaryColor,
    heroSettings,
    onStartChat
}: CompleteTemplateProps) {
    const heroTitle = heroSettings.title || "Encuentra tu producto ideal, chateando."
    const heroSubtitle = heroSettings.subtitle || "Sin buscar, sin filtros, solo conversación. Nuestro asistente de IA te ayuda a encontrar exactamente lo que necesitas en segundos."
    const heroBackgroundImage = heroSettings.backgroundImage || ""
    const showChatButton = heroSettings.showChatButton ?? true
    const chatButtonText = heroSettings.chatButtonText || "Chatear para Comprar"

    const templateConfig = organization.settings?.storefront?.templateConfig?.complete || {}
    const steps = templateConfig.steps || [
        { id: "1", title: "1. Chatea", description: "Cuéntale a nuestro asistente qué necesitas, como si hablaras con un amigo." },
        { id: "2", title: "2. Elige", description: "Recibe recomendaciones personalizadas y selecciona tu favorita." },
        { id: "3", title: "3. Recibe", description: "Coordina el envío y el pago directamente en el chat. ¡Listo!" }
    ]

    return (
        <>
            {/* Hero Section - Complete */}
            <section
                className="relative overflow-hidden pt-16 pb-24 lg:pt-32 lg:pb-40"
                style={{
                    backgroundImage: heroBackgroundImage ? `url(${heroBackgroundImage})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: heroBackgroundImage ? 'transparent' : 'white'
                }}
            >
                {heroBackgroundImage && (
                    <div className="absolute inset-0 bg-black/40" />
                )}
                <div className="container mx-auto px-4 relative z-10">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div className="max-w-2xl">
                            <Badge variant="outline" className={`mb-6 px-3 py-1 text-sm ${heroBackgroundImage ? 'border-white/30 bg-white/20 text-white' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                                ✨ La nueva forma de comprar
                            </Badge>
                            <h1 className={`text-4xl font-extrabold tracking-tight sm:text-6xl mb-6 leading-[1.1] ${heroBackgroundImage ? 'text-white' : 'text-gray-900'}`}>
                                {heroTitle}
                            </h1>
                            <p className={`text-lg mb-8 leading-relaxed ${heroBackgroundImage ? 'text-white/90' : 'text-slate-600'}`}>
                                {heroSubtitle}
                            </p>
                            {showChatButton && (
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <Button
                                        onClick={() => onStartChat()}
                                        size="lg"
                                        style={{ backgroundColor: primaryColor }}
                                        className="w-full sm:w-auto text-base px-8 h-14 shadow-xl hover:scale-105 transition-transform"
                                    >
                                        {chatButtonText}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        className={`w-full sm:w-auto text-base h-14 ${heroBackgroundImage ? 'border-white text-white hover:bg-white/10' : ''}`}
                                    >
                                        Ver Catálogo
                                    </Button>
                                </div>
                            )}

                            {/* Stats */}
                            <div className={`mt-10 flex items-center gap-6 text-sm font-medium ${heroBackgroundImage ? 'text-white/80' : 'text-slate-500'}`}>
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-full bg-white/10 backdrop-blur-sm">
                                        <Truck className="w-4 h-4" />
                                    </div>
                                    <span>Envíos Nacionales</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-full bg-white/10 backdrop-blur-sm">
                                        <ShieldCheck className="w-4 h-4" />
                                    </div>
                                    <span>Compra Segura</span>
                                </div>
                            </div>
                        </div>

                        {/* Hero Image/Illustration (only if no background image) */}
                        {!heroBackgroundImage && (
                            <div className="hidden lg:block relative">
                                <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 to-purple-100 rounded-3xl transform rotate-3 scale-95 opacity-70" />
                                <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 p-8">
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">IA</div>
                                            <div className="bg-gray-100 rounded-2xl rounded-tl-none p-4 text-sm text-gray-700 max-w-[80%]">
                                                ¡Hola! 👋 Soy tu asistente personal. ¿Qué estás buscando hoy?
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4 flex-row-reverse">
                                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">Tú</div>
                                            <div className="bg-blue-600 rounded-2xl rounded-tr-none p-4 text-sm text-white max-w-[80%]">
                                                Busco un regalo para mi novia, le gusta la tecnología.
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">IA</div>
                                            <div className="bg-gray-100 rounded-2xl rounded-tl-none p-4 text-sm text-gray-700 max-w-[80%]">
                                                ¡Perfecto! Tengo unas opciones geniales. ¿Qué tal estos audífonos con cancelación de ruido? 🎧
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Features / How it works */}
            <section className="py-20 bg-white">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl font-bold mb-4">Cómo funciona</h2>
                        <p className="text-gray-600 text-lg">Comprar nunca fue tan fácil. Olvídate de los carritos complicados.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {steps.map((step: any, index: number) => (
                            <div key={step.id || index} className="text-center p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
                                <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6 ${index === 0 ? 'bg-blue-100 text-blue-600' :
                                        index === 1 ? 'bg-purple-100 text-purple-600' :
                                            'bg-green-100 text-green-600'
                                    }`}>
                                    {index === 0 ? <MessageCircle className="w-8 h-8" /> :
                                        index === 1 ? <ShoppingBag className="w-8 h-8" /> :
                                            <Truck className="w-8 h-8" />}
                                </div>
                                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                                <p className="text-gray-600">{step.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Featured Products */}
            <section id="products" className="py-20 bg-gray-50">
                <div className="container mx-auto px-4">
                    <div className="flex justify-between items-end mb-12">
                        <div>
                            <h2 className="text-3xl font-bold mb-2">Tendencias</h2>
                            <p className="text-gray-600">Lo más vendido de la semana</p>
                        </div>
                        <Button variant="outline">Ver Todo</Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {products.slice(0, 8).map((product) => (
                            <div key={product.id} className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100">
                                <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                                    {product.image_url ? (
                                        <img
                                            src={product.image_url}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <ShoppingBag className="w-12 h-12" />
                                        </div>
                                    )}
                                    <div className="absolute top-3 right-3">
                                        <Badge className="bg-white/90 text-black hover:bg-white backdrop-blur-sm shadow-sm">
                                            Nuevo
                                        </Badge>
                                    </div>
                                </div>
                                <div className="p-5">
                                    <h3 className="font-bold text-gray-900 mb-1 truncate">{product.name}</h3>
                                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">{product.description}</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-lg font-bold" style={{ color: primaryColor }}>
                                            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.price)}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="rounded-full hover:bg-gray-100"
                                            onClick={() => onStartChat(product.id)}
                                        >
                                            <MessageCircle className="w-5 h-5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-gray-900 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
                <div className="container mx-auto px-4 text-center relative z-10">
                    <h2 className="text-3xl md:text-5xl font-bold mb-6">¿Listo para empezar?</h2>
                    <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
                        Únete a miles de clientes satisfechos que ya compran de manera inteligente.
                    </p>
                    <Button
                        onClick={() => onStartChat()}
                        size="lg"
                        style={{ backgroundColor: primaryColor }}
                        className="text-lg px-10 h-16 shadow-2xl hover:scale-105 transition-transform"
                    >
                        {chatButtonText}
                    </Button>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-100 py-12">
                <div className="container mx-auto px-4">
                    <div className="grid md:grid-cols-4 gap-8 mb-12">
                        <div className="col-span-1 md:col-span-2">
                            <div className="flex items-center gap-2 mb-4">
                                {organization.logo_url ? (
                                    <img src={organization.logo_url} alt={organization.name} className="h-8 w-auto object-contain" />
                                ) : (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold">
                                        {organization.name.substring(0, 1)}
                                    </div>
                                )}
                                <span className="text-xl font-bold">{organization.name}</span>
                            </div>
                            <p className="text-gray-500 max-w-xs">
                                La mejor experiencia de compra conversacional. Encuentra lo que buscas, al instante.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-bold mb-4">Enlaces</h4>
                            <ul className="space-y-2 text-gray-600">
                                <li><a href="#" className="hover:text-primary">Inicio</a></li>
                                <li><a href="#products" className="hover:text-primary">Productos</a></li>
                                <li><a href="#" className="hover:text-primary">Nosotros</a></li>
                                <li><a href="#" className="hover:text-primary">Contacto</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold mb-4">Legal</h4>
                            <ul className="space-y-2 text-gray-600">
                                <li><a href="#" className="hover:text-primary">Términos</a></li>
                                <li><a href="#" className="hover:text-primary">Privacidad</a></li>
                                <li><a href="#" className="hover:text-primary">Envíos</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-gray-100 pt-8 text-center text-gray-400 text-sm">
                        <p>© 2024 {organization.name}. Powered by LandingChat.</p>
                    </div>
                </div>
            </footer>
        </>
    )
}
