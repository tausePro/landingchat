import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
    title: "Política de Privacidad | LandingChat",
    description: "Política de privacidad y tratamiento de datos personales de LandingChat",
}

export default function PrivacidadPage() {
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
                    Política de Privacidad
                </h1>

                <div className="prose prose-slate dark:prose-invert max-w-none">
                    <p className="text-slate-600 dark:text-slate-300 text-lg">
                        Última actualización: Febrero 2026
                    </p>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            1. Información que Recopilamos
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            LandingChat recopila información necesaria para proporcionar nuestros servicios de Chat-Commerce:
                        </p>
                        <ul className="list-disc pl-6 mt-4 space-y-2 text-slate-600 dark:text-slate-300">
                            <li><strong>Información de cuenta:</strong> nombre, correo electrónico, número de teléfono y datos de tu negocio.</li>
                            <li><strong>Datos de conversaciones:</strong> mensajes entre tu negocio y tus clientes a través de WhatsApp para permitir la funcionalidad del agente IA.</li>
                            <li><strong>Información de productos:</strong> catálogo, precios e inventario que cargas en la plataforma.</li>
                            <li><strong>Datos de transacciones:</strong> pedidos, pagos y envíos procesados a través de LandingChat.</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            2. Uso de la Información
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            Utilizamos la información recopilada para:
                        </p>
                        <ul className="list-disc pl-6 mt-4 space-y-2 text-slate-600 dark:text-slate-300">
                            <li>Proporcionar y mejorar nuestros servicios de Chat-Commerce.</li>
                            <li>Entrenar y personalizar tu agente de ventas IA.</li>
                            <li>Procesar pedidos y transacciones.</li>
                            <li>Enviar notificaciones relacionadas con tu cuenta y operaciones.</li>
                            <li>Cumplir con obligaciones legales y fiscales.</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            3. Integración con WhatsApp
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            LandingChat se integra con la API oficial de WhatsApp Business de Meta. Al conectar tu cuenta de WhatsApp:
                        </p>
                        <ul className="list-disc pl-6 mt-4 space-y-2 text-slate-600 dark:text-slate-300">
                            <li>Accedemos a los mensajes enviados a tu número de WhatsApp Business.</li>
                            <li>Enviamos mensajes en tu nombre a través de tu número conectado.</li>
                            <li>Los datos se procesan de acuerdo con las políticas de Meta y WhatsApp.</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            4. Compartición de Datos
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            No vendemos tu información personal. Compartimos datos únicamente con:
                        </p>
                        <ul className="list-disc pl-6 mt-4 space-y-2 text-slate-600 dark:text-slate-300">
                            <li><strong>Proveedores de servicios:</strong> pasarelas de pago (Wompi, ePayco), servicios de envío, y proveedores de infraestructura.</li>
                            <li><strong>Meta/WhatsApp:</strong> para la funcionalidad de mensajería.</li>
                            <li><strong>Autoridades:</strong> cuando sea requerido por ley.</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            5. Seguridad de Datos
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            Implementamos medidas de seguridad técnicas y organizativas para proteger tu información:
                        </p>
                        <ul className="list-disc pl-6 mt-4 space-y-2 text-slate-600 dark:text-slate-300">
                            <li>Cifrado de datos en tránsito (HTTPS/TLS) y en reposo.</li>
                            <li>Acceso restringido a datos personales.</li>
                            <li>Monitoreo continuo de seguridad.</li>
                            <li>Infraestructura alojada en proveedores certificados.</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            6. Tus Derechos
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            De acuerdo con la Ley 1581 de 2012 (Colombia) y normativas aplicables, tienes derecho a:
                        </p>
                        <ul className="list-disc pl-6 mt-4 space-y-2 text-slate-600 dark:text-slate-300">
                            <li>Conocer, actualizar y rectificar tus datos personales.</li>
                            <li>Solicitar prueba de la autorización otorgada.</li>
                            <li>Ser informado sobre el uso dado a tus datos.</li>
                            <li>Revocar la autorización y/o solicitar la supresión de datos.</li>
                            <li>Acceder gratuitamente a tus datos personales.</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            7. Retención de Datos
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            Conservamos tu información mientras mantengas una cuenta activa con nosotros.
                            Tras la cancelación, retenemos ciertos datos por el período requerido por ley
                            (generalmente 5 años para información fiscal en Colombia).
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            8. Contacto
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            Para ejercer tus derechos o resolver dudas sobre esta política:
                        </p>
                        <ul className="list-disc pl-6 mt-4 space-y-2 text-slate-600 dark:text-slate-300">
                            <li><strong>Email:</strong> privacidad@landingchat.co</li>
                            <li><strong>Dirección:</strong> Colombia</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            9. Cambios a esta Política
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-4">
                            Podemos actualizar esta política periódicamente. Te notificaremos sobre cambios
                            significativos a través del correo electrónico asociado a tu cuenta o mediante
                            un aviso en nuestra plataforma.
                        </p>
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
