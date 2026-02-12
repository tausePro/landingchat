"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { importCustomers, type ImportCustomerRow } from "../actions"
import { CustomerForm } from "./customer-form"
import Papa from "papaparse"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function CustomerHeaderActions() {
    const router = useRouter()
    const [showNewCustomerModal, setShowNewCustomerModal] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isImporting, setIsImporting] = useState(false)

    const handleImportClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsImporting(true)

        Papa.parse(file, {
            header: true,
            complete: async (results) => {
                const importResult = await importCustomers(results.data as ImportCustomerRow[])

                if (importResult.success) {
                    toast.success(`Se importaron ${importResult.data.imported} clientes correctamente`)
                    router.refresh()
                } else {
                    toast.error(`Error al importar: ${importResult.error}`)
                }

                setIsImporting(false)
                if (fileInputRef.current) fileInputRef.current.value = ""
            },
            error: (error) => {
                toast.error(`Error al leer archivo: ${error.message}`)
                setIsImporting(false)
            }
        })
    }

    return (
        <>
            <div className="flex items-center gap-2">
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".csv"
                    onChange={handleFileChange}
                />
                <Button variant="outline" onClick={handleImportClick} disabled={isImporting}>
                    <span className="material-symbols-outlined mr-2 text-base">upload</span>
                    {isImporting ? "Importando..." : "Importar CSV"}
                </Button>
                <Button onClick={() => setShowNewCustomerModal(true)}>
                    <span className="material-symbols-outlined mr-2 text-base">add</span>
                    Nuevo Lead
                </Button>
            </div>

            <CustomerForm
                open={showNewCustomerModal}
                onOpenChange={setShowNewCustomerModal}
            />
        </>
    )
}
