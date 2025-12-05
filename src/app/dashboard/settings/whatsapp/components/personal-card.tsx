"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Bell, Phone } from "lucide-react"
import { connectPersonalWhatsApp, updateNotificationSettings } from "../actions"
import { toast } from "sonner"
import type { WhatsAppInstance } from "@/types"

interface PersonalCardProps {
    instance: WhatsAppInstance | null
    onUpdate: () => void
}

export function PersonalCard({ instance, onUpdate }: PersonalCardProps) {
    const [phoneNumber, setPhoneNumber] = useState("")
    const [isConnecting, setIsConnecting] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const [notifyOnSale, setNotifyOnSale] = useState(
        instance?.notify_on_sale ?? true
    )
    const [notifyOnLowStock, setNotifyOnLowStock] = useState(
        instance?.notify_on_low_stock ?? false
    )
    const [notifyOnNewConversation, setNotifyOnNewConversation] = useState(
        instance?.notify_on_new_conversation ?? false
    )

    const isConnected = instance?.status === "connected"

    const handleConnect = async () => {
        if (!phoneNumber.trim()) {
            toast.error("Ingresa tu número de WhatsApp")
            return
        }

        setIsConnecting(true)
        try {
            const result = await connectPersonalWhatsApp(phoneNumber)
            if (result.success) {
                toast.success("WhatsApp personal conectado")
                setPhoneNumber("")
                onUpdate()
            } else {
                toast.error(result.error || "Error al conectar")
            }
        } catch (error) {
            toast.error("Error al conectar WhatsApp personal")
        } finally {
            setIsConnecting(false)
        }
    }

    const handleSaveSettings = async () => {
        setIsSaving(true)
        try {
            const result = await updateNotificationSettings({
                notify_on_sale: notifyOnSale,
                notify_on_low_stock: notifyOnLowStock,
                notify_on_new_conversation: notifyOnNewConversation,
            })

            if (result.success) {
                toast.success("Configuración guardada")
                onUpdate()
            } else {
                toast.error(result.error || "Error al guardar")
            }
        } catch (error) {
            toast.error("Error al guardar configuración")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader>
                <div className="flex gap-3">
                    <Bell className="h-6 w-6 text-gray-700 dark:text-gray-300 mt-0.5" />
                    <div>
                        <CardTitle className="text-xl font-bold">
                            WhatsApp Personal (Notificaciones)
                        </CardTitle>
                        <CardDescription className="text-sm mt-1">
                            Recibe notificaciones importantes en tu WhatsApp personal
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {!isConnected ? (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone" className="text-sm font-medium">
                                Número de WhatsApp
                            </Label>
                            <div className="flex gap-3 items-stretch">
                                <Input
                                    id="phone"
                                    type="tel"
                                    placeholder="+57 300 123 4567"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="flex-1 h-11"
                                />
                                <Button
                                    onClick={handleConnect}
                                    disabled={isConnecting}
                                    className="h-11 px-6"
                                >
                                    {isConnecting ? "Conectando..." : "Conectar"}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Ingresa tu número personal para recibir notificaciones
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Número:</span>
                            <span className="font-medium">
                                ****{instance?.phone_number_display}
                            </span>
                        </div>

                        <div className="space-y-4 pt-2">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="notify-sale">Nuevas ventas</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Notificar cuando se complete una venta
                                    </p>
                                </div>
                                <Switch
                                    id="notify-sale"
                                    checked={notifyOnSale}
                                    onCheckedChange={setNotifyOnSale}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="notify-stock">Stock bajo</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Notificar cuando un producto tenga poco stock
                                    </p>
                                </div>
                                <Switch
                                    id="notify-stock"
                                    checked={notifyOnLowStock}
                                    onCheckedChange={setNotifyOnLowStock}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="notify-conversation">
                                        Nuevas conversaciones
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Notificar cuando un cliente inicie una conversación
                                    </p>
                                </div>
                                <Switch
                                    id="notify-conversation"
                                    checked={notifyOnNewConversation}
                                    onCheckedChange={setNotifyOnNewConversation}
                                />
                            </div>
                        </div>

                        <Button
                            onClick={handleSaveSettings}
                            disabled={isSaving}
                            className="w-full"
                        >
                            {isSaving ? "Guardando..." : "Guardar configuración"}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
