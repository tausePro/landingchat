import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_TEXT_LENGTH = 50000 // ~50k chars para no saturar el contexto

const VALID_EXTENSIONS = [".pdf", ".txt", ".md", ".csv"]

/**
 * POST /api/agents/documents
 * Sube un PDF, extrae el texto y lo guarda en agent_documents.
 * Body: FormData con fields: agentId, file
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 })
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()

        if (!profile?.organization_id) {
            return NextResponse.json({ error: "Sin organización" }, { status: 400 })
        }

        const formData = await request.formData()
        const agentId = formData.get("agentId") as string
        const file = formData.get("file") as File

        if (!agentId || !file) {
            return NextResponse.json({ error: "agentId y file son requeridos" }, { status: 400 })
        }

        // Validar que el agente pertenece a la org
        const { data: agent } = await supabase
            .from("agents")
            .select("id")
            .eq("id", agentId)
            .eq("organization_id", profile.organization_id)
            .single()

        if (!agent) {
            return NextResponse.json({ error: "Agente no encontrado" }, { status: 404 })
        }

        // Validar archivo
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: "El archivo supera el límite de 5MB" }, { status: 400 })
        }

        const fileExt = "." + (file.name.split(".").pop()?.toLowerCase() || "")
        if (!VALID_EXTENSIONS.includes(fileExt)) {
            return NextResponse.json({ error: `Solo se aceptan archivos: ${VALID_EXTENSIONS.join(", ")}` }, { status: 400 })
        }

        // Crear registro en BD con status "processing"
        const { data: doc, error: insertError } = await supabase
            .from("agent_documents")
            .insert({
                agent_id: agentId,
                organization_id: profile.organization_id,
                name: file.name,
                file_type: fileExt.replace(".", ""),
                file_size: file.size,
                status: "processing",
            })
            .select("id")
            .single()

        if (insertError) {
            console.error("[agents/documents] Insert error:", insertError)
            return NextResponse.json({ error: "Error creando registro" }, { status: 500 })
        }

        // Subir archivo a Storage
        const serviceClient = createServiceClient()
        const filePath = `${profile.organization_id}/agents/${agentId}/${doc.id}-${file.name}`

        const { error: uploadError } = await serviceClient.storage
            .from("organization-logos") // Reutilizar bucket existente
            .upload(filePath, file, { cacheControl: "3600", upsert: false })

        let fileUrl = ""
        if (!uploadError) {
            const { data: { publicUrl } } = serviceClient.storage
                .from("organization-logos")
                .getPublicUrl(filePath)
            fileUrl = publicUrl
        }

        // Extraer texto
        let extractedText = ""
        try {
            const buffer = Buffer.from(await file.arrayBuffer())

            if (fileExt === ".pdf") {
                // pdf-parse v1: usar ruta interna para evitar el bug del archivo de test
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const pdfParse = require("pdf-parse/lib/pdf-parse.js")
                const pdfData = await pdfParse(buffer)
                extractedText = pdfData.text
            } else if (fileExt === ".csv") {
                // xlsx: parse Excel/CSV to text
                extractedText = buffer.toString("utf-8")
            } else {
                // TXT, MD: read as UTF-8
                extractedText = buffer.toString("utf-8")
            }

            // Limpiar y truncar
            extractedText = extractedText
                .replace(/\s+/g, " ")
                .replace(/\n{3,}/g, "\n\n")
                .trim()

            if (extractedText.length > MAX_TEXT_LENGTH) {
                extractedText = extractedText.substring(0, MAX_TEXT_LENGTH) + "\n\n[... documento truncado por tamaño]"
            }
        } catch (parseError) {
            console.error("[agents/documents] Parse error:", parseError)
            await supabase
                .from("agent_documents")
                .update({
                    status: "error",
                    error_message: "No se pudo extraer texto del archivo",
                    file_url: fileUrl || null,
                })
                .eq("id", doc.id)

            return NextResponse.json({
                success: true,
                document: { id: doc.id, status: "error", error: "No se pudo extraer texto" },
            })
        }

        // Actualizar registro con texto extraído
        await supabase
            .from("agent_documents")
            .update({
                extracted_text: extractedText,
                file_url: fileUrl || null,
                status: "ready",
            })
            .eq("id", doc.id)

        return NextResponse.json({
            success: true,
            document: {
                id: doc.id,
                name: file.name,
                status: "ready",
                textLength: extractedText.length,
                preview: extractedText.substring(0, 200) + "...",
            },
        })
    } catch (error) {
        console.error("[agents/documents] Error:", error)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}

/**
 * DELETE /api/agents/documents?id=xxx
 * Elimina un documento.
 */
export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()

        if (!profile?.organization_id) return NextResponse.json({ error: "Sin organización" }, { status: 400 })

        const docId = request.nextUrl.searchParams.get("id")
        if (!docId) return NextResponse.json({ error: "id es requerido" }, { status: 400 })

        const { error } = await supabase
            .from("agent_documents")
            .delete()
            .eq("id", docId)
            .eq("organization_id", profile.organization_id)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[agents/documents] Delete error:", error)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}
