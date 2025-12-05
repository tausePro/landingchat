"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

type Chat = {
    id: string
    customer_name: string | null
    status: string
    created_at: string
    last_message?: string
    organization_id: string
}

export default function ChatsPage() {
    const [chats, setChats] = useState<Chat[]>([])
    const [loading, setLoading] = useState(true)
    const [orgId, setOrgId] = useState<string | null>(null)

    useEffect(() => {
        const fetchChats = async () => {
            const supabase = createClient()
            
            // Primero obtener el organization_id del usuario
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setLoading(false)
                return
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("organization_id")
                .eq("id", user.id)
                .single()

            if (!profile?.organization_id) {
                setLoading(false)
                return
            }

            setOrgId(profile.organization_id)

            // Filtrar chats por organization_id
            const { data, error } = await supabase
                .from("chats")
                .select("*")
                .eq("organization_id", profile.organization_id)
                .order("created_at", { ascending: false })

            if (error) {
                console.error("Error fetching chats:", error)
            } else {
                setChats(data || [])
            }
            setLoading(false)
        }

        fetchChats()
    }, [])

    // Realtime subscription for new chats (solo de la organización)
    useEffect(() => {
        if (!orgId) return

        const supabase = createClient()
        const channel = supabase
            .channel('org:chats')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'chats',
                filter: `organization_id=eq.${orgId}`
            }, payload => {
                setChats(prev => [payload.new as Chat, ...prev])
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [orgId])

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-text-light-primary dark:text-text-dark-primary">
                        Bandeja de Entrada
                    </h1>
                    <Button>
                        <span className="material-symbols-outlined mr-2">add</span>
                        Nuevo Chat
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Chats Activos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-center py-10 text-text-light-secondary">Cargando chats...</div>
                        ) : chats.length === 0 ? (
                            <div className="text-center py-10 text-text-light-secondary">No hay chats activos.</div>
                        ) : (
                            <div className="space-y-4">
                                {chats.map((chat) => (
                                    <Link
                                        key={chat.id}
                                        href={`/dashboard/chats/${chat.id}`}
                                        className="flex items-center justify-between p-4 rounded-lg border border-border-light dark:border-border-dark hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                {chat.customer_name ? chat.customer_name[0].toUpperCase() : "A"}
                                            </div>
                                            <div>
                                                <p className="font-medium text-text-light-primary dark:text-text-dark-primary">
                                                    {chat.customer_name || "Anónimo"}
                                                </p>
                                                <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                                                    {new Date(chat.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${chat.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                {chat.status === 'active' ? 'Activo' : 'Cerrado'}
                                            </span>
                                            <Button variant="ghost" size="icon">
                                                <span className="material-symbols-outlined">arrow_forward_ios</span>
                                            </Button>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
