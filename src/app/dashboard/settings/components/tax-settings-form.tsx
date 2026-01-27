"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { Organization, organizationDetailsSchema } from "@/types/organization"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

const taxFormSchema = z.object({
    tax_enabled: z.boolean().default(false),
    tax_rate: z.coerce.number().min(0).max(100).default(0),
    prices_include_tax: z.boolean().default(false),
})

type TaxFormValues = z.infer<typeof taxFormSchema>

interface TaxSettingsFormProps {
    organization: Organization
}

export function TaxSettingsForm({ organization }: TaxSettingsFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const form = useForm<TaxFormValues>({
        resolver: zodResolver(taxFormSchema) as any,
        defaultValues: {
            tax_enabled: organization.tax_enabled || false,
            tax_rate: organization.tax_rate || 0,
            prices_include_tax: organization.prices_include_tax || false,
        },
    })

    const taxEnabled = form.watch("tax_enabled")

    async function onSubmit(data: TaxFormValues) {
        setLoading(true)
        try {
            const supabase = createClient()

            const { error } = await supabase
                .from("organizations")
                .update({
                    tax_enabled: data.tax_enabled,
                    tax_rate: data.tax_rate,
                    prices_include_tax: data.prices_include_tax,
                })
                .eq("id", organization.id)

            if (error) throw error

            toast.success("Configuración de impuestos guardada")
            router.refresh()
        } catch (error) {
            console.error("Error updating tax settings:", error)
            toast.error("Error al guardar la configuración")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Configuración de Impuestos</CardTitle>
                <CardDescription>
                    Define cómo se calculan los impuestos en tu tienda.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="tax_enabled"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Habilitar Impuestos</FormLabel>
                                        <FormDescription>
                                            Activa el cálculo de impuestos automáticos en el checkout.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        {taxEnabled && (
                            <div className="space-y-6 pl-4 border-l-2 border-slate-200 dark:border-slate-800 ml-2 animate-in slide-in-from-top-2">
                                <FormField
                                    control={form.control}
                                    name="tax_rate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tasa de Impuesto General (%)</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max="100"
                                                        placeholder="19"
                                                        {...field}
                                                        className="pl-8"
                                                    />
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                                                        %
                                                    </span>
                                                </div>
                                            </FormControl>
                                            <FormDescription>
                                                Este porcentaje se aplicará a todos los productos por defecto (ej. IVA 19%).
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="prices_include_tax"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-slate-50 dark:bg-slate-900/50">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base">Los precios ya incluyen impuesto</FormLabel>
                                                <FormDescription>
                                                    Si activas esto, el sistema calculará el impuesto extrayéndolo del precio final.
                                                    <br />
                                                    <span className="text-xs text-slate-500">Ej: Si vendes a $119.000 con 19%, el sistema registrará Base: $100.000 + IVA: $19.000.</span>
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

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
