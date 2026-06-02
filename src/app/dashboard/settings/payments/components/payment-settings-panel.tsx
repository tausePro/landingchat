"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { PaymentMethodsHub, type PaymentView } from "./payment-methods-hub"
import { WompiSettings } from "@/app/dashboard/settings/wompi/components/wompi-settings"
import { EpaycoSettings } from "@/app/dashboard/settings/epayco/components/epayco-settings"
import { BoldSettings } from "@/app/dashboard/settings/bold/components/bold-settings"
import { ManualPaymentForm } from "./manual-payment-form"

export function PaymentSettingsPanel() {
    const [activeView, setActiveView] = useState<PaymentView>("hub")

    if (activeView === "hub") {
        return <PaymentMethodsHub onConfigure={setActiveView} />
    }

    return (
        <div className="space-y-4">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveView("hub")}
                className="gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
                <ArrowLeft className="h-4 w-4" />
                Volver a Medios de Pago
            </Button>

            {activeView === "wompi" && <WompiSettings />}
            {activeView === "epayco" && <EpaycoSettings />}
            {activeView === "bold" && <BoldSettings />}
            {activeView === "manual" && <ManualPaymentForm />}
        </div>
    )
}
