/**
 * Endpoint legacy de webhook Wompi.
 *
 * Mantenido para no romper URLs ya registradas en el panel de Wompi.
 * Delega toda la lógica al handler dinámico `[provider]/route.ts`.
 */

import { POST as dynamicPost, GET as dynamicGet } from "../[provider]/route"

const PROVIDER = "wompi"

export async function POST(request: Request) {
    return dynamicPost(request, { params: Promise.resolve({ provider: PROVIDER }) })
}

export async function GET(request: Request) {
    return dynamicGet(request, { params: Promise.resolve({ provider: PROVIDER }) })
}
