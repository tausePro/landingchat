"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { connectNuby } from "../actions"

interface NubyConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingConfig?: any
}

export function NubyConfigDialog({ open, onOpenChange, existingConfig }: NubyConfigDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    instance: existingConfig?.instance || '',
    clientId: existingConfig?.clientId || '',
    secretKey: existingConfig?.secretKey || '',
    token: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await connectNuby(formData)
      onOpenChange(false)
      router.refresh()
      alert('Integración con Nuby configurada exitosamente')
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Nuby</DialogTitle>
          <DialogDescription>
            Ingresa las credenciales de tu cuenta de Nuby para sincronizar propiedades.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instance">Instancia</Label>
            <Input
              id="instance"
              placeholder="casainmobiliariajuridica"
              value={formData.instance}
              onChange={(e) => setFormData({ ...formData, instance: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              El nombre de tu instancia en Nuby (ej: tuempresa.arrendasoft.co)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID</Label>
            <Input
              id="clientId"
              placeholder="JSArrendasoft2"
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="secretKey">Secret Key</Label>
            <Input
              id="secretKey"
              type="password"
              placeholder="94d57c1..."
              value={formData.secretKey}
              onChange={(e) => setFormData({ ...formData, secretKey: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="token">Token</Label>
            <Input
              id="token"
              type="password"
              placeholder="57585e64e..."
              value={formData.token}
              onChange={(e) => setFormData({ ...formData, token: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              El token se encriptará antes de guardarse
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
