/**
 * API Route para uploads de archivos grandes (videos, PDFs, catálogos)
 * Los server actions de Next.js truncan archivos grandes al serializar FormData.
 * Esta API route maneja FormData nativamente sin límite de serialización.
 * 
 * Límites: 50MB (configurado en next.config.ts serverActions.bodySizeLimit)
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

const BUCKET_NAME = "product-images"

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "avif"]
const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "avi"]
const DOC_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt"]
const ALL_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, ...DOC_EXTENSIONS]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

function getFileType(name: string): "image" | "video" | "document" {
    const ext = name.split(".").pop()?.toLowerCase() || ""
    if (VIDEO_EXTENSIONS.includes(ext)) return "video"
    if (DOC_EXTENSIONS.includes(ext)) return "document"
    return "image"
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()

        // Auth check
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 })
        }

        // Get org
        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()

        if (!profile?.organization_id) {
            return NextResponse.json({ error: "No se encontró organización" }, { status: 400 })
        }

        const orgId = profile.organization_id

        // Parse FormData
        const formData = await request.formData()
        const file = formData.get("file") as File | null

        if (!file) {
            return NextResponse.json({ error: "No se encontró archivo" }, { status: 400 })
        }

        // Validate extension
        const ext = file.name.split(".").pop()?.toLowerCase() || ""
        if (!ALL_EXTENSIONS.includes(ext)) {
            return NextResponse.json({ error: `Tipo de archivo no soportado: .${ext}` }, { status: 400 })
        }

        // Validate size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: `El archivo excede el límite de 50MB (${(file.size / 1024 / 1024).toFixed(1)}MB)` }, { status: 400 })
        }

        // Generate unique name
        const timestamp = Date.now()
        const safeName = file.name
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .toLowerCase()
        const fileName = `${timestamp}-${safeName}`
        const filePath = `${orgId}/${fileName}`

        // Convertir archivo a Buffer para procesar en Node.js runtime
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Upload to Supabase Storage usando service client (bypasea RLS)
        const serviceClient = createServiceClient()
        const { data, error } = await serviceClient.storage
            .from(BUCKET_NAME)
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: false,
            })

        if (error) {
            return NextResponse.json({ error: `Error subiendo archivo: ${error.message}` }, { status: 500 })
        }

        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(data.path)

        return NextResponse.json({
            success: true,
            data: {
                id: data.path,
                name: fileName,
                fullPath: data.path,
                publicUrl,
                type: getFileType(fileName),
                size: file.size,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }
        })
    } catch (error) {
        console.error("[media/upload] Error:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Error desconocido" },
            { status: 500 }
        )
    }
}
