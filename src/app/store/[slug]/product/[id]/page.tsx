import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { StoreLayoutClient } from "../../store-layout-client"

interface ProductDetailPageProps {
    params: Promise<{ slug: string; id: string }>
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
    const { slug, id } = await params

    const supabase = await createClient()

    // Get organization by slug
    const { data: organization } = await supabase
        .from("organizations")
        .select("*")
        .eq("slug", slug)
        .single()

    if (!organization) notFound()

    // Get product
    const { data: product } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .eq("organization_id", organization.id)
        .single()

    if (!product) notFound()

    const primaryColor = organization.settings?.branding?.primaryColor || "#2b7cee"
    const images = product.images || []
    const mainImage = images[0] || product.image_url || "/placeholder-product.png"

    return (
        <StoreLayoutClient slug={slug} organization={organization} products={[]}>
            <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden font-display bg-background-light dark:bg-background-dark text-slate-800 dark:text-slate-200">
                {/* Main Content */}
                <main className="flex-1 px-4 sm:px-6 lg:px-10 py-8">
                    <div className="max-w-6xl mx-auto">
                        {/* Breadcrumbs */}
                        <div className="flex flex-wrap gap-2 p-4">
                            <Link href={`/store/${slug}`} className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-normal">Inicio</Link>
                            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-normal">/</span>
                            <Link href={`/store/${slug}/products`} className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-normal">Productos</Link>
                            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-normal">/</span>
                            <span className="text-slate-900 dark:text-white text-sm font-medium leading-normal">{product.name}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-6">
                            {/* Left Column: Images */}
                            <div className="flex flex-col gap-4">
                                <div className="w-full bg-center bg-no-repeat bg-cover flex flex-col justify-end overflow-hidden bg-slate-100 dark:bg-slate-800 rounded-xl min-h-96 relative">
                                    <Image
                                        src={mainImage}
                                        alt={product.name}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                                {images.length > 1 && (
                                    <div className="grid grid-cols-[repeat(auto-fit,minmax(80px,1fr))] gap-4">
                                        {images.map((img: string, idx: number) => (
                                            <div key={idx} className={`w-full bg-center bg-no-repeat aspect-square bg-cover rounded-lg relative ${idx === 0 ? 'border-2 border-primary' : ''}`}>
                                                <Image
                                                    src={img}
                                                    alt={`${product.name} ${idx + 1}`}
                                                    fill
                                                    className="object-cover rounded-lg"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Right Column: Product Info */}
                            <div className="flex flex-col pt-4">
                                <h1 className="text-slate-900 dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]">{product.name}</h1>

                                {/* Price */}
                                <p className="text-primary text-4xl font-bold mt-4" style={{ color: primaryColor }}>
                                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.price)}
                                </p>

                                {/* Description */}
                                <p className="text-slate-600 dark:text-slate-300 mt-6 text-base leading-relaxed">
                                    {product.description || "Sin descripción disponible."}
                                </p>

                                {/* Variants */}
                                {product.variants && product.variants.length > 0 && (
                                    <div className="mt-8 space-y-6">
                                        {product.variants.map((variant: any, idx: number) => (
                                            <div key={idx}>
                                                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">{variant.type}</label>
                                                <div className="flex gap-3 mt-2 flex-wrap">
                                                    {variant.values.map((value: string, vIdx: number) => (
                                                        <button
                                                            key={vIdx}
                                                            className={`px-4 py-2 rounded-lg border-2 text-sm font-medium ${vIdx === 0
                                                                ? 'border-primary text-primary'
                                                                : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300'
                                                                }`}
                                                            style={vIdx === 0 ? { borderColor: primaryColor, color: primaryColor } : {}}
                                                        >
                                                            {value}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="mt-10 flex flex-col gap-4">
                                    <Link
                                        href={`/chat/${slug}?product=${id}`}
                                        className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 bg-primary text-white gap-3 text-base font-bold leading-normal tracking-wide min-w-0 px-6 transform transition-transform duration-200 hover:scale-105"
                                        style={{ backgroundColor: primaryColor }}
                                    >
                                        <span className="material-symbols-outlined">chat_bubble</span>
                                        <span>Chatear para Comprar</span>
                                    </Link>
                                    <Link
                                        href={`/chat/${slug}?product=${id}`}
                                        className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white gap-3 text-base font-bold leading-normal tracking-wide min-w-0 px-6 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        <span>Preguntar al Asistente</span>
                                    </Link>
                                </div>

                                {/* Collapsible Sections */}
                                <div className="mt-12 border-t border-slate-200 dark:border-slate-800 pt-8">
                                    <div className="space-y-4">
                                        <div>
                                            <button className="flex justify-between items-center w-full text-left font-semibold text-slate-800 dark:text-slate-200">
                                                <span>Descripción Completa</span>
                                                <span className="material-symbols-outlined">expand_less</span>
                                            </button>
                                            <div className="mt-2 text-slate-600 dark:text-slate-400 text-sm leading-6">
                                                {product.description || "Sin descripción disponible."}
                                            </div>
                                        </div>
                                        <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                                            <button className="flex justify-between items-center w-full text-left font-semibold text-slate-800 dark:text-slate-200">
                                                <span>Especificaciones</span>
                                                <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">expand_more</span>
                                            </button>
                                        </div>
                                        {product.stock !== undefined && (
                                            <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Disponibilidad</span>
                                                    <span className={`text-sm font-medium ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {product.stock > 0 ? `${product.stock} en stock` : 'Agotado'}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </StoreLayoutClient>
    )
}
