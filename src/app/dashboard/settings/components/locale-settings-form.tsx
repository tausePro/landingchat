"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import {
    CURRENCY_OPTIONS,
    LOCALE_OPTIONS,
    COUNTRY_OPTIONS,
    localeSettingsSchema,
    type LocaleSettingsInput,
} from "@/lib/i18n/locale-settings"
import { updateLocaleSettings } from "../actions"

interface LocaleSettingsFormProps {
    /** Valores actuales de la org (normalizados al default si faltan o son inválidos). */
    currency_code?: string
    locale?: string
    country_code?: string
}

/**
 * Form del dueño para configurar moneda/idioma/país de su tienda
 * (Fase 1 i18n — single-locale-per-tenant).
 */
export function LocaleSettingsForm({ currency_code, locale, country_code }: LocaleSettingsFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const parsed = localeSettingsSchema.safeParse({ currency_code, locale, country_code })
    const defaults: LocaleSettingsInput = parsed.success
        ? parsed.data
        : { currency_code: "COP", locale: "es-CO", country_code: "CO" }

    const form = useForm<LocaleSettingsInput>({
        resolver: zodResolver(localeSettingsSchema),
        defaultValues: defaults,
    })

    async function onSubmit(data: LocaleSettingsInput) {
        setLoading(true)
        try {
            const result = await updateLocaleSettings(data)
            if (result.success) {
                toast.success("Idioma y moneda guardados")
                router.refresh()
            } else {
                toast.error(result.error)
            }
        } catch {
            toast.error("Error inesperado al guardar")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Idioma y Moneda</CardTitle>
                <CardDescription>
                    Define el idioma, la moneda y el país de tu tienda. Aplica al storefront,
                    al chat, al checkout y a los correos.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="currency_code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Moneda</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {CURRENCY_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        Cambiar la moneda no convierte los precios: tus precios actuales se
                                        interpretarán en la nueva moneda. Revísalos después de cambiarla.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="locale"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Idioma</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {LOCALE_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        Idioma de la tienda pública y del agente AI del chat.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="country_code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>País</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {COUNTRY_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        Define los formularios del checkout (tipo de documento, teléfono, estados).
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end">
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Cambios
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
