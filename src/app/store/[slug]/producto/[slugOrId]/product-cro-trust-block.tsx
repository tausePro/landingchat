"use client"

import type { ProductDetailCROConfig } from "@/lib/storefront/product-detail-cro"

export function ProductCROTrustBlock({ trust, primaryColor }: { trust: NonNullable<ProductDetailCROConfig["trust"]>; primaryColor: string }) {
    const items = [
        trust.guaranteeText ? { id: "guarantee", icon: "verified_user", text: trust.guaranteeText } : null,
        trust.paymentMethodsText ? { id: "payments", icon: "payments", text: trust.paymentMethodsText } : null,
        trust.securePaymentText ? { id: "secure-payment", icon: "lock", text: trust.securePaymentText } : null,
    ].filter((item): item is { id: string; icon: string; text: string } => Boolean(item))

    if (items.length === 0) return null

    return (
        <div className="mt-3 grid gap-2">
            {items.map((item) => (
                <div key={item.id} className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[12.5px] font-semibold leading-5 text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
                    <span className="material-symbols-outlined mt-0.5 text-[18px]" style={{ color: primaryColor }}>{item.icon}</span>
                    <span>{item.text}</span>
                </div>
            ))}
        </div>
    )
}
