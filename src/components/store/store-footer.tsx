"use client"

import Image from "next/image"
import { Instagram, Facebook } from "lucide-react"
import { getStoreLink } from "@/lib/utils/store-urls"
import { useT } from "@/lib/i18n/use-tenant-strings"

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

function getTextColor(colorType: string): string {
    const colors: Record<string, string> = {
        default: "#1F2937",
        warm: "#92400E",
        cool: "#1E40AF",
        elegant: "#374151",
        modern: "#111827",
        soft: "#6B7280",
    }
    return colors[colorType] || colors.default
}

interface StoreFooterProps {
    organization: {
        slug: string
        name: string
        logo_url?: string | null
        settings?: {
            storefront?: {
                typography?: { fontFamily?: string; textColor?: string }
                footer?: { social?: Record<string, string> }
            }
        } | null
    }
    pages?: Array<{ id: string; slug: string; title: string }>
    isSubdomain?: boolean
}

export function StoreFooter({ organization, pages = [], isSubdomain = false }: StoreFooterProps) {
    const t = useT()
    const typographyConfig = organization.settings?.storefront?.typography || {
        fontFamily: "Inter",
        textColor: "default",
    }
    const socialLinks = organization.settings?.storefront?.footer?.social || {}
    const textColor = getTextColor(typographyConfig.textColor || "default")
    const fontFamily = typographyConfig.fontFamily || "Inter"

    return (
        <footer className="bg-white border-t border-gray-100 py-12">
            <div className="container mx-auto px-4">
                <div className="grid md:grid-cols-4 gap-8 mb-12">
                    <div className="col-span-1 md:col-span-2">
                        <div className="flex items-center gap-2 mb-4">
                            {organization.logo_url ? (
                                <Image
                                    src={organization.logo_url}
                                    alt={organization.name}
                                    width={32}
                                    height={32}
                                    className="h-8 w-auto object-contain"
                                    loading="lazy"
                                    quality={90}
                                />
                            ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold">
                                    {organization.name.substring(0, 1)}
                                </div>
                            )}
                            <span className="text-xl font-bold" style={{ fontFamily, color: textColor }}>
                                {organization.name}
                            </span>
                        </div>
                        <p className="text-gray-500 max-w-xs mb-6" style={{ fontFamily, color: textColor, opacity: 0.7 }}>
                            {t("store.footer.tagline")}
                        </p>
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
                        <h4 className="font-bold mb-4" style={{ fontFamily, color: textColor }}>
                            {t("store.footer.links")}
                        </h4>
                        <ul className="space-y-2 text-gray-600" style={{ fontFamily, color: textColor, opacity: 0.7 }}>
                            <li><a href={getStoreLink("/", isSubdomain, organization.slug)} className="hover:text-primary">{t("store.nav.home")}</a></li>
                            <li><a href={getStoreLink("/productos", isSubdomain, organization.slug)} className="hover:text-primary">{t("store.nav.products")}</a></li>
                            <li><a href={getStoreLink("/sobre-nosotros", isSubdomain, organization.slug)} className="hover:text-primary">{t("store.nav.about")}</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold mb-4" style={{ fontFamily, color: textColor }}>
                            {t("store.footer.legal")}
                        </h4>
                        <ul className="space-y-2 text-gray-600" style={{ fontFamily, color: textColor, opacity: 0.7 }}>
                            {pages.length > 0 ? (
                                pages
                                    .filter((page) => page.slug !== "sobre-nosotros")
                                    .map((page) => (
                                        <li key={page.id}>
                                            <a href={getStoreLink(`/${page.slug}`, isSubdomain, organization.slug)} className="hover:text-primary">
                                                {page.title}
                                            </a>
                                        </li>
                                    ))
                            ) : (
                                <>
                                    <li><a href="#" className="hover:text-primary">{t("store.footer.terms")}</a></li>
                                    <li><a href="#" className="hover:text-primary">{t("store.footer.privacy")}</a></li>
                                </>
                            )}
                        </ul>
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-8 text-center text-gray-400 text-sm">
                    <p style={{ fontFamily, color: textColor, opacity: 0.5 }}>
                        © {new Date().getFullYear()} {organization.name}. Powered by LandingChat.
                    </p>
                </div>
            </div>
        </footer>
    )
}
