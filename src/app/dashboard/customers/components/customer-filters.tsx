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

export function CustomerFilters() {
    const router = useRouter()
    const searchParams = useSearchParams()

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

    return (
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
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas las categorías</SelectItem>
                        <SelectItem value="vip">VIP</SelectItem>
                        <SelectItem value="fieles">Fieles</SelectItem>
                        <SelectItem value="nuevos">Nuevos</SelectItem>
                        <SelectItem value="riesgo">En Riesgo</SelectItem>
                    </SelectContent>
                </Select>
                <Select
                    defaultValue={searchParams.get("channel")?.toString() || "all"}
                    onValueChange={(value) => handleFilterChange("channel", value)}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Canal" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los canales</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="web">Web</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline">
                    <span className="material-symbols-outlined mr-2">upload</span>
                    Importar
                </Button>
                <Button variant="outline">
                    <span className="material-symbols-outlined mr-2">download</span>
                    Exportar
                </Button>
                <Button>
                    <span className="material-symbols-outlined mr-2">add</span>
                    Nuevo Cliente
                </Button>
            </div>
        </div>
    )
}
