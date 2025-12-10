"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { importWooCommerceProducts } from "../woo-actions"

export function WooImportModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)

        const formData = new FormData(e.currentTarget)

        try {
            const result = await importWooCommerceProducts(formData)

            if (result.success) {
                toast.success(`Importación completada: ${result.imported} productos creados`)
                if (result.errors.length > 0) {
                    toast.warning(`Fallaron ${result.errors.length}. Ejemplo: ${result.errors[0]}`)
                    // Log all errors to console for debugging
                    console.error("Import errors:", result.errors)
                }
                setIsOpen(false)
            } else {
                toast.error(result.errors[0] || "Error en la importación")
            }
        } catch (error) {
            toast.error("Ocurrió un error inesperado")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <span className="material-symbols-outlined text-[#96588a]">download</span>
                    Importar de WooCommerce
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Migrar desde WooCommerce</DialogTitle>
                    <DialogDescription>
                        Ingresa las claves API de tu tienda para importar tus productos automáticamente.
                        No guardaremos estas credenciales.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="url">URL de la Tienda</Label>
                        <Input id="url" name="url" placeholder="https://mitienda.com" required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="consumerKey">Consumer Key (ck_...)</Label>
                        <Input id="consumerKey" name="consumerKey" placeholder="ck_xxxxxxxxxxxx" required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="consumerSecret">Consumer Secret (cs_...)</Label>
                        <Input id="consumerSecret" name="consumerSecret" type="password" placeholder="cs_xxxxxxxxxxxx" required />
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={isLoading} className="bg-[#96588a] hover:bg-[#7a4670] text-white">
                            {isLoading ? (
                                <div className="flex items-center gap-2">
                                    <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                                    Importando...
                                </div>
                            ) : (
                                "Comenzar Migración"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
