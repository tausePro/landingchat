"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { UserData, updateUserRole, toggleSuperadmin, updateAdminRole } from "../actions"
import { CreateUserDialog } from "./create-user-dialog"
import { formatBogotaDate } from "@/lib/utils/date"

// Simple debounce implementation
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

interface UserListProps {
    initialData: {
        users: UserData[]
        total: number
        totalPages: number
    }
    searchParams: { [key: string]: string | string[] | undefined }
}

export function UserList({ initialData }: UserListProps) {
    const router = useRouter()
    const [searchTerm, setSearchTerm] = useState("")
    const debouncedSearch = useDebounceValue(searchTerm, 500)
    const [loading, setLoading] = useState(false)

    // Effect to trigger search on debounce
    useEffect(() => {
        if (debouncedSearch !== "") {
            router.push(`/admin/users?search=${debouncedSearch}`)
        } else if (searchTerm === "") {
            router.push(`/admin/users`)
        }
    }, [debouncedSearch, router])

    const handleRoleChange = async (id: string, role: 'admin' | 'member') => {
        if (confirm(`¿Cambiar rol a ${role}?`)) {
            setLoading(true)
            try {
                await updateUserRole(id, role)
                router.refresh()
            } catch (error) {
                alert("Error al actualizar rol")
            } finally {
                setLoading(false)
            }
        }
    }

    const handleSuperadminToggle = async (id: string, currentState: boolean) => {
        const action = currentState ? "quitar" : "otorgar"
        if (confirm(`¿Estás SEGURO de ${action} permisos de Superadmin a este usuario?`)) {
            setLoading(true)
            try {
                await toggleSuperadmin(id, !currentState)
                router.refresh()
            } catch (error) {
                alert("Error al actualizar permisos")
            } finally {
                setLoading(false)
            }
        }
    }

    const handleAdminRoleChange = async (id: string, adminRole: "finance" | "tech" | null) => {
        setLoading(true)
        try {
            await updateAdminRole(id, adminRole)
            router.refresh()
        } catch {
            alert("Error al actualizar el rol de plataforma")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div className="flex w-full max-w-sm items-center space-x-2">
                    <Input
                        placeholder="Buscar por nombre o email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-9"
                    />
                </div>
                <CreateUserDialog />
            </div>

            <div className="rounded-md border bg-white dark:bg-slate-900">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Organización</TableHead>
                            <TableHead>Rol</TableHead>
                            <TableHead>Permisos</TableHead>
                            <TableHead>Fecha Registro</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialData.users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{user.full_name}</span>
                                        <span className="text-xs text-muted-foreground">{user.email}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {user.organization ? (
                                        <div className="flex flex-col">
                                            <span className="text-sm">{user.organization.name}</span>
                                            <span className="text-xs text-muted-foreground">{user.organization.slug}</span>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground italic">Sin organización</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                                        {user.role === 'admin' ? 'Admin' : 'Miembro'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {user.is_superadmin ? (
                                        <Badge variant="destructive" className="bg-indigo-600 hover:bg-indigo-700">
                                            Superadmin
                                        </Badge>
                                    ) : user.admin_role === "finance" ? (
                                        <Badge className="bg-emerald-600 hover:bg-emerald-700">Finanzas</Badge>
                                    ) : user.admin_role === "tech" ? (
                                        <Badge className="bg-sky-600 hover:bg-sky-700">Técnico</Badge>
                                    ) : null}
                                </TableCell>
                                <TableCell>{formatBogotaDate(user.created_at)}</TableCell>
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
                                            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(user.id)}>
                                                Copiar ID
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuLabel>Rol de Organización</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => handleRoleChange(user.id, 'admin')} disabled={user.role === 'admin'}>
                                                Hacer Admin
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleRoleChange(user.id, 'member')} disabled={user.role === 'member'}>
                                                Hacer Miembro
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuLabel>Rol de Plataforma</DropdownMenuLabel>
                                            <DropdownMenuItem
                                                onClick={() => handleAdminRoleChange(user.id, "finance")}
                                                disabled={user.admin_role === "finance" || user.is_superadmin}
                                            >
                                                Asignar Finanzas
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleAdminRoleChange(user.id, "tech")}
                                                disabled={user.admin_role === "tech" || user.is_superadmin}
                                            >
                                                Asignar Técnico
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleAdminRoleChange(user.id, null)}
                                                disabled={!user.admin_role || user.is_superadmin}
                                            >
                                                Quitar rol de plataforma
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuLabel className="text-red-600">Zona de Peligro</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => handleSuperadminToggle(user.id, user.is_superadmin)}>
                                                {user.is_superadmin ? "Revocar Superadmin" : "Hacer Superadmin"}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                        {initialData.users.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    No se encontraron usuarios.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
