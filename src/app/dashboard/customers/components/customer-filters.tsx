"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useRouter, useSearchParams } from "next/navigation"
import { useDebouncedCallback } from "use-debounce"

import { useState, useRef } from "react"
import { CustomerForm } from "./customer-form"
import { importCustomers, type ImportCustomerRow } from "../actions"
import Papa from "papaparse"

export function CustomerFilters() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [showNewCustomerModal, setShowNewCustomerModal] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isImporting, setIsImporting] = useState(false)

    const handleSearch = useDebouncedCallback((term: string) => {
        const params = new URLSearchParams(searchParams)
        if (term) {
            params.set("search", term)
        } else {
            params.delete("search")
        }
        params.set("page", "1")
        router.replace(`?${params.toString()}`)
    }, 300)

    const handleFilterChange = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams)
        if (value && value !== "all") {
            params.set(key, value)
        } else {
            params.delete(key)
        }
        params.set("page", "1")
        router.replace(`?${params.toString()}`)
    }

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
                    alert(`Se importaron ${importResult.data.imported} clientes correctamente`)
                } else {
                    alert(`Error al importar: ${importResult.error}`)
                }
                
                setIsImporting(false)
                if (fileInputRef.current) fileInputRef.current.value = ""
            },
            error: (error) => {
                alert(`Error al leer archivo: ${error.message}`)
                setIsImporting(false)
            }
        })
    }

    return (
        <>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-1 items-center gap-2">
                    <div className="relative flex-1 max-w-sm">
                        <span className="material-symbols-outlined absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground">
                            search
                        </span>
                        <Input
                            placeholder="Buscar por nombre, email o teléfono..."
                            className="pl-9"
                            defaultValue={searchParams.get("search")?.toString()}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                    </div>
                    <Select
                        defaultValue={searchParams.get("category")?.toString() || "all"}
                        onValueChange={(value) => handleFilterChange("category", value)}
                    >
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Categoría" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            <SelectItem value="vip">Fieles 4 (VIP)</SelectItem>
                            <SelectItem value="fieles 3">Fieles 3</SelectItem>
                            <SelectItem value="fieles 2">Fieles 2</SelectItem>
                            <SelectItem value="fieles 1">Fieles 1</SelectItem>
                            <SelectItem value="riesgo">A recuperar</SelectItem>
                            <SelectItem value="nuevo">Nuevos</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        defaultValue={searchParams.get("channel")?.toString() || "all"}
                        onValueChange={(value) => handleFilterChange("channel", value)}
                    >
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Canal" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="web">Web</SelectItem>
                            <SelectItem value="referido">Referido</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        defaultValue={searchParams.get("zone")?.toString() || "all"}
                        onValueChange={(value) => handleFilterChange("zone", value)}
                    >
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Zona" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            <SelectItem value="norte">Norte</SelectItem>
                            <SelectItem value="sur">Sur</SelectItem>
                            <SelectItem value="centro">Centro</SelectItem>
                            <SelectItem value="occidente">Occidente</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".csv"
                        onChange={handleFileChange}
                    />
                    <Button variant="outline" onClick={handleImportClick} disabled={isImporting}>
                        <span className="material-symbols-outlined mr-2">upload</span>
                        {isImporting ? "Importando..." : "Importar"}
                    </Button>
                    <Button variant="outline">
                        <span className="material-symbols-outlined mr-2">download</span>
                        Exportar
                    </Button>
                    <Button onClick={() => setShowNewCustomerModal(true)}>
                        <span className="material-symbols-outlined mr-2">add</span>
                        Nuevo Cliente
                    </Button>
                </div>
            </div>

            <CustomerForm
                open={showNewCustomerModal}
                onOpenChange={setShowNewCustomerModal}
            />
        </>
    )
}
