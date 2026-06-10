"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
    CURRENCY_OPTIONS,
    LOCALE_OPTIONS,
    COUNTRY_OPTIONS,
    localeSettingsSchema,
    type LocaleSettingsInput,
} from "@/lib/i18n/locale-settings"
import { updateOrganizationLocale } from "../actions"

interface LocaleDialogProps {
    organizationId: string
    organizationName: string
    /** Valores actuales de la org (caen al default COP/es-CO/CO si faltan). */
    currentCurrency?: string
    currentLocale?: string
    currentCountry?: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

/**
 * Dialog del superadmin para cambiar moneda/idioma/país de una organización.
 *
 * Fase 1 i18n (single-locale-per-tenant): el cambio NO convierte precios;
 * los precios existentes se interpretan en la nueva moneda.
 *
 * Usado desde `admin/organizations`: dropdown de acciones por org.
 */
export function LocaleDialog({
    organizationId,
    organizationName,
    currentCurrency,
    currentLocale,
    currentCountry,
    open,
    onOpenChange,
    onSuccess,
}: LocaleDialogProps) {
    const [values, setValues] = useState<LocaleSettingsInput>(() => normalize())
    const [submitting, setSubmitting] = useState(false)

    function normalize(): LocaleSettingsInput {
        const parsed = localeSettingsSchema.safeParse({
            currency_code: currentCurrency,
            locale: currentLocale,
            country_code: currentCountry,
        })
        return parsed.success
            ? parsed.data
            : { currency_code: "COP", locale: "es-CO", country_code: "CO" }
    }

    // Re-sincronizar con los valores de la org cada vez que se abre el dialog.
    useEffect(() => {
        if (open) setValues(normalize())
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, currentCurrency, currentLocale, currentCountry])

    const handleSave = async () => {
        setSubmitting(true)
        try {
            const result = await updateOrganizationLocale(organizationId, values)
            if (result.success) {
                toast.success(`Idioma y moneda de "${organizationName}" actualizados`)
                onOpenChange(false)
                onSuccess?.()
            } else {
                toast.error(result.error)
            }
        } catch {
            toast.error("Error inesperado al guardar")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Idioma y moneda</DialogTitle>
                    <DialogDescription>
                        Configura la localización de <span className="font-medium">{organizationName}</span>.
                        Cambiar la moneda no convierte los precios: los precios existentes se
                        interpretan en la nueva moneda.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Moneda</Label>
                        <Select
                            value={values.currency_code}
                            onValueChange={(v) =>
                                setValues((prev) => ({ ...prev, currency_code: v as LocaleSettingsInput["currency_code"] }))
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CURRENCY_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Idioma</Label>
                        <Select
                            value={values.locale}
                            onValueChange={(v) =>
                                setValues((prev) => ({ ...prev, locale: v as LocaleSettingsInput["locale"] }))
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {LOCALE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>País</Label>
                        <Select
                            value={values.country_code}
                            onValueChange={(v) =>
                                setValues((prev) => ({ ...prev, country_code: v as LocaleSettingsInput["country_code"] }))
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {COUNTRY_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            El país define los formularios de checkout (documentos, teléfono, estados).
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={submitting}>
                        {submitting ? "Guardando..." : "Guardar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
