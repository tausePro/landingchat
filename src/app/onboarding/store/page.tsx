"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProgressBar } from "@/components/onboarding/progress-bar"
import { LogoUploader } from "@/components/onboarding/logo-uploader"
import { updateOrganizationDetails } from "../actions"

export default function StoreConfigPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: "",
        subdomain: "",
        contactEmail: "",
        industry: "",
        logoUrl: ""
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            await updateOrganizationDetails(formData)
            router.push("/onboarding/agent")
        } catch (error) {
            console.error("Error updating organization:", error)
            alert("Error al guardar. Intenta de nuevo.")
        } finally {
            setLoading(false)
        }
    }

    const handleSkip = () => {
        router.push("/onboarding/agent")
    }

    return (
        <>
            <ProgressBar currentStep={1} totalSteps={4} stepLabel="Configuración de Tienda" />

            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight sm:text-4xl">
                    Bienvenido a LandingChat. Comencemos con lo básico.
                </h1>
                <p className="text-base font-normal text-slate-600 dark:text-slate-400">
                    Completa la información de tu empresa para personalizar tu espacio de trabajo.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                {/* Store Name & Subdomain */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <label className="flex flex-col gap-2">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            Nombre de la Tienda
                        </p>
                        <Input
                            placeholder="Este nombre verán tus clientes"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </label>
                    <label className="flex flex-col gap-2">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            Elige tu URL
                        </p>
                        <div className="flex items-center rounded-lg border border-slate-300 bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 dark:border-slate-600 dark:bg-slate-800">
                            <input
                                className="form-input h-12 w-full flex-1 rounded-l-lg border-0 bg-transparent px-3 py-2 text-base font-normal text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 dark:text-white"
                                placeholder="tu-tienda"
                                value={formData.subdomain}
                                onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                                required
                            />
                            <span className="whitespace-nowrap pr-3 text-sm text-slate-500 dark:text-slate-400">
                                .landingchat.co
                            </span>
                        </div>
                    </label>
                </div>

                {/* Logo Uploader */}
                <LogoUploader
                    organizationId="temp-org-id" // TODO: Get from auth context
                    onUploadComplete={(url) => setFormData({ ...formData, logoUrl: url })}
                />

                {/* Contact Email & Industry */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <label className="flex flex-col gap-2">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            Email de Contacto
                        </p>
                        <Input
                            type="email"
                            placeholder="ejemplo@tuempresa.com"
                            value={formData.contactEmail}
                            onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                            required
                        />
                    </label>
                    <div className="flex flex-col gap-2">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            Sector de tu Negocio
                        </p>
                        <select
                            className="form-select h-12 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-normal text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            value={formData.industry}
                            onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                            required
                        >
                            <option value="">Selecciona una opción</option>
                            <option value="ecommerce">E-commerce</option>
                            <option value="saas">Tecnología / SaaS</option>
                            <option value="services">Servicios Profesionales</option>
                            <option value="education">Educación</option>
                            <option value="other">Otro</option>
                        </select>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col items-center gap-4 border-t border-slate-200 pt-6 dark:border-slate-700 sm:flex-row-reverse">
                    <Button type="submit" disabled={loading} className="w-full sm:w-auto h-12 px-6">
                        {loading ? "Guardando..." : "Guardar y Continuar"}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={handleSkip}
                        className="w-full sm:w-auto h-12 px-6 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                        Omitir por ahora
                    </Button>
                </div>
            </form>
        </>
    )
}
