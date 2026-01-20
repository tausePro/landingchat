"use client"

import { AboutContent } from "@/types/page-content"
import { useState } from "react"

interface AboutTemplateProps {
    content: AboutContent
    organizationSlug: string
    primaryColor?: string
    whatsappNumber?: string  // Corporate WhatsApp from footer config
}

export function AboutTemplate({ content, organizationSlug, primaryColor = '#2563EB', whatsappNumber }: AboutTemplateProps) {
    const [currentTeamIndex, setCurrentTeamIndex] = useState(0)

    const nextTeamMember = () => {
        if (content.team && currentTeamIndex < content.team.length - 1) {
            setCurrentTeamIndex(prev => prev + 1)
        }
    }

    const prevTeamMember = () => {
        if (currentTeamIndex > 0) {
            setCurrentTeamIndex(prev => prev - 1)
        }
    }

    return (
        <main className="flex flex-col">
            {/* Hero Section */}
            {content.hero && (
                <section className="relative w-full h-[80vh] min-h-[600px] flex items-center justify-center overflow-hidden">
                    <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
                        style={{
                            backgroundImage: content.hero.image
                                ? `linear-gradient(rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.6) 100%), url(${content.hero.image})`
                                : `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`
                        }}
                    />
                    <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
                        <h1 className="text-white text-5xl md:text-7xl font-black leading-tight tracking-[-0.033em] mb-6">
                            {content.hero.title}
                        </h1>
                        <p className="text-white/90 text-lg md:text-xl font-light leading-relaxed mb-10 max-w-2xl mx-auto">
                            {content.hero.subtitle}
                        </p>
                        {content.hero.ctaText && (
                            <button
                                className="text-white px-8 py-4 rounded-xl text-lg font-bold shadow-lg transition-all flex items-center gap-2 mx-auto"
                                style={{ backgroundColor: primaryColor }}
                            >
                                {content.hero.ctaText}
                                <span className="material-symbols-outlined">arrow_downward</span>
                            </button>
                        )}
                    </div>
                </section>
            )}

            {/* Story Section */}
            {content.story && (
                <section className="py-24 px-6 md:px-20 lg:px-40 bg-white dark:bg-background-dark">
                    <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                        <div className="flex flex-col gap-6 order-2 md:order-1">
                            <h2 className="text-sm font-bold tracking-widest uppercase" style={{ color: primaryColor }}>
                                {content.story.tagline}
                            </h2>
                            <h3 className="text-4xl font-black tracking-tight text-[#111418] dark:text-white leading-tight">
                                {content.story.title}
                            </h3>
                            <div className="flex flex-col gap-4 text-[#60708a] dark:text-gray-400 text-lg leading-relaxed font-light">
                                {content.story.paragraphs.map((paragraph, index) => (
                                    <p key={index}>{paragraph}</p>
                                ))}
                            </div>
                            {content.story.ctaText && (
                                <div className="mt-4">
                                    <button className="bg-background-light dark:bg-gray-800 text-[#111418] dark:text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/10 transition-colors">
                                        {content.story.ctaText}
                                        <span className="material-symbols-outlined">history</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="order-1 md:order-2">
                            {content.story.image && (
                                <div
                                    className="aspect-[3/4] rounded-xl overflow-hidden shadow-2xl rotate-2 hover:rotate-0 transition-transform duration-500"
                                    style={{
                                        backgroundImage: `url(${content.story.image})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center'
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </section>
            )}

            {/* Values Section */}
            {content.values && content.values.length > 0 && (
                <section className="py-24 px-6 md:px-20 lg:px-40 bg-background-light dark:bg-gray-900/50">
                    <div className="max-w-[1200px] mx-auto">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl font-black tracking-tight mb-4">Nuestros Valores</h2>
                            <p className="text-[#60708a] dark:text-gray-400 text-lg">
                                Los pilares que sostienen cada una de nuestras decisiones.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {content.values.map((value, index) => (
                                <div
                                    key={index}
                                    className="bg-white dark:bg-background-dark p-10 rounded-xl shadow-sm border border-[#dbdfe6] dark:border-gray-800 flex flex-col items-center text-center group hover:border-primary transition-colors"
                                >
                                    <div
                                        className="size-16 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"
                                        style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}
                                    >
                                        <span className="material-symbols-outlined !text-3xl">{value.icon}</span>
                                    </div>
                                    <h4 className="text-xl font-bold mb-3">{value.title}</h4>
                                    <p className="text-sm text-[#60708a] dark:text-gray-400 leading-relaxed">
                                        {value.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Impact Stats */}
            {content.stats && content.stats.length > 0 && (
                <section className="py-20 text-white overflow-hidden relative" style={{ backgroundColor: primaryColor }}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                    <div className={`max-w-[1200px] mx-auto px-6 grid grid-cols-1 md:grid-cols-${Math.min(content.stats.length, 3)} gap-12 text-center`}>
                        {content.stats.map((stat, index) => (
                            <div
                                key={index}
                                className={`flex flex-col gap-2 ${index > 0 && index < content.stats!.length - 1
                                    ? 'border-y md:border-y-0 md:border-x border-white/20 py-8 md:py-0'
                                    : ''
                                    }`}
                            >
                                <span className="text-5xl font-black">{stat.value}</span>
                                <span className="text-white/80 text-sm uppercase tracking-widest font-bold">
                                    {stat.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Team Section */}
            {content.team && content.team.length > 0 && (
                <section className="py-24 bg-white dark:bg-background-dark">
                    <div className="max-w-[1200px] mx-auto px-6">
                        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                            <div>
                                <h2 className="text-4xl font-black tracking-tight mb-4">El Equipo</h2>
                                <p className="text-[#60708a] dark:text-gray-400 text-lg">
                                    Las caras detrás de la magia que hacen esto posible.
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={prevTeamMember}
                                    disabled={currentTeamIndex === 0}
                                    className="size-12 rounded-full border border-gray-200 dark:border-gray-800 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="material-symbols-outlined">chevron_left</span>
                                </button>
                                <button
                                    onClick={nextTeamMember}
                                    disabled={currentTeamIndex >= content.team.length - 1}
                                    className="size-12 rounded-full border border-gray-200 dark:border-gray-800 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-8 overflow-x-auto pb-8 snap-x no-scrollbar">
                            {content.team.map((member, index) => (
                                <div key={index} className="min-w-[300px] flex-1 snap-start group">
                                    <div className="aspect-[4/5] bg-gray-200 dark:bg-gray-800 rounded-xl mb-6 overflow-hidden relative">
                                        {member.image && (
                                            <img
                                                alt={member.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                src={member.image}
                                            />
                                        )}
                                        {member.email && (
                                            <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                                <a href={`mailto:${member.email}`}>
                                                    <span className="material-symbols-outlined text-white text-3xl cursor-pointer">
                                                        alternate_email
                                                    </span>
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                    <h4 className="text-xl font-bold">{member.name}</h4>
                                    <p className="font-medium text-sm" style={{ color: primaryColor }}>{member.role}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* CTA Final */}
            {content.cta && (
                <section className="py-24 px-6">
                    <div className="max-w-[1000px] mx-auto bg-white dark:bg-gray-800 rounded-3xl p-12 md:p-20 text-center border border-[#f0f2f5] dark:border-gray-700 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: primaryColor }} />
                        <div className="relative z-10 flex flex-col gap-6 items-center">
                            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-[#111418] dark:text-white">
                                {content.cta.title}
                            </h2>
                            <p className="text-lg md:text-xl text-[#60708a] dark:text-gray-400 max-w-xl mx-auto">
                                {content.cta.description}
                            </p>
                            <a
                                href={whatsappNumber ? `https://wa.me/${whatsappNumber.replace(/\D/g, '')}` : '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white px-10 py-4 rounded-xl text-lg font-bold transition-all shadow-lg flex items-center gap-3 mt-4"
                                style={{ backgroundColor: primaryColor }}
                            >
                                <span className="material-symbols-outlined">chat_bubble</span>
                                {content.cta.buttonText}
                            </a>
                        </div>
                    </div>
                </section>
            )}

            {/* Footer Link */}
            <div className="mt-8 pb-12 flex justify-center">
                <a
                    className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors font-medium text-sm group"
                    href="/"
                >
                    <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">
                        arrow_back
                    </span>
                    Volver a la tienda
                </a>
            </div>
        </main>
    )
}
