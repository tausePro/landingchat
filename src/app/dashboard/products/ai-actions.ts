"use server"

import { createMessage } from "@/lib/ai/anthropic"

interface EnhanceDescriptionInput {
    name: string
    description?: string
    category?: string
    price: number
}

interface EnhanceDescriptionResult {
    description: string | null
    meta_title: string
    meta_description: string
    keywords: string[]
}

/**
 * Genera metadatos SEO para un producto usando IA
 * Si la descripción ya existe y es buena (>100 chars), solo genera SEO sin modificarla
 * Si no hay descripción o es muy corta, genera una nueva
 * @param input - Datos del producto
 * @returns Metadatos SEO y opcionalmente descripción mejorada
 */
export async function enhanceProductDescription(
    input: EnhanceDescriptionInput
): Promise<{ success: true; data: EnhanceDescriptionResult } | { success: false; error: string }> {
    try {
        const hasGoodDescription = input.description && input.description.length > 100
        
        const prompt = hasGoodDescription 
            ? `Eres un experto en SEO para e-commerce en Latinoamérica.

PRODUCTO:
- Nombre: ${input.name}
- Descripción existente: ${input.description}
- Categoría: ${input.category || "General"}
- Precio: $${input.price.toLocaleString()} COP

TAREA: Genera SOLO los metadatos SEO basándote en la descripción existente. NO modifiques la descripción.

INSTRUCCIONES:
1. Genera un meta_title SEO (máximo 60 caracteres) - debe ser atractivo para clics
2. Genera una meta_description SEO (máximo 155 caracteres) - resumen persuasivo
3. Sugiere 3-5 keywords relevantes en español basadas en el contenido

RESPONDE ÚNICAMENTE con JSON válido (sin markdown, sin backticks):
{
  "meta_title": "título SEO aquí",
  "meta_description": "meta descripción aquí", 
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`
            : `Eres un experto en copywriting para e-commerce en Latinoamérica.

PRODUCTO:
- Nombre: ${input.name}
- Descripción actual: ${input.description || "Sin descripción"}
- Categoría: ${input.category || "General"}
- Precio: $${input.price.toLocaleString()} COP

TAREA: Crea una descripción atractiva Y los metadatos SEO.

INSTRUCCIONES:
1. Crea una descripción persuasiva (200-400 caracteres) que destaque beneficios
2. Usa un tono amigable y profesional
3. Incluye un llamado a la acción sutil
4. Genera un meta_title SEO (máximo 60 caracteres)
5. Genera una meta_description SEO (máximo 155 caracteres)
6. Sugiere 3-5 keywords relevantes en español

RESPONDE ÚNICAMENTE con JSON válido (sin markdown, sin backticks):
{
  "description": "descripción aquí",
  "meta_title": "título SEO aquí",
  "meta_description": "meta descripción aquí", 
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`

        const response = await createMessage({
            model: "claude-sonnet-4-20250514",
            max_tokens: 500,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ]
        })

        // Extract text from response
        const textContent = response.content.find(c => c.type === 'text')
        if (!textContent || textContent.type !== 'text') {
            throw new Error("No se recibió texto de la IA")
        }

        // Parse JSON response
        let result: EnhanceDescriptionResult
        try {
            // Clean potential markdown backticks
            let jsonText = textContent.text.trim()
            if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim()
            }
            result = JSON.parse(jsonText)
        } catch (parseError) {
            console.error("Error parsing AI response:", textContent.text)
            throw new Error("Error al procesar la respuesta de la IA")
        }

        // Validate and trim results
        // Si había buena descripción, no la reemplazamos (description será null)
        return {
            success: true,
            data: {
                description: hasGoodDescription ? null : (result.description?.slice(0, 500) || null),
                meta_title: result.meta_title?.slice(0, 70) || "",
                meta_description: result.meta_description?.slice(0, 160) || "",
                keywords: Array.isArray(result.keywords) ? result.keywords.slice(0, 5) : []
            }
        }
    } catch (error) {
        console.error("Error enhancing description:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido"
        }
    }
}
