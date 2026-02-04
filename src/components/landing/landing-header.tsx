"use client"

import { useState } from "react"
import Link from "next/link"
import { Layers, Menu, X } from "lucide-react"
import type { LandingMainConfig } from "@/types/landing"

interface LandingHeaderProps {
    config: LandingMainConfig
}

export function LandingHeader({ config }: LandingHeaderProps) {
    const [mobileOpen, setMobileOpen] = useState(false)

    return (
        <header className="fixed top-0 w-full z-[60] bg-white/70 backdrop-blur-xl border-b border-white/40">
            <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    {config.logo_type === "image" && config.logo_image_url ? (
                        <img
                            src={config.logo_image_url}
                            alt={config.logo_text || "Logo"}
                            className="h-10 w-auto object-contain"
                        />
                    ) : config.logo_type === "text" ? (
                        <h2 className="text-landing-deep text-xl font-bold tracking-tight">
                            {config.logo_text || "LandingChat"}
                        </h2>
                    ) : (
                        /* Default: icon */
                        <>
                            <div className="size-10 bg-landing-deep text-white flex items-center justify-center rounded-xl shadow-lg shadow-landing-violet/20">
                                <Layers className="size-6" />
                            </div>
                            <h2 className="text-landing-deep text-xl font-bold tracking-tight">
                                {config.logo_text || "LandingChat"}{" "}
                                <span className="text-xs font-normal text-landing-violet bg-landing-violet/10 px-2 py-0.5 rounded-full ml-1 border border-landing-violet/20">
                                    OS
                                </span>
                            </h2>
                        </>
                    )}
                </div>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-8">
                    {config.header_nav_links.map((link, i) => (
                        <a
                            key={i}
                            href={link.href}
                            className="text-sm font-medium text-gray-600 hover:text-landing-violet transition-colors"
                        >
                            {link.label}
                        </a>
                    ))}
                </nav>

                {/* CTAs */}
                <div className="flex items-center gap-4">
                    <Link
                        href="/login"
                        className="hidden sm:block text-sm font-medium text-landing-deep hover:text-landing-violet transition-colors"
                    >
                        Ingresar
                    </Link>
                    <Link
                        href={config.header_cta_href}
                        className="px-6 py-2.5 bg-landing-deep text-white rounded-xl text-sm font-semibold hover-magnetic transition-all shadow-xl shadow-landing-deep/20 border border-landing-deep-light"
                    >
                        {config.header_cta_text}
                    </Link>

                    {/* Mobile toggle */}
                    <button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="md:hidden p-2 text-gray-600"
                    >
                        {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {mobileOpen && (
                <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-gray-100 px-6 py-4 space-y-3">
                    {config.header_nav_links.map((link, i) => (
                        <a
                            key={i}
                            href={link.href}
                            onClick={() => setMobileOpen(false)}
                            className="block text-sm font-medium text-gray-700 py-2"
                        >
                            {link.label}
                        </a>
                    ))}
                    <Link
                        href="/login"
                        onClick={() => setMobileOpen(false)}
                        className="block text-sm font-medium text-gray-700 py-2"
                    >
                        Ingresar
                    </Link>
                </div>
            )}
        </header>
    )
}
