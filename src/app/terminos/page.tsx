import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
    title: "Términos de Servicio | LandingChat",
    description: "Términos y condiciones de uso de la plataforma LandingChat",
}

export default function TerminosPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            <div className="mx-auto max-w-3xl px-6 py-16">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white mb-8"
                >
                    <ArrowLeft className="size-4" />
                    Volver al inicio
                </Link>

                <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-8">
                    Términos de Servicio
                </h1>

                <div className="prose prose-slate dark:prose-invert max-w-none">
                    <p className="text-slate-600 dark:text-slate-300 text-lg">
                        Última actualización: Febrero 2026
                    </p>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            1. Aceptación de los Términos
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            Al acceder y utilizar LandingChat (&quot;la Plataforma&quot;), aceptas estos términos de
                            servicio. Si no estás de acuerdo con alguna parte de estos términos, no debes
                            usar la Plataforma.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            2. Descripción del Servicio
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            LandingChat es una plataforma de Chat-Commerce que permite a negocios:
                        </p>
                        <ul className="list-disc pl-6 mt-4 space-y-2 text-slate-600 dark:text-slate-300">
                            <li>Crear tiendas online con landing pages optimizadas para conversión.</li>
                            <li>Integrar agentes de inteligencia artificial para atención al cliente via WhatsApp.</li>
                            <li>Gestionar catálogo de productos, inventario y pedidos.</li>
                            <li>Procesar pagos a través de pasarelas integradas (Wompi, ePayco, Addi, Bold).</li>
                            <li>Automatizar conversaciones y seguimiento de clientes.</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            3. Requisitos de Uso
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            Para usar LandingChat debes:
                        </p>
                        <ul className="list-disc pl-6 mt-4 space-y-2 text-slate-600 dark:text-slate-300">
                            <li>Ser mayor de 18 años o tener capacidad legal para contratar.</li>
                            <li>Proporcionar información veraz y actualizada.</li>
                            <li>Tener un negocio legalmente establecido en Colombia o Latinoamérica.</li>
                            <li>Cumplir con las políticas de WhatsApp Business y Meta.</li>
                            <li>No usar la plataforma para actividades ilegales o fraudulentas.</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            4. Cuentas y Seguridad
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            Eres responsable de:
                        </p>
                        <ul className="list-disc pl-6 mt-4 space-y-2 text-slate-600 dark:text-slate-300">
                            <li>Mantener la confidencialidad de tus credenciales de acceso.</li>
                            <li>Todas las actividades que ocurran bajo tu cuenta.</li>
                            <li>Notificar inmediatamente cualquier uso no autorizado.</li>
                            <li>Mantener actualizada tu información de contacto.</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            5. Planes y Pagos
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            LandingChat ofrece diferentes planes de suscripción:
                        </p>
                        <ul className="list-disc pl-6 mt-4 space-y-2 text-slate-600 dark:text-slate-300">
                            <li>Los precios se muestran en pesos colombianos (COP) e incluyen IVA.</li>
                            <li>La facturación es mensual y se cobra de forma anticipada.</li>
                            <li>Puedes cancelar tu suscripción en cualquier momento desde el panel.</li>
                            <li>No hay reembolsos por períodos parciales no utilizados.</li>
                            <li>Los límites de conversaciones se reinician el primer día de cada mes.</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            6. Uso del Agente IA
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            El agente de IA de LandingChat:
                        </p>
                        <ul className="list-disc pl-6 mt-4 space-y-2 text-slate-600 dark:text-slate-300">
                            <li>Responde automáticamente a tus clientes según el entrenamiento configurado.</li>
                            <li>Puede cometer errores; eres responsable de supervisar sus respuestas.</li>
                            <li>No reemplaza asesoría profesional (legal, médica, financiera).</li>
                            <li>Está sujeto a las políticas de uso de OpenAI y Anthropic.</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            7. Contenido Prohibido
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            No puedes usar LandingChat para vender o promocionar:
                        </p>
                        <ul className="list-disc pl-6 mt-4 space-y-2 text-slate-600 dark:text-slate-300">
                            <li>Productos o servicios ilegales.</li>
                            <li>Contenido que infrinja derechos de autor o propiedad intelectual.</li>
                            <li>Productos falsificados o réplicas no autorizadas.</li>
                            <li>Sustancias controladas, armas o materiales peligrosos.</li>
                            <li>Esquemas piramidales, estafas o fraudes.</li>
                            <li>Contenido de odio, discriminatorio o que incite a la violencia.</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            8. Propiedad Intelectual
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            LandingChat y todo su contenido (código, diseño, marca, documentación) son
                            propiedad exclusiva de LandingChat SAS. Tú mantienes la propiedad de tu
                            contenido (productos, imágenes, descripciones) pero nos otorgas licencia
                            para mostrarlo en la plataforma.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            9. Limitación de Responsabilidad
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            LandingChat se proporciona &quot;tal cual&quot;. No garantizamos:
                        </p>
                        <ul className="list-disc pl-6 mt-4 space-y-2 text-slate-600 dark:text-slate-300">
                            <li>Disponibilidad ininterrumpida del servicio.</li>
                            <li>Que el servicio esté libre de errores.</li>
                            <li>Resultados específicos de ventas o conversión.</li>
                            <li>La precisión de las respuestas del agente IA.</li>
                        </ul>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            Nuestra responsabilidad máxima se limita al monto pagado por el servicio
                            en los últimos 12 meses.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            10. Suspensión y Terminación
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            Podemos suspender o terminar tu cuenta si:
                        </p>
                        <ul className="list-disc pl-6 mt-4 space-y-2 text-slate-600 dark:text-slate-300">
                            <li>Violas estos términos de servicio.</li>
                            <li>Tu cuenta presenta actividad fraudulenta.</li>
                            <li>Incumples las políticas de Meta/WhatsApp.</li>
                            <li>No pagas tu suscripción después de 30 días.</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            11. Modificaciones
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            Podemos modificar estos términos en cualquier momento. Te notificaremos
                            cambios significativos por correo electrónico con al menos 30 días de
                            anticipación. El uso continuado después de los cambios constituye aceptación.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            12. Ley Aplicable
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            Estos términos se rigen por las leyes de la República de Colombia.
                            Cualquier disputa se resolverá en los tribunales de Bogotá, Colombia.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            13. Contacto
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            Para consultas sobre estos términos:
                        </p>
                        <ul className="list-disc pl-6 mt-4 space-y-2 text-slate-600 dark:text-slate-300">
                            <li><strong>Email:</strong> legal@landingchat.co</li>
                            <li><strong>Sitio web:</strong> www.landingchat.co</li>
                        </ul>
                    </section>
                </div>

                <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        © 2026 LandingChat. Todos los derechos reservados.
                    </p>
                </div>
            </div>
        </div>
    )
}
