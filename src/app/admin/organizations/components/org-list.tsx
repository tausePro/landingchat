"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { OrganizationData, updateOrganizationStatus, deleteOrganization } from "../actions"
import { toast } from "sonner"
// import { useDebounce } from "@/hooks/use-debounce" // We might need to create this hook or implement debounce manually

// Simple debounce implementation inside component if hook doesn't exist
function useDebounceValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)
        return () => {
            clearTimeout(handler)
        }
    }, [value, delay])
    return debouncedValue
}

interface OrgListProps {
    initialData: {
        organizations: OrganizationData[]
        total: number
        totalPages: number
    }
    searchParams: { [key: string]: string | string[] | undefined }
}

export function OrgList({ initialData }: OrgListProps) {
    const router = useRouter()
    const [searchTerm, setSearchTerm] = useState("")
    const debouncedSearch = useDebounceValue(searchTerm, 500)
    const [loading, setLoading] = useState(false)

    // Effect to trigger search on debounce
    useEffect(() => {
        if (debouncedSearch !== "") {
            router.push(`/admin/organizations?search=${debouncedSearch}`)
        } else if (searchTerm === "") {
            router.push(`/admin/organizations`)
        }
    }, [debouncedSearch, router])

    const handleStatusChange = async (id: string, status: 'active' | 'suspended' | 'archived') => {
        if (confirm(`¿Estás seguro de cambiar el estado a ${status}?`)) {
            setLoading(true)
            try {
                await updateOrganizationStatus(id, status)
                router.refresh()
            } catch (error) {
                alert("Error al actualizar estado")
            } finally {
                setLoading(false)
            }
        }
    }

    const handleDelete = async (id: string, name: string) => {
        const confirmation = prompt(`Escribe "${name}" para confirmar la eliminación:`)
        if (confirmation !== name) {
            if (confirmation !== null) toast.error("El nombre no coincide. Operación cancelada.")
            return
        }
        setLoading(true)
        try {
            const result = await deleteOrganization(id)
            if (result.success) {
                toast.success(`Organización "${name}" eliminada`)
                router.refresh()
            } else {
                toast.error(result.error || "Error al eliminar")
            }
        } catch {
            toast.error("Error inesperado al eliminar")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex w-full max-w-sm items-center space-x-2">
                    <Input
                        placeholder="Buscar organización..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-9"
                    />
                </div>
            </div>

            <div className="rounded-md border bg-white dark:bg-slate-900">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Organización</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Usuarios</TableHead>
                            <TableHead>Chats</TableHead>
                            <TableHead>Fecha Registro</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialData.organizations.map((org) => (
                            <TableRow key={org.id}>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{org.name}</span>
                                        <span className="text-xs text-muted-foreground">{org.slug}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={
                                        org.status === 'active' ? 'default' :
                                            org.status === 'suspended' ? 'destructive' : 'secondary'
                                    }>
                                        {org.status === 'active' ? 'Activo' :
                                            org.status === 'suspended' ? 'Suspendido' : 'Archivado'}
                                    </Badge>
                                </TableCell>
                                <TableCell>{org.users_count}</TableCell>
                                <TableCell>{org.chats_count}</TableCell>
                                <TableCell>{new Date(org.created_at).toLocaleDateString("es-CO")}</TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Abrir menú</span>
                                                <span className="material-symbols-outlined">more_vert</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(org.id)}>
                                                Copiar ID
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleStatusChange(org.id, 'active')}>
                                                Marcar Activo
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleStatusChange(org.id, 'suspended')} className="text-red-600">
                                                Suspender
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={() => handleDelete(org.id, org.name)}
                                                className="text-red-600 font-semibold"
                                                disabled={loading}
                                            >
                                                Eliminar Organización
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                        {initialData.organizations.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    No se encontraron resultados.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
