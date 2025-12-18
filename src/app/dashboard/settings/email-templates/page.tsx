import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Mail, Settings, Eye } from "lucide-react"
import Link from "next/link"
import { getEmailTemplatesData } from "./actions"
import { EmailTemplateEditor } from "./components/email-template-editor"
import { EmailSettingsForm } from "./components/email-settings-form"


export const dynamic = 'force-dynamic'

export default async function EmailTemplatesPage() {
  try {
    const data = await getEmailTemplatesData()

    return (
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Link href="/dashboard/settings">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="size-4 mr-2" />
                Volver a Configuración
              </Button>
            </Link>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight">Configuración de Emails</h2>
            <p className="text-muted-foreground">
              Personaliza los emails que se envían a tus clientes y a ti cuando se crean pedidos.
            </p>
          </div>

          {/* Status Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Email Cliente</CardTitle>
                <Mail className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {data.customerTemplate ? (
                    <Badge variant="default">Personalizado</Badge>
                  ) : (
                    <Badge variant="secondary">Por Defecto</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Confirmación de pedido para clientes
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Email Propietario</CardTitle>
                <Settings className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {data.ownerTemplate ? (
                    <Badge variant="default">Personalizado</Badge>
                  ) : (
                    <Badge variant="secondary">Por Defecto</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Notificación de nuevo pedido
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Configuración</CardTitle>
                <Eye className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {data.emailSettings ? (
                    <Badge variant="default">Configurado</Badge>
                  ) : (
                    <Badge variant="outline">Sin Configurar</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Información de negocio
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="customer" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="customer">Email Cliente</TabsTrigger>
              <TabsTrigger value="owner">Email Propietario</TabsTrigger>
              <TabsTrigger value="settings">Configuración</TabsTrigger>
            </TabsList>

            <TabsContent value="customer" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Email de Confirmación para Clientes</CardTitle>
                  <CardDescription>
                    Este email se envía automáticamente a los clientes cuando realizan un pedido.
                    Puedes personalizarlo con tu marca y información de contacto.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EmailTemplateEditor
                    templateType="customer_confirmation"
                    initialTemplate={data.customerTemplate}
                    organizationId={data.organization.id}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="owner" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Email de Notificación para Propietario</CardTitle>
                  <CardDescription>
                    Este email se te envía cuando recibes un nuevo pedido.
                    Incluye toda la información necesaria para procesar el pedido.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EmailTemplateEditor
                    templateType="owner_notification"
                    initialTemplate={data.ownerTemplate}
                    organizationId={data.organization.id}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Configuración de Negocio</CardTitle>
                  <CardDescription>
                    Esta información se incluye automáticamente en todos los emails.
                    Configura tu información de contacto, instrucciones de pago y mensajes personalizados.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EmailSettingsForm
                    initialSettings={data.emailSettings}
                    organizationId={data.organization.id}
                    organizationName={data.organization.name}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    )
  } catch (error: any) {
    console.error('[EMAIL_TEMPLATES] Error loading email templates page:', error)
    
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/settings">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="size-4 mr-2" />
                Volver a Configuración
              </Button>
            </Link>
          </div>

          <div className="p-6 text-red-500">
            <h2 className="text-xl font-bold">Error cargando configuración de emails</h2>
            <p>{error.message}</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }
}