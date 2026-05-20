"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Banknote, Truck, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
    getManualPaymentMethods,
    saveManualPaymentMethods,
    getOrganizationLocaleContext,
} from "../actions"
import type { ManualPaymentMethodsInput } from "@/types"
import {
    DEFAULT_TENANT_LOCALE,
    type TenantLocaleContext,
} from "@/lib/i18n/tenant-locale"
import { getCountryProfile } from "@/lib/i18n/country-profiles"
import { getBanksForCountry } from "@/lib/constants/banks"
import { t } from "@/lib/i18n/storefront-strings"
import { formatCurrency } from "@/lib/utils"

const SENTINEL_OTHER_BANK = "__other__"

/**
 * Form de configuración de pagos manuales para el dashboard.
 *
 * T1.5 — Country-aware: la lista de bancos, los tipos de cuenta y el formato
 * del costo COD se ajustan al `country_code` de la organization actual.
 * Tenants CO ven bancos colombianos + Ahorros/Corriente; tenants US ven
 * bancos estadounidenses + Checking/Savings.
 *
 * Idioma del form: el dashboard de LandingChat se opera en español por
 * default. Para tenants en inglés (Tantor's House) usamos el `locale` del
 * tenant para resolver `t()` directo (no via provider porque este form
 * vive fuera del `TenantLocaleProvider` del storefront).
 */
