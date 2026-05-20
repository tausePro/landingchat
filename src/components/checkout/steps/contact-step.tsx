"use client"

import type { ChangeEvent, FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useT, useTenantCountry } from "@/lib/i18n/use-tenant-strings"
import { getCountryProfile } from "@/lib/i18n/country-profiles"
import type { CheckoutFormData } from "../types"

interface ShippingAvailability {
    available: boolean
    cost: number
    message?: string
}

interface ContactStepProps {
    formData: CheckoutFormData
    shippingAvailability: ShippingAvailability
    onInputChange: (e: ChangeEvent<HTMLInputElement>) => void
    onSelectChange: (name: string, value: string) => void
    onSubmit: (e: FormEvent) => void
}

/**
 * Step 1 del checkout: datos personales, facturación y dirección de envío.
 *
 * Componente "controlado" — todos los handlers vienen del parent
 * (checkout-flow.tsx). Esto permite mantener el state en un sólo lugar
 * y validar/persistir desde el orquestador.
 */
export function ContactStep({
    formData,
    shippingAvailability,
    onInputChange,
    onSelectChange,
    onSubmit,
}: ContactStepProps) {
    const t = useT()
    // T1.4 — Forms country-aware. El profile depende del country del tenant
    // (CO/US). Tantor's House (US) muestra +1, SSN/EIN, US states, person
    // type "Individual/Business". Tenants legacy quedan en CO defaults.
    const country = useTenantCountry()
    const profile = getCountryProfile(country)
    return (
        <form onSubmit={onSubmit} className="grid gap-4 py-4 lg:grid-cols-2 lg:items-start">
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-sm text-blue-800 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-200 lg:col-span-2">
                {t("store.checkout.contact_disclaimer")}
            </div>

            <div className="space-y-4">
                <div className="grid gap-2">
                    <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t("store.checkout.contact_name_label")}
                    </Label>
                    <Input
                        id="name"
                        name="name"
                        required
                        autoComplete="name"
                        value={formData.name}
                        onChange={onInputChange}
                        placeholder={t("store.checkout.contact_name_placeholder")}
                        className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t("store.checkout.contact_email_label")} <span className="text-gray-400 text-xs font-normal">{t("store.checkout.contact_email_optional")}</span>
                    </Label>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={formData.email}
                        onChange={onInputChange}
                        placeholder={t("store.checkout.contact_email_placeholder")}
                        className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t("store.checkout.contact_phone_label")}
                    </Label>
                    <div className="flex">
                        <div className="inline-flex items-center justify-center px-4 rounded-l-xl border border-r-0 border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium">
                            {profile.phoneFlag} {profile.phonePrefix}
                        </div>
                        <Input
                            id="phone"
                            name="phone"
                            type="tel"
                            required
                            autoComplete="tel-national"
                            inputMode="tel"
                            value={formData.phone}
                            onChange={onInputChange}
                            placeholder={t(profile.phonePlaceholderKey)}
                            className="flex-1 h-12 rounded-l-none rounded-r-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Tax/Invoicing Fields */}
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary dark:text-primary-dark mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">receipt_long</span> {t("store.checkout.billing_section_title")}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("store.checkout.billing_section_subtitle")}
                </p>

                <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                        {t("store.checkout.billing_document_label")}
                    </Label>
                    <div className="flex gap-2">
                        <Select value={formData.document_type} onValueChange={(value) => onSelectChange("document_type", value)}>
                            <SelectTrigger className="w-28 h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-lg z-50">
                                {profile.documentTypes.map((opt) => (
                                    <SelectItem
                                        key={opt.value}
                                        value={opt.value}
                                        className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                                    >
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input
                            id="document_number"
                            name="document_number"
                            required
                            autoComplete="off"
                            inputMode="numeric"
                            value={formData.document_number}
                            onChange={onInputChange}
                            placeholder={t(profile.documentNumberPlaceholderKey)}
                            className="flex-1 h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    {profile.personTypeOptions.map((opt) => (
                        <label
                            key={opt.value}
                            className={cn(
                                "relative flex items-center p-3 rounded-xl border cursor-pointer transition-all shadow-sm hover:border-primary dark:hover:border-primary",
                                formData.person_type === opt.value
                                    ? "border-primary bg-blue-50 dark:bg-blue-900/20"
                                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50",
                            )}
                            onClick={() => onSelectChange("person_type", opt.value)}
                        >
                            <input
                                type="radio"
                                name="person_type"
                                checked={formData.person_type === opt.value}
                                onChange={() => { }}
                                className="form-radio text-primary focus:ring-primary h-5 w-5 border-gray-300"
                            />
                            <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-primary">
                                {t(opt.labelKey)}
                            </span>
                        </label>
                    ))}
                </div>

                {formData.person_type === "Jurídica" && (
                    <div className="grid gap-2">
                        <Label htmlFor="business_name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t("store.checkout.billing_business_name_label")}
                        </Label>
                        <Input
                            id="business_name"
                            name="business_name"
                            value={formData.business_name}
                            onChange={onInputChange}
                            placeholder={t("store.checkout.billing_business_name_placeholder")}
                            className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                        />
                    </div>
                )}
            </div>

            <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">{t("store.checkout.location_label")}</Label>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                    {t("store.checkout.location_subtitle")}
                </p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <Select value={formData.state} onValueChange={(value) => onSelectChange("state", value)}>
                        <SelectTrigger className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm">
                            <SelectValue placeholder={t(profile.statePlaceholderKey)} />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-lg z-50">
                            {profile.states.map((state) => (
                                <SelectItem
                                    key={state}
                                    value={state}
                                    className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800 cursor-pointer px-3 py-2"
                                >
                                    {state}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        id="city"
                        name="city"
                        required
                        autoComplete="address-level2"
                        value={formData.city}
                        onChange={onInputChange}
                        placeholder={t(profile.cityPlaceholderKey)}
                        className={cn(
                            "h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm",
                            !shippingAvailability.available && formData.city && "border-red-400 dark:border-red-500",
                        )}
                    />
                </div>
                {!shippingAvailability.available && formData.city && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                        <span className="material-symbols-outlined text-amber-500 text-lg mt-0.5">local_shipping</span>
                        <p className="text-sm text-amber-700 dark:text-amber-300">{shippingAvailability.message}</p>
                    </div>
                )}
                <Input
                    id="address"
                    name="address"
                    required
                    autoComplete="street-address"
                    value={formData.address}
                    onChange={onInputChange}
                    placeholder={t(profile.addressPlaceholderKey)}
                    className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                />
            </div>

            <div className="pt-4 space-y-3 lg:col-span-2">
                <Button type="submit" className="w-full h-12 rounded-xl bg-primary text-white hover:bg-primary/90 font-bold">
                    {t("store.checkout.contact_submit_cta")}
                </Button>
                <div className="flex items-center justify-center gap-2 text-slate-400 opacity-80">
                    <span className="material-symbols-outlined text-base text-green-500">lock</span>
                    <span className="text-xs font-medium">{t("store.checkout.contact_data_disclaimer")}</span>
                </div>
            </div>
        </form>
    )
}
