import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface MinimalTemplateProps {
    organization: any
    products: any[]
    primaryColor: string
    heroSettings: any
    onStartChat: (productId?: string) => void
}

export function MinimalTemplate({
    organization,
    products,
    primaryColor,
    heroSettings,
    onStartChat
}: MinimalTemplateProps) {
    const heroTitle = heroSettings.title || "Encuentra tu producto ideal, chateando."
    const heroSubtitle = heroSettings.subtitle || "Sin buscar, sin filtros, solo conversación."
    const heroBackgroundImage = heroSettings.backgroundImage || ""
    const showChatButton = heroSettings.showChatButton ?? true
    const chatButtonText = heroSettings.chatButtonText || "Chatear para Comprar"

    return (
        <>
            {/* Hero Section - Minimal */}
            <section
                className="relative overflow-hidden pt-20 pb-32"
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
                <div className="container mx-auto px-4 relative z-10 text-center">
                    <h1 className={`text-5xl md:text-6xl font-extrabold mb-6 ${heroBackgroundImage ? 'text-white' : 'text-gray-900'}`}>
                        {heroTitle}
                    </h1>
                    <p className={`text-xl mb-10 max-w-2xl mx-auto ${heroBackgroundImage ? 'text-white/90' : 'text-gray-600'}`}>
                        {heroSubtitle}
                    </p>
                    {showChatButton && (
                        <Button
                            onClick={() => onStartChat()}
                            size="lg"
                            style={{ backgroundColor: primaryColor }}
                            className="text-lg px-10 h-16 shadow-2xl hover:scale-105 transition-transform"
                        >
                            {chatButtonText}
                        </Button>
                    )}
                </div>
            </section>

            {/* Featured Products - Simple Grid */}
            <section id="products" className="py-20 bg-gray-50">
                <div className="container mx-auto px-4">
                    <h2 className="text-3xl font-bold text-center mb-12">Productos Destacados</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                        {products.slice(0, 6).map((product) => (
                            <div key={product.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow">
                                <div className="aspect-square bg-gray-100 relative">
                                    {product.image_url && (
                                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                    )}
                                </div>
                                <div className="p-6">
                                    <h3 className="font-semibold text-lg mb-2">{product.name}</h3>
                                    <p className="text-2xl font-bold mb-4" style={{ color: primaryColor }}>
                                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.price)}
                                    </p>
                                    <Link
                                        href={`/store/${organization.slug}/product/${product.id}`}
                                        className="block w-full text-center py-2 px-4 rounded-lg border-2 font-semibold hover:bg-gray-50 transition-colors"
                                        style={{ borderColor: primaryColor, color: primaryColor }}
                                    >
                                        Ver Detalles
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Simple Footer */}
            {/* Simple Footer */}
            <footer className="bg-gray-900 text-white py-12">
                <div className="container mx-auto px-4 text-center">
                    <div className="flex justify-center gap-6 mb-8">
                        {organization.settings?.storefront?.footer?.social?.instagram && (
                            <a href={organization.settings.storefront.footer.social.instagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                                Instagram
                            </a>
                        )}
                        {organization.settings?.storefront?.footer?.social?.facebook && (
                            <a href={organization.settings.storefront.footer.social.facebook} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                                Facebook
                            </a>
                        )}
                        {organization.settings?.storefront?.footer?.social?.tiktok && (
                            <a href={organization.settings.storefront.footer.social.tiktok} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                                TikTok
                            </a>
                        )}
                        {organization.settings?.storefront?.footer?.social?.whatsapp && (
                            <a href={`https://wa.me/${organization.settings.storefront.footer.social.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                                WhatsApp
                            </a>
                        )}
                    </div>
                    <p className="text-gray-400">© {new Date().getFullYear()} {organization.name}. Todos los derechos reservados.</p>
                </div>
            </footer>
        </>
    )
}
