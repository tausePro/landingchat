"use client"

import { useEffect, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { getWhatsAppStatus } from "../actions"
import Image from "next/image"

interface QRModalProps {
    qrCode: string
    instanceId: string
    onClose: () => void
}

export function QRModal({ qrCode, instanceId, onClose }: QRModalProps) {
    const [status, setStatus] = useState<"scanning" | "connected" | "error">(
        "scanning"
    )
    const [errorMessage, setErrorMessage] = useState<string>("")

    useEffect(() => {
        // Polling cada 3 segundos para verificar el estado
        const interval = setInterval(async () => {
            try {
                const result = await getWhatsAppStatus()
                if (result.success && result.data) {
                    const instance = result.data.corporate

                    if (instance?.id === instanceId) {
                        if (instance.status === "connected") {
                            setStatus("connected")
                            // Cerrar modal después de 2 segundos
                            setTimeout(() => {
                                onClose()
                            }, 2000)
                            clearInterval(interval)
                        } else if (instance.status === "banned") {
                            setStatus("error")
                            setErrorMessage(
                                "WhatsApp bloqueado. Intenta con otro número."
                            )
                            clearInterval(interval)
                        }
                    }
                }
            } catch (error) {
                console.error("Error checking status:", error)
            }
        }, 3000)

        // Timeout de 2 minutos
        const timeout = setTimeout(() => {
            if (status === "scanning") {
                setStatus("error")
                setErrorMessage("QR expirado. Intenta nuevamente.")
                clearInterval(interval)
            }
        }, 120000)

        return () => {
            clearInterval(interval)
            clearTimeout(timeout)
        }
    }, [instanceId, onClose, status])

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Conectar WhatsApp</DialogTitle>
                    <DialogDescription>
                        {status === "scanning" &&
                            "Escanea el código QR con tu WhatsApp"}
                        {status === "connected" && "¡Conectado exitosamente!"}
                        {status === "error" && "Error al conectar"}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center gap-4 py-4">
                    {status === "scanning" && (
                        <>
                            <div className="relative w-64 h-64 bg-white p-4 rounded-lg">
                                <Image
                                    src={qrCode}
                                    alt="QR Code"
                                    fill
                                    className="object-contain"
                                />
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Esperando escaneo...</span>
                            </div>
                            <div className="text-xs text-center text-muted-foreground space-y-1">
                                <p>1. Abre WhatsApp en tu teléfono</p>
                                <p>2. Ve a Configuración → Dispositivos vinculados</p>
                                <p>3. Toca "Vincular un dispositivo"</p>
                                <p>4. Escanea este código QR</p>
                            </div>
                        </>
                    )}

                    {status === "connected" && (
                        <div className="flex flex-col items-center gap-4">
                            <CheckCircle2 className="h-16 w-16 text-green-500" />
                            <p className="text-lg font-medium">
                                WhatsApp conectado correctamente
                            </p>
                        </div>
                    )}

                    {status === "error" && (
                        <div className="flex flex-col items-center gap-4">
                            <XCircle className="h-16 w-16 text-red-500" />
                            <p className="text-lg font-medium text-center">
                                {errorMessage}
                            </p>
                            <Button onClick={onClose}>Cerrar</Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
