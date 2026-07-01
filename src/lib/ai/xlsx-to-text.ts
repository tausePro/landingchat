import ExcelJS from "exceljs"

/**
 * Convierte un archivo .xlsx (buffer) a texto plano para inyectarlo en el contexto
 * del agente (documentos de conocimiento).
 *
 * Formato: por cada hoja se emite un encabezado `HOJA <nombre>:` seguido de sus filas.
 * Las celdas se separan con " | " y las filas con " || " para que la estructura
 * sobreviva a la limpieza de whitespace que hace el endpoint que lo consume.
 * Las filas completamente vacías se omiten.
 */
export async function xlsxBufferToText(buffer: Buffer): Promise<string> {
    const workbook = new ExcelJS.Workbook()
    // exceljs tipa load() con un Buffer que no coincide con el Buffer<ArrayBuffer> que
    // devuelve Buffer.from() (skew de @types/node). Casteamos al tipo exacto que espera
    // exceljs; en runtime es un Buffer válido.
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0])

    const rows: string[] = []
    workbook.eachSheet((sheet) => {
        rows.push(`HOJA ${sheet.name}:`)
        sheet.eachRow({ includeEmpty: false }, (row) => {
            const cells: string[] = []
            row.eachCell({ includeEmpty: true }, (cell) => {
                cells.push(String(cell.text ?? "").trim())
            })
            if (cells.some((c) => c !== "")) rows.push(cells.join(" | "))
        })
    })

    return rows.join(" || ")
}
