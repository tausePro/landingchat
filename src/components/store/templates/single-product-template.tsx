import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Star, Check, Shield, Truck, MessageCircle } from "lucide-react"

interface SingleProductTemplateProps {
    organization: any
    products: any[]
    primaryColor: string
    heroSettings: any
    onStartChat: (productId?: string) => void
}

export function SingleProductTemplate({
    organization,
    products,
    primaryColor,
    heroSettings,
    onStartChat
}: SingleProductTemplateProps) {
    const heroTitle = heroSettings.title || "El producto que estabas esperando."
    const heroSubtitle = heroSettings.subtitle || "Diseño excepcional, calidad inigualable y la mejor experiencia de compra."
    const heroBackgroundImage = heroSettings.backgroundImage || ""
    const showChatButton = heroSettings.showChatButton ?? true
    const chatButtonText = heroSettings.chatButtonText || "Comprar Ahora"

    // Use the first product as the featured one, or a placeholder if none exist
    const featuredProduct = products.length > 0 ? products[0] : {
        id: "placeholder",
        name: "Producto Destacado",
        description: "Este es un producto de ejemplo. Agrega productos en tu dashboard para verlos aquí.",
        price: 0,
        image_url: null
    }

    return (
        <>
            {/* Split Hero Section */}
            <section className="relative overflow-hidden min-h-[90vh] flex items-center bg-white">
                <div className="container mx-auto px-4 py-12 lg:py-0">
                    <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">

                        {/* Left: Product Image */}
                        <div className="order-2 lg:order-1 relative">
                            <div className="relative aspect-square rounded-3xl overflow-hidden bg-gray-50 border border-gray-100 shadow-2xl">
                                {featuredProduct.image_url ? (
                                    <img
                                        src={featuredProduct.image_url}
                                        alt={featuredProduct.name}
                                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-300">
                                        <span className="text-6xl font-bold opacity-20">IMG</span>
                                    </div>
                                )}
                                {/* Floating Badge */}
                                <div className="absolute top-6 right-6 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-gray-100">
                                    <div className="flex items-center gap-1 text-yellow-500 font-bold">
                                        <Star className="w-4 h-4 fill-current" />
                                        <span>4.9</span>
                                        <span className="text-gray-400 font-normal text-sm ml-1">(120 reviews)</span>
                                    </div>
                                </div>
                            </div>
                            {/* Decorative blob */}
                            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-blue-50 to-purple-50 rounded-full blur-3xl opacity-50" />
                        </div>

                        {/* Right: Details */}
                        <div className="order-1 lg:order-2">
                            <Badge variant="outline" className="mb-6 px-3 py-1 text-sm border-gray-200 text-gray-600">
                                {organization.name} presenta
                            </Badge>
                            <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight text-gray-900 mb-6 leading-[1.1]">
                                {heroTitle}
                            </h1>
                            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                                {heroSubtitle}
                            </p>

                            <div className="flex items-center gap-4 mb-8">
                                <span className="text-4xl font-bold" style={{ color: primaryColor }}>
                                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(featuredProduct.price)}
                                </span>
                                {featuredProduct.price > 0 && (
                                    <span className="text-xl text-gray-400 line-through">
                                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(featuredProduct.price * 1.2)}
                                    </span>
                                )}
                            </div>

                            {showChatButton && (
                                <div className="flex flex-col sm:flex-row gap-4 mb-10">
                                    <Button
                                        onClick={() => onStartChat(featuredProduct.id)}
                                        size="lg"
                                        style={{ backgroundColor: primaryColor }}
                                        className="w-full sm:w-auto text-lg px-10 h-16 shadow-xl hover:scale-105 transition-transform"
                                    >
                                        {chatButtonText}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        className="w-full sm:w-auto text-lg h-16 border-gray-200"
                                    >
                                        Ver Detalles
                                    </Button>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-3 text-sm font-medium text-gray-600">
                                    <div className="p-2 rounded-full bg-green-50 text-green-600">
                                        <Truck className="w-4 h-4" />
                                    </div>
                                    Envío Gratis
                                </div>
                                <div className="flex items-center gap-3 text-sm font-medium text-gray-600">
                                    <div className="p-2 rounded-full bg-blue-50 text-blue-600">
                                        <Shield className="w-4 h-4" />
                                    </div>
                                    Garantía de 1 año
                                </div>
                                <div className="flex items-center gap-3 text-sm font-medium text-gray-600">
                                    <div className="p-2 rounded-full bg-purple-50 text-purple-600">
                                        <MessageCircle className="w-4 h-4" />
                                    </div>
                                    Soporte 24/7
                                </div>
                                <div className="flex items-center gap-3 text-sm font-medium text-gray-600">
                                    <div className="p-2 rounded-full bg-orange-50 text-orange-600">
                                        <Check className="w-4 h-4" />
                                    </div>
                                    Stock Disponible
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Product Details / Specs */}
            <section className="py-24 bg-gray-50">
                <div className="container mx-auto px-4">
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-3xl font-bold mb-8 text-center">Detalles del Producto</h2>
                        <div className="bg-white rounded-2xl shadow-sm p-8 lg:p-12">
                            <h3 className="text-2xl font-bold mb-4">{featuredProduct.name}</h3>
                            <p className="text-gray-600 leading-relaxed mb-8 text-lg">
                                {featuredProduct.description || "Descripción detallada del producto. Aquí puedes explicar todas las características increíbles que hacen que este producto sea único y valioso para tus clientes."}
                            </p>

                            <div className="border-t border-gray-100 pt-8">
                                <h4 className="font-bold mb-4">Características Principales</h4>
                                <ul className="space-y-3">
                                    {[1, 2, 3, 4].map((i) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                                            <span className="text-gray-600">Característica increíble número {i} que te encantará.</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Simple Footer */}
            <footer className="bg-white py-12 border-t border-gray-100">
                <div className="container mx-auto px-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <span className="text-xl font-bold">{organization.name}</span>
                    </div>
                    <p className="text-gray-400 text-sm">© 2024 {organization.name}. Todos los derechos reservados.</p>
                </div>
            </footer>
        </>
    )
}
