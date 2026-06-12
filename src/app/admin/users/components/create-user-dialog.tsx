"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { UserPlus, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { createPlatformUser } from "../actions"

/**
 * Creación de usuarios desde el super admin: compañeros de equipo
 * (con rol de plataforma) o cuentas sueltas. La password temporal se
 * muestra UNA sola vez para compartirla por canal seguro.
 */
export function CreateUserDialog() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [email, setEmail] = useState("")
    const [fullName, setFullName] = useState("")
    const [adminRole, setAdminRole] = useState<"none" | "finance" | "tech" | "superadmin">("none")
    const [creating, setCreating] = useState(false)
    const [tempPassword, setTempPassword] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    const reset = () => {
        setEmail("")
        setFullName("")
        setAdminRole("none")
        setTempPassword(null)
        setCopied(false)
    }

    const handleCreate = async () => {
        setCreating(true)
        try {
            const result = await createPlatformUser({
                email: email.trim(),
                fullName: fullName.trim(),
                adminRole: adminRole === "none" ? null : adminRole,
            })
            if (result.success) {
                setTempPassword(result.tempPassword)
                toast.success("Usuario creado")
                router.refresh()
            } else {
                toast.error(result.error)
            }
        } finally {
            setCreating(false)
        }
    }

    const handleCopy = async () => {
        if (!tempPassword) return
        await navigator.clipboard.writeText(`Email: ${email}\nPassword temporal: ${tempPassword}\nIngresa en: https://www.landingchat.co/login`)
        setCopied(true)
        toast.success("Credenciales copiadas")
    }

    return (
        <>
            <Button onClick={() => { reset(); setOpen(true) }}>
                <UserPlus className="h-4 w-4 mr-2" />
                Crear usuario
            </Button>

            <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset() }}>
                <DialogContent className="sm:max-w-md">
                    {tempPassword ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Usuario creado ✓</DialogTitle>
                                <DialogDescription>
                                    Comparte estas credenciales por un canal seguro. La password temporal
                                    <strong> no se volverá a mostrar</strong> — pídele que la cambie al entrar.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="rounded-lg border bg-slate-50 dark:bg-slate-900 p-4 space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="font-mono">{email}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Password temporal</span><span className="font-mono font-bold">{tempPassword}</span></div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={handleCopy}>
                                    {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                                    {copied ? "Copiadas" : "Copiar credenciales"}
                                </Button>
                                <Button onClick={() => setOpen(false)}>Listo</Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>Crear usuario</DialogTitle>
                                <DialogDescription>
                                    Para compañeros de equipo asigna un rol de plataforma; sin rol, es una cuenta normal.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                                <div className="space-y-1">
                                    <Label htmlFor="newUserName">Nombre completo</Label>
                                    <Input id="newUserName" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Ana Pérez" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="newUserEmail">Email</Label>
                                    <Input id="newUserEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ana@landingchat.co" />
                                </div>
                                <div className="space-y-1">
                                    <Label>Rol de plataforma</Label>
                                    <Select value={adminRole} onValueChange={(value) => setAdminRole(value as typeof adminRole)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Sin rol (cuenta normal)</SelectItem>
                                            <SelectItem value="finance">Finanzas — números y suscripciones</SelectItem>
                                            <SelectItem value="tech">Técnico — configs y canales</SelectItem>
                                            <SelectItem value="superadmin">Superadmin — todo</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setOpen(false)} disabled={creating}>Cancelar</Button>
                                <Button onClick={handleCreate} disabled={creating || !email.trim() || fullName.trim().length < 2}>
                                    {creating ? "Creando..." : "Crear usuario"}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
