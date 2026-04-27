"use client"

import Image from "next/image"
import { useState, useTransition } from "react"
import { ImageIcon, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { MediaSelectorModal } from "@/app/dashboard/media/components/MediaSelectorModal"
import { savePaymentGatewayBranding } from "../actions"
import type { PaymentProvider } from "@/types"

interface PaymentBrandingSelectorProps {
    provider: PaymentProvider
    providerName: string
    initialLogoUrl?: string | null
}

export function PaymentBrandingSelector({
    provider,
    providerName,
    initialLogoUrl,
}: PaymentBrandingSelectorProps) {
    const [logoUrl, setLogoUrl] = useState(initialLogoUrl || "")
    const [selectorOpen, setSelectorOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    const saveLogo = (nextLogoUrl: string) => {
        startTransition(async () => {
            const result = await savePaymentGatewayBranding({
                provider,
                logo_url: nextLogoUrl || null,
            })

            if (result.success) {
                setLogoUrl(nextLogoUrl)
                toast.success("Logo actualizado")
            } else {
                toast.error(result.error || "No se pudo guardar el logo")
            }
        })
    }

    return (
        <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <Label>Logo visible en checkout</Label>
                    <p className="text-sm text-slate-500">
                        Selecciona una imagen de tu biblioteca para mostrar {providerName} con marca visual en el checkout.
                    </p>
                </div>
                <div className="flex h-14 w-28 items-center justify-center rounded-lg border bg-white p-2 dark:bg-slate-950">
                    {logoUrl ? (
                        <Image
                            src={logoUrl}
                            alt={`Logo de ${providerName}`}
                            width={96}
                            height={40}
                            className="max-h-10 w-auto object-contain"
                        />
                    ) : (
                        <ImageIcon className="h-6 w-6 text-slate-400" />
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectorOpen(true)}
                    disabled={isPending}
                >
                    {logoUrl ? "Cambiar logo" : "Seleccionar logo"}
                </Button>
                {logoUrl && (
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => saveLogo("")}
                        disabled={isPending}
                        className="gap-2 text-red-600 hover:text-red-700"
                    >
                        <Trash2 className="h-4 w-4" />
                        Quitar logo
                    </Button>
                )}
            </div>

            <MediaSelectorModal
                open={selectorOpen}
                onClose={() => setSelectorOpen(false)}
                onSelect={(urls) => saveLogo(urls[0] || "")}
                multiple={false}
                selectedUrls={logoUrl ? [logoUrl] : []}
                acceptTypes={["image"]}
            />
        </div>
    )
}