export function ManualPaymentForm() {
    // Locale + currency + country del tenant. Se carga al montar; mientras
    // tanto usamos el default seguro CO/COP/es-CO para no flashar.
    const [tenantLocale, setTenantLocale] = useState<TenantLocaleContext>(DEFAULT_TENANT_LOCALE)
    const profile = getCountryProfile(tenantLocale.country)
    const banks = getBanksForCountry(tenantLocale.country)
    const tt = (key: Parameters<typeof t>[0], params?: Parameters<typeof t>[2]) =>
        t(key, tenantLocale.locale, params)

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [config, setConfig] = useState<ManualPaymentMethodsInput>({
        bank_transfer_enabled: false,
        bank_name: "",
        account_type: profile.defaultAccountType as ManualPaymentMethodsInput["account_type"],
        account_number: "",
        account_holder: "",
        nequi_number: "",
        instant_payment_label: "",
        instant_payment_value: "",
        instructions: "",
        cod_enabled: false,
        cod_additional_cost: 0,
        cod_zones: [],
    })
    /** Si el banco actual no está en la lista del país, mostramos input de texto libre. */
    const [bankIsOther, setBankIsOther] = useState(false)

    // Carga inicial: locale del tenant + config existente (paralelo).
    useEffect(() => {
        Promise.all([getOrganizationLocaleContext(), getManualPaymentMethods()])
            .then(([localeResult, configResult]) => {
                if (localeResult.success && localeResult.data) {
                    setTenantLocale(localeResult.data)
                }
                if (configResult.success && configResult.data) {
                    const data = configResult.data
                    setConfig({
                        bank_transfer_enabled: data.bank_transfer_enabled,
                        bank_name: data.bank_name ?? "",
                        account_type: data.account_type ?? undefined,
                        account_number: data.account_number ?? "",
                        account_holder: data.account_holder ?? "",
                        nequi_number: data.nequi_number ?? "",
                        instant_payment_label: data.instant_payment_label ?? "",
                        instant_payment_value: data.instant_payment_value ?? "",
                        instructions: data.instructions ?? "",
                        cod_enabled: data.cod_enabled,
                        cod_additional_cost: data.cod_additional_cost,
                        cod_zones: data.cod_zones,
                    })
                    // Si el banco guardado no está en la lista del país, asumimos
                    // que el merchant lo escribió como "Otro" en su momento.
                    if (
                        data.bank_name &&
                        !getBanksForCountry(
                            localeResult.success ? localeResult.data.country : "CO",
                        ).includes(data.bank_name)
                    ) {
                        setBankIsOther(true)
                    }
                }
            })
            .finally(() => setLoading(false))
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            const result = await saveManualPaymentMethods(config)
            if (result.success) {
                toast.success(tt("dashboard.payments.toast_save_success"))
            } else {
                toast.error(result.error || tt("dashboard.payments.toast_save_error"))
            }
        } catch {
            toast.error(tt("dashboard.payments.toast_save_error"))
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    {tt("dashboard.payments.manual_card_title")}
                </CardTitle>
                <CardDescription>{tt("dashboard.payments.manual_card_description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* Bank Transfer */}
                <section className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <Banknote className="h-4 w-4" />
                                {tt("dashboard.payments.bank_transfer_title")}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                {tt("dashboard.payments.bank_transfer_description")}
                            </p>
                        </div>
                        <Switch
                            checked={config.bank_transfer_enabled}
                            onCheckedChange={(v) =>
                                setConfig((prev) => ({ ...prev, bank_transfer_enabled: v }))
                            }
                        />
                    </div>

                    {config.bank_transfer_enabled && (
                        <div className="space-y-4 pl-6 border-l-2 border-slate-100 dark:border-slate-800">
                            {/* Bank */}
                            <div className="grid gap-2">
                                <Label>{tt("dashboard.payments.bank_label")}</Label>
                                <Select
                                    value={
                                        bankIsOther
                                            ? SENTINEL_OTHER_BANK
                                            : config.bank_name || ""
                                    }
                                    onValueChange={(value) => {
                                        if (value === SENTINEL_OTHER_BANK) {
                                            setBankIsOther(true)
                                            setConfig((prev) => ({ ...prev, bank_name: "" }))
                                        } else {
                                            setBankIsOther(false)
                                            setConfig((prev) => ({ ...prev, bank_name: value }))
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue
                                            placeholder={tt("dashboard.payments.bank_select_placeholder")}
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {banks.map((bank) => (
                                            <SelectItem key={bank} value={bank}>
                                                {bank}
                                            </SelectItem>
                                        ))}
                                        <SelectItem value={SENTINEL_OTHER_BANK}>
                                            {tt("dashboard.payments.bank_other_option")}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                {bankIsOther && (
                                    <Input
                                        value={config.bank_name || ""}
                                        onChange={(e) =>
                                            setConfig((prev) => ({ ...prev, bank_name: e.target.value }))
                                        }
                                        placeholder={tt("dashboard.payments.bank_other_option")}
                                    />
                                )}
                            </div>

                            {/* Account Type */}
                            <div className="grid gap-2">
                                <Label>{tt("dashboard.payments.account_type_label")}</Label>
                                <Select
                                    value={config.account_type || ""}
                                    onValueChange={(value) =>
                                        setConfig((prev) => ({
                                            ...prev,
                                            account_type: value as ManualPaymentMethodsInput["account_type"],
                                        }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {profile.accountTypes.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {tt(opt.labelKey)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Account Number */}
                            <div className="grid gap-2">
                                <Label htmlFor="account_number">
                                    {tt("dashboard.payments.account_number_label")}
                                </Label>
                                <Input
                                    id="account_number"
                                    value={config.account_number || ""}
                                    onChange={(e) =>
                                        setConfig((prev) => ({ ...prev, account_number: e.target.value }))
                                    }
                                    placeholder={tt("dashboard.payments.account_number_placeholder")}
                                />
                            </div>

                            {/* Account Holder */}
                            <div className="grid gap-2">
                                <Label htmlFor="account_holder">
                                    {tt("dashboard.payments.account_holder_label")}
                                </Label>
                                <Input
                                    id="account_holder"
                                    value={config.account_holder || ""}
                                    onChange={(e) =>
                                        setConfig((prev) => ({ ...prev, account_holder: e.target.value }))
                                    }
                                    placeholder={tt("dashboard.payments.account_holder_placeholder")}
                                />
                            </div>

                            {/* Instant Payment (Zelle, Nequi, CashApp, etc.) */}
                            <div className="grid gap-2 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                                <Label>{tt("dashboard.payments.instant_payment_label_field")}</Label>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {tt("dashboard.payments.instant_payment_help")}
                                </p>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <Input
                                        value={config.instant_payment_label || ""}
                                        onChange={(e) =>
                                            setConfig((prev) => ({
                                                ...prev,
                                                instant_payment_label: e.target.value,
                                            }))
                                        }
                                        placeholder={tt("dashboard.payments.instant_payment_label_placeholder")}
                                    />
                                    <Input
                                        value={config.instant_payment_value || ""}
                                        onChange={(e) =>
                                            setConfig((prev) => ({
                                                ...prev,
                                                instant_payment_value: e.target.value,
                                            }))
                                        }
                                        placeholder={tt("dashboard.payments.instant_payment_value_placeholder")}
                                    />
                                </div>
                            </div>

                            {/* Instructions textarea */}
                            <div className="grid gap-2">
                                <Label htmlFor="instructions">
                                    {tt("dashboard.payments.instructions_label")}
                                </Label>
                                <Textarea
                                    id="instructions"
                                    value={config.instructions || ""}
                                    onChange={(e) =>
                                        setConfig((prev) => ({ ...prev, instructions: e.target.value }))
                                    }
                                    placeholder={tt("dashboard.payments.instructions_placeholder")}
                                    rows={4}
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {tt("dashboard.payments.instructions_help")}
                                </p>
                            </div>
                        </div>
                    )}
                </section>

                {/* Cash on Delivery */}
                <section className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <Truck className="h-4 w-4" />
                                {tt("dashboard.payments.cod_title")}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                {tt("dashboard.payments.cod_description")}
                            </p>
                        </div>
                        <Switch
                            checked={config.cod_enabled}
                            onCheckedChange={(v) =>
                                setConfig((prev) => ({ ...prev, cod_enabled: v }))
                            }
                        />
                    </div>

                    {config.cod_enabled && (
                        <div className="space-y-4 pl-6 border-l-2 border-slate-100 dark:border-slate-800">
                            <div className="grid gap-2">
                                <Label htmlFor="cod_additional_cost">
                                    {tt("dashboard.payments.cod_additional_cost_label")}{" "}
                                    <span className="text-xs text-slate-400">
                                        ({formatCurrency(config.cod_additional_cost, {
                                            locale: tenantLocale.locale,
                                            currency: tenantLocale.currency,
                                        })})
                                    </span>
                                </Label>
                                <Input
                                    id="cod_additional_cost"
                                    type="number"
                                    min={0}
                                    value={config.cod_additional_cost}
                                    onChange={(e) =>
                                        setConfig((prev) => ({
                                            ...prev,
                                            cod_additional_cost: Math.max(0, parseInt(e.target.value, 10) || 0),
                                        }))
                                    }
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {tt("dashboard.payments.cod_additional_cost_help")}
                                </p>
                            </div>
                        </div>
                    )}
                </section>

                {/* Save */}
                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {tt("dashboard.payments.saving_btn")}
                            </>
                        ) : (
                            tt("dashboard.payments.save_btn")
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
