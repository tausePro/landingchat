"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function MetaAdsCard() {
    return (
        <Card className="relative overflow-hidden">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-500">campaign</span>
                    Meta Ads
                    <span className="ml-2 text-xs font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        Próximamente
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                    <span className="material-symbols-outlined text-5xl mb-3 block text-blue-300">insights</span>
                    <p className="font-medium text-lg">Integración con Meta Ads</p>
                    <p className="text-sm mt-2 max-w-md mx-auto">
                        Pronto podrás ver el rendimiento de tus campañas publicitarias de Facebook e Instagram directamente aquí.
                    </p>
                    <div className="mt-6 flex justify-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <span className="material-symbols-outlined text-base">visibility</span>
                            Impresiones
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <span className="material-symbols-outlined text-base">ads_click</span>
                            Clics
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <span className="material-symbols-outlined text-base">payments</span>
                            Inversión
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
