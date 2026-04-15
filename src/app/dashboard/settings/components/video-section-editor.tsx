"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { updateOrganization } from "../actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MediaSelectorModal } from "@/app/dashboard/media/components/MediaSelectorModal"

interface VideoSectionEditorProps {
    organization: {
        id: string
        name: string
        slug: string
        settings: any
    }
}

export function VideoSectionEditor({ organization }: VideoSectionEditorProps) {
    const router = useRouter()
    const videoSettings = organization.settings?.storefront?.videoSection || {}

    const [enabled, setEnabled] = useState(videoSettings.enabled ?? false)
    const [videoUrl, setVideoUrl] = useState(videoSettings.videoUrl || "")
    const [title, setTitle] = useState(videoSettings.title || "")
    const [subtitle, setSubtitle] = useState(videoSettings.subtitle || "")
    const [style, setStyle] = useState<"clip" | "hero" | "full">(videoSettings.style || "clip")
    const [overlayText, setOverlayText] = useState(videoSettings.overlayText || "")
    const [isSaving, setIsSaving] = useState(false)
    const [showMediaModal, setShowMediaModal] = useState(false)

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const updatedSettings = {
                ...organization.settings,
                storefront: {
                    ...organization.settings?.storefront,
                    videoSection: {
                        enabled,
                        videoUrl,
                        title,
                        subtitle,
                        style,
                        overlayText,
                    }
                }
            }

            await updateOrganization({
                name: organization.name,
                slug: organization.slug,
                settings: updatedSettings
            })

            toast.success("Sección de video guardada")
            router.refresh()
        } catch (error) {
            console.error("Error saving video section:", error)
            toast.error("Error al guardar")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shadow-sm">
            <div className="p-6 border-b border-border-light dark:border-border-dark">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">Sección de Video</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Agrega un video destacado a tu storefront. Sube tu video en Media y pega la URL aquí.
                        </p>
                    </div>
                    <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
            </div>

            {enabled && (
                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <Label>Video</Label>
                        <div className="flex gap-2">
                            <Input
                                value={videoUrl}
                                onChange={(e) => setVideoUrl(e.target.value)}
                                placeholder="URL del video o sube uno desde tu equipo"
                                className="flex-1"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowMediaModal(true)}
                            >
                                Subir / Elegir
                            </Button>
                        </div>
                        <p className="text-xs text-gray-500">
                            Sube un video desde tu equipo o elige uno de tu biblioteca. También acepta URLs de YouTube.
                        </p>
                    </div>

                    {showMediaModal && (
                        <MediaSelectorModal
                            open={showMediaModal}
                            onClose={() => setShowMediaModal(false)}
                            onSelect={(urls) => {
                                if (urls.length > 0) {
                                    setVideoUrl(urls[0])
                                }
                                setShowMediaModal(false)
                            }}
                            multiple={false}
                            acceptTypes={["video"]}
                        />
                    )}

                    <div className="space-y-2">
                        <Label>Estilo del Video</Label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { value: "clip" as const, label: "Clip Corto", desc: "Autoplay, loop, sin sonido" },
                                { value: "hero" as const, label: "Hero Video", desc: "Fondo completo con texto" },
                                { value: "full" as const, label: "Video Completo", desc: "Con controles de reproducción" },
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setStyle(option.value)}
                                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                                        style === option.value
                                            ? "border-primary bg-primary/5"
                                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                                    }`}
                                >
                                    <p className="font-medium text-sm">{option.label}</p>
                                    <p className="text-xs text-gray-500 mt-1">{option.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {style !== "hero" && (
                        <>
                            <div className="space-y-2">
                                <Label>Título (opcional)</Label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Conoce nuestra historia"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Subtítulo (opcional)</Label>
                                <Input
                                    value={subtitle}
                                    onChange={(e) => setSubtitle(e.target.value)}
                                    placeholder="Mira cómo hacemos las cosas"
                                />
                            </div>
                        </>
                    )}

                    {style === "hero" && (
                        <div className="space-y-2">
                            <Label>Texto sobre el Video</Label>
                            <Input
                                value={overlayText}
                                onChange={(e) => setOverlayText(e.target.value)}
                                placeholder="Tu marca, tu historia"
                            />
                        </div>
                    )}

                    {videoUrl && (
                        <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-500 p-2 bg-gray-50 dark:bg-gray-800">Vista previa</p>
                            {videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be") ? (
                                <div className="aspect-video">
                                    <iframe
                                        src={videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                                        className="w-full h-full"
                                        allowFullScreen
                                    />
                                </div>
                            ) : (
                                <video
                                    src={videoUrl}
                                    className="w-full aspect-video object-cover"
                                    controls={style === "full"}
                                    autoPlay={style === "clip"}
                                    loop={style === "clip"}
                                    muted={style === "clip"}
                                    playsInline
                                />
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="p-6 border-t border-border-light dark:border-border-dark">
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Guardando..." : "Guardar Video"}
                </Button>
            </div>
        </div>
    )
}
