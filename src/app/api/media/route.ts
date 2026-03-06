import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

// GET /api/media — Lista archivos media de la organización del usuario
export async function GET() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) {
        return NextResponse.json({ error: "Sin organización" }, { status: 403 })
    }

    const { data: media, error } = await supabase
        .from("organization_media")
        .select("id, name, description, file_name, file_url, file_type, file_size, media_category, tags, is_active, usage_count, created_at")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })

    if (error) {
        console.error("[api/media] Error listing media:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ media: media || [] })
}

// POST /api/media — Subir un archivo media
export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) {
        return NextResponse.json({ error: "Sin organización" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const name = formData.get("name") as string | null
    const description = formData.get("description") as string | null
    const mediaCategory = (formData.get("media_category") as string) || "document"
    const tagsRaw = formData.get("tags") as string | null

    if (!file) {
        return NextResponse.json({ error: "No se proporcionó archivo" }, { status: 400 })
    }

    if (!name?.trim()) {
        return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
    }

    // Validar tamaño (máx 10MB)
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: "El archivo no puede superar 10MB" }, { status: 400 })
    }

    // Validar tipo de archivo
    const allowedTypes = [
        "application/pdf",
        "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4",
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "video/mp4", "video/webm",
    ]
    if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: `Tipo de archivo no permitido: ${file.type}. Permitidos: PDF, imágenes, audio, video.` }, { status: 400 })
    }

    // Subir a Supabase Storage
    const serviceClient = createServiceClient()
    const storagePath = `${profile.organization_id}/agent-media/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await serviceClient.storage
        .from("product-images")
        .upload(storagePath, buffer, {
            contentType: file.type,
            upsert: false,
        })

    if (uploadError) {
        console.error("[api/media] Upload error:", uploadError)
        return NextResponse.json({ error: `Error al subir archivo: ${uploadError.message}` }, { status: 500 })
    }

    // Obtener URL pública
    const { data: urlData } = serviceClient.storage
        .from("product-images")
        .getPublicUrl(storagePath)

    const fileUrl = urlData.publicUrl

    // Parsear tags
    const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : []

    // Insertar registro en la tabla
    const { data: mediaRecord, error: insertError } = await serviceClient
        .from("organization_media")
        .insert({
            organization_id: profile.organization_id,
            name: name.trim(),
            description: description?.trim() || null,
            file_name: file.name,
            file_url: fileUrl,
            file_type: file.type,
            file_size: file.size,
            media_category: mediaCategory,
            tags,
            is_active: true,
        })
        .select()
        .single()

    if (insertError) {
        console.error("[api/media] Insert error:", insertError)
        // Limpiar archivo subido si falla el insert
        await serviceClient.storage.from("product-images").remove([storagePath])
        return NextResponse.json({ error: `Error al registrar archivo: ${insertError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, media: mediaRecord })
}

// DELETE /api/media?id=xxx — Eliminar un archivo media
export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const mediaId = searchParams.get("id")

    if (!mediaId) {
        return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) {
        return NextResponse.json({ error: "Sin organización" }, { status: 403 })
    }

    // Obtener el archivo para saber la URL de storage
    const serviceClient = createServiceClient()
    const { data: media } = await serviceClient
        .from("organization_media")
        .select("id, file_url")
        .eq("id", mediaId)
        .eq("organization_id", profile.organization_id)
        .single()

    if (!media) {
        return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 })
    }

    // Extraer path del storage desde la URL
    const urlParts = media.file_url.split("/product-images/")
    if (urlParts.length > 1) {
        const storagePath = decodeURIComponent(urlParts[1])
        await serviceClient.storage.from("product-images").remove([storagePath])
    }

    // Eliminar registro
    const { error: deleteError } = await serviceClient
        .from("organization_media")
        .delete()
        .eq("id", mediaId)
        .eq("organization_id", profile.organization_id)

    if (deleteError) {
        console.error("[api/media] Delete error:", deleteError)
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
