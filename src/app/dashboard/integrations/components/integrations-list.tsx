"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { NubyConfigDialog } from "./nuby-config-dialog"
import { syncProperties, disconnectIntegration } from "../actions"
import type { IntegrationData } from "../actions"

interface IntegrationsListProps {
  integrations: IntegrationData[]
}

export function IntegrationsList({ integrations }: IntegrationsListProps) {
  const router = useRouter()
  const [isNubyDialogOpen, setIsNubyDialogOpen] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [connectingGcal, setConnectingGcal] = useState(false)

  const nubyIntegration = integrations.find(i => i.provider === 'nuby')
  const gcalIntegration = integrations.find(i => i.provider === 'google_calendar')

  const handleSync = async (provider: string, syncType: 'full' | 'incremental') => {
    setSyncing(provider)
    try {
      const result = await syncProperties(syncType)
      
      if (result.success) {
        alert(`✅ Sincronización exitosa!\n\n${result.itemsCreated} propiedades creadas\n${result.itemsUpdated} propiedades actualizadas`)
      } else {
        const errorDetails = result.errors.join('\n')
        alert(`❌ Sincronización con errores:\n\n${errorDetails}\n\nProcesadas: ${result.itemsProcessed}\nFallidas: ${result.itemsFailed}`)
      }
      
      router.refresh()
    } catch (error: any) {
      console.error('Sync error:', error)
      alert(`❌ Error de sincronización:\n\n${error.message}\n\nRevisa la consola del navegador para más detalles.`)
    } finally {
      setSyncing(null)
    }
  }

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm('¿Estás seguro de desconectar esta integración?')) return
    
    try {
      await disconnectIntegration(integrationId)
      router.refresh()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Integraciones</h2>
          <p className="text-muted-foreground">
            Conecta tu tienda con sistemas externos para sincronizar datos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Nuby Integration Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <span className="text-2xl">🏢</span>
                </div>
                <div>
                  <CardTitle className="text-lg">Nuby</CardTitle>
                  <CardDescription>Sistema inmobiliario</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {nubyIntegration ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estado</span>
                  <Badge variant={nubyIntegration.status === 'connected' ? 'default' : 'secondary'}>
                    {nubyIntegration.status === 'connected' ? 'Conectado' : 'Desconectado'}
                  </Badge>
                </div>
                
                {nubyIntegration.last_sync_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Última sincronización</span>
                    <span className="text-sm" suppressHydrationWarning>
                      {new Date(nubyIntegration.last_sync_at).toLocaleString('es-ES')}
                    </span>
                  </div>
                )}

                {nubyIntegration.error_message && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {nubyIntegration.error_message}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleSync('nuby', 'incremental')}
                    disabled={syncing === 'nuby'}
                  >
                    {syncing === 'nuby' ? 'Sincronizando...' : 'Sincronizar'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsNubyDialogOpen(true)}
                  >
                    Configurar
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-red-600"
                  onClick={() => handleDisconnect(nubyIntegration.id)}
                >
                  Desconectar
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Conecta tu cuenta de Nuby para sincronizar propiedades automáticamente.
                </p>
                <Button
                  className="w-full"
                  onClick={() => setIsNubyDialogOpen(true)}
                >
                  Conectar Nuby
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Google Calendar Integration Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <span className="text-2xl">📅</span>
                </div>
                <div>
                  <CardTitle className="text-lg">Google Calendar</CardTitle>
                  <CardDescription>Sincroniza citas automáticamente</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {gcalIntegration && gcalIntegration.status === 'connected' ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estado</span>
                  <Badge variant="default">Conectado</Badge>
                </div>

                {gcalIntegration.config?.connected_email && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Cuenta</span>
                    <span className="text-sm font-medium truncate max-w-[180px]">
                      {gcalIntegration.config.connected_email}
                    </span>
                  </div>
                )}

                {gcalIntegration.config?.connected_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Conectado desde</span>
                    <span className="text-sm" suppressHydrationWarning>
                      {new Date(gcalIntegration.config.connected_at).toLocaleDateString('es-ES')}
                    </span>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Las citas agendadas por el agente AI se crean automáticamente en tu Google Calendar.
                </p>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-red-600"
                  onClick={() => handleDisconnect(gcalIntegration.id)}
                >
                  Desconectar
                </Button>
              </>
            ) : gcalIntegration && gcalIntegration.status === 'error' ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estado</span>
                  <Badge variant="destructive">Error</Badge>
                </div>
                {gcalIntegration.error_message && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {gcalIntegration.error_message}
                    </p>
                  </div>
                )}
                <Button
                  className="w-full"
                  onClick={() => {
                    setConnectingGcal(true)
                    window.location.href = '/api/integrations/google-calendar/connect'
                  }}
                  disabled={connectingGcal}
                >
                  {connectingGcal ? 'Redirigiendo...' : 'Reconectar'}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Conecta tu Google Calendar para sincronizar citas agendadas por el agente AI automáticamente.
                </p>
                <Button
                  className="w-full"
                  onClick={() => {
                    setConnectingGcal(true)
                    window.location.href = '/api/integrations/google-calendar/connect'
                  }}
                  disabled={connectingGcal}
                >
                  {connectingGcal ? 'Redirigiendo a Google...' : 'Conectar Google Calendar'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Odoo Integration Card (Placeholder) */}
        <Card className="opacity-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <span className="text-2xl">📦</span>
              </div>
              <div>
                <CardTitle className="text-lg">Odoo</CardTitle>
                <CardDescription>ERP empresarial</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">Próximamente</Badge>
          </CardContent>
        </Card>

        {/* WooCommerce Integration Card (Placeholder) */}
        <Card className="opacity-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <span className="text-2xl">🛒</span>
              </div>
              <div>
                <CardTitle className="text-lg">WooCommerce</CardTitle>
                <CardDescription>E-commerce WordPress</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">Próximamente</Badge>
          </CardContent>
        </Card>
      </div>

      <NubyConfigDialog
        open={isNubyDialogOpen}
        onOpenChange={setIsNubyDialogOpen}
        existingConfig={nubyIntegration?.config}
      />
    </div>
  )
}
