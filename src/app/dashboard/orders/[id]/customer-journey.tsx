"use client"

interface CustomerJourneyProps {
    sourceChannel?: string
    chatId?: string
    utmData?: {
        utm_source?: string
        utm_medium?: string
        utm_campaign?: string
        utm_content?: string
        utm_term?: string
        referrer?: string
    }
}

export function CustomerJourney({ sourceChannel, chatId, utmData }: CustomerJourneyProps) {
    const hasUtmData = utmData && (utmData.utm_source || utmData.utm_medium || utmData.utm_campaign)
    
    const getChannelInfo = () => {
        switch (sourceChannel) {
            case 'chat':
                return { icon: 'chat', label: 'Chat Conversacional', color: 'text-blue-500 bg-blue-50' }
            case 'whatsapp':
                return { icon: 'smartphone', label: 'WhatsApp', color: 'text-green-500 bg-green-50' }
            default:
                return { icon: 'language', label: 'Web Directa', color: 'text-gray-500 bg-gray-50' }
        }
    }

    const channelInfo = getChannelInfo()

    return (
        <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
            <h2 className="text-lg font-bold text-text-light-primary dark:text-text-dark-primary mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">route</span>
                Customer Journey
            </h2>
            
            <div className="space-y-4">
                {/* Canal de Origen */}
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${channelInfo.color}`}>
                        <span className="material-symbols-outlined">{channelInfo.icon}</span>
                    </div>
                    <div>
                        <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">Canal de Origen</p>
                        <p className="font-medium text-text-light-primary dark:text-text-dark-primary">
                            {channelInfo.label}
                        </p>
                    </div>
                </div>

                {/* Chat ID si existe */}
                {chatId && (
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg text-purple-500 bg-purple-50">
                            <span className="material-symbols-outlined">forum</span>
                        </div>
                        <div>
                            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">Conversación</p>
                            <p className="font-mono text-xs text-text-light-primary dark:text-text-dark-primary">
                                #{chatId.slice(0, 8)}
                            </p>
                        </div>
                    </div>
                )}

                {/* UTM Data si existe */}
                {hasUtmData && (
                    <div className="border-t border-border-light dark:border-border-dark pt-4 mt-4">
                        <p className="text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary mb-3 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">campaign</span>
                            Datos de Campaña
                        </p>
                        <div className="space-y-2 text-sm">
                            {utmData.utm_source && (
                                <div className="flex justify-between">
                                    <span className="text-text-light-secondary dark:text-text-dark-secondary">Fuente</span>
                                    <span className="font-medium text-text-light-primary dark:text-text-dark-primary">
                                        {utmData.utm_source}
                                    </span>
                                </div>
                            )}
                            {utmData.utm_medium && (
                                <div className="flex justify-between">
                                    <span className="text-text-light-secondary dark:text-text-dark-secondary">Medio</span>
                                    <span className="font-medium text-text-light-primary dark:text-text-dark-primary">
                                        {utmData.utm_medium}
                                    </span>
                                </div>
                            )}
                            {utmData.utm_campaign && (
                                <div className="flex justify-between">
                                    <span className="text-text-light-secondary dark:text-text-dark-secondary">Campaña</span>
                                    <span className="font-medium text-text-light-primary dark:text-text-dark-primary">
                                        {utmData.utm_campaign}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Referrer si existe */}
                {utmData?.referrer && (
                    <div className="flex items-start gap-3 pt-2">
                        <div className="p-2 rounded-lg text-orange-500 bg-orange-50">
                            <span className="material-symbols-outlined">link</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">Referido desde</p>
                            <p className="font-medium text-text-light-primary dark:text-text-dark-primary text-xs truncate">
                                {utmData.referrer}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
