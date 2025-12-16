"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ShoppingBag, MessageCircle, Truck, ShieldCheck, Instagram, Facebook } from "lucide-react"

// Custom icons for TikTok and WhatsApp if not in lucide
const TikTokIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
)

const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
)

interface CompleteTemplateProps {
    organization: any
    products: any[]
    primaryColor: string
    heroSettings: any
    onStartChat: (productId?: string) => void
}

// Helper function to clean HTML and create excerpt
function cleanDescription(html: string | null | undefined, maxLength: number = 150): string {
    if (!html) return "Producto disponible"
    
    const cleaned = html
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"')
        .replace(/\s+/g, ' ')
        .trim()
    
    return cleaned.length > maxLength 
        ? cleaned.substring(0, maxLength) + '...'
        : cleaned
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
    const productConfig = organization.settings?.storefront?.products || {
        showSection: true,
        itemsToShow: 8,
        orderBy: "recent",
        showPrices: true,
        showAddToCart: true,
        showAIRecommended: false,
        categories: { enabled: true, selected: [] }
    }
    const socialLinks = organization.settings?.storefront?.footer?.social || {}

    const steps = templateConfig.steps || [
        { id: "1", title: "1. Chatea", description: "Cuéntale a nuestro asistente qué necesitas, como si hablaras con un amigo." },
        { id: "2", title: "2. Elige", description: "Recibe recomendaciones personalizadas y selecciona tu favorita." },
        { id: "3", title: "3. Recibe", description: "Coordina el envío y el pago directamente en el chat. ¡Listo!" }
    ]

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

    // Filter and Sort Products
    const filteredProducts = useMemo(() => {
        let result = [...products]

        // Filter by category if selected
        if (selectedCategory) {
            result = result.filter(p => {
                if (Array.isArray(p.categories)) return p.categories.includes(selectedCategory)
                return p.categories === selectedCategory || p.category === selectedCategory
            })
        }

        // Filter by configured categories (if any selected in settings)
        if (productConfig.categories?.enabled && productConfig.categories?.selected?.length > 0) {
            result = result.filter(p => {
                const pCats = Array.isArray(p.categories) ? p.categories : [p.categories || p.category].filter(Boolean)
                return pCats.some((c: string) => productConfig.categories.selected.includes(c))
            })
        }

        // Sort
        if (productConfig.orderBy === "price_asc") result.sort((a, b) => a.price - b.price)
        else if (productConfig.orderBy === "price_desc") result.sort((a, b) => b.price - a.price)
        // recent and best_selling would need backend support or date fields, assuming default order is recent

        return result.slice(0, productConfig.itemsToShow || 8)
    }, [products, selectedCategory, productConfig])

    // Get unique categories for filter tabs
    const availableCategories = useMemo(() => {
        if (!productConfig.categories?.enabled) return []

        // If specific categories are selected in settings, use those
        if (productConfig.categories?.selected?.length > 0) {
            return productConfig.categories.selected
        }

        // Otherwise extract from products
        const cats = new Set<string>()
        products.forEach(p => {
            if (Array.isArray(p.categories)) p.categories.forEach((c: string) => cats.add(c))
            else if (p.categories) cats.add(p.categories)
            else if (p.category) cats.add(p.category)
        })
        return Array.from(cats)
    }, [products, productConfig])

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
            {productConfig.showSection && (
                <section id="products" className="py-20 bg-gray-50">
                    <div className="container mx-auto px-4">
                        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">Tendencias</h2>
                                <p className="text-gray-600">Lo más vendido de la semana</p>
                            </div>

                            {/* Category Filter */}
                            {productConfig.categories?.enabled && availableCategories.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant={selectedCategory === null ? undefined : "outline"}
                                        onClick={() => setSelectedCategory(null)}
                                        className="rounded-full"
                                        style={selectedCategory === null ? { backgroundColor: primaryColor } : {}}
                                    >
                                        Todos
                                    </Button>
                                    {availableCategories.map((cat: string) => (
                                        <Button
                                            key={cat}
                                            variant={selectedCategory === cat ? undefined : "outline"}
                                            onClick={() => setSelectedCategory(cat)}
                                            className="rounded-full capitalize"
                                            style={selectedCategory === cat ? { backgroundColor: primaryColor } : {}}
                                        >
                                            {cat}
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                            {filteredProducts.map((product) => (
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
                                        {productConfig.showAIRecommended && (
                                            <div className="absolute top-3 right-3">
                                                <Badge className="bg-white/90 text-black hover:bg-white backdrop-blur-sm shadow-sm flex items-center gap-1">
                                                    ✨ IA
                                                </Badge>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-5">
                                        <h3 className="font-bold text-gray-900 mb-1 truncate">{product.name}</h3>
                                        <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                                            {cleanDescription(product.description)}
                                        </p>
                                        <div className="flex items-center justify-between">
                                            {productConfig.showPrices ? (
                                                <span className="text-lg font-bold" style={{ color: primaryColor }}>
                                                    {(() => {
                                                        // Handle products with variants (like gift cards)
                                                        if (product.price === 0 && product.variants && product.variants.length > 0) {
                                                            const minPrice = Math.min(...product.variants.map((v: any) => v.price || 0))
                                                            return minPrice > 0 
                                                                ? `Desde ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(minPrice)}`
                                                                : "Elige monto"
                                                        }
                                                        // Regular products
                                                        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.price)
                                                    })()}
                                                </span>
                                            ) : (
                                                <span></span>
                                            )}

                                            {productConfig.showAddToCart && (
                                                <Button
                                                    size="sm"
                                                    className="rounded-full text-xs px-3 py-1 h-8 font-medium"
                                                    style={{ backgroundColor: primaryColor }}
                                                    onClick={() => onStartChat(product.id)}
                                                    title={`Pregunta sobre ${product.name}`}
                                                >
                                                    <MessageCircle className="w-4 h-4 mr-1" />
                                                    ¿Me sirve?
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

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
                            <p className="text-gray-500 max-w-xs mb-6">
                                La mejor experiencia de compra conversacional. Encuentra lo que buscas, al instante.
                            </p>

                            {/* Social Links */}
                            <div className="flex items-center gap-4">
                                {socialLinks.instagram && (
                                    <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-pink-600 transition-colors">
                                        <Instagram className="w-6 h-6" />
                                    </a>
                                )}
                                {socialLinks.facebook && (
                                    <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors">
                                        <Facebook className="w-6 h-6" />
                                    </a>
                                )}
                                {socialLinks.tiktok && (
                                    <a href={socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black transition-colors">
                                        <TikTokIcon className="w-6 h-6" />
                                    </a>
                                )}
                                {socialLinks.whatsapp && (
                                    <a href={`https://wa.me/${socialLinks.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-green-500 transition-colors">
                                        <WhatsAppIcon className="w-6 h-6" />
                                    </a>
                                )}
                            </div>
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
                        <p>© {new Date().getFullYear()} {organization.name}. Powered by LandingChat.</p>
                    </div>
                </div>
            </footer>
        </>
    )
}
