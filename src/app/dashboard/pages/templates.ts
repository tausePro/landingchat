// Templates predefinidos para páginas informativas
// Ahora usando formato JSONB estructurado basado en prototipos Stitch

import { FAQContent, LegalContent, AboutContent } from "@/types/page-content"

export type PageTemplate = {
    slug: string
    title: string
    content_jsonb: FAQContent | LegalContent | AboutContent
    seo_title: string
    seo_description: string
}

export const PAGE_TEMPLATES: PageTemplate[] = [
    // FAQ Template (Prot otipo 42)
    {
        slug: "faq",
        title: "Preguntas Frecuentes",
        content_jsonb: {
            type: 'faq',
            title: "Preguntas Frecuentes",
            searchPlaceholder: "¿En qué podemos ayudarte?",
            categories: [
                { id: "general", name: "General" },
                { id: "cuenta", name: "Mi Cuenta" },
                { id: "pagos", name: "Pagos" },
                { id: "devoluciones", name: "Devoluciones" },
                { id: "envios", name: "Envíos" }
            ],
            questions: [
                {
                    id: "q1",
                    question: "¿Cómo puedo realizar un pedido?",
                    answer: "<p>Para realizar un pedido, simplemente navega por nuestra tienda, añade los productos al carrito y sigue los pasos del proceso de pago. Recibirás un correo de confirmación una vez finalizado el proceso de compra de forma exitosa.</p>",
                    category: "general"
                },
                {
                    id: "q2",
                    question: "¿Cuáles son los métodos de pago aceptados?",
                    answer: "<p>Aceptamos las principales tarjetas de crédito (Visa, Mastercard, American Express), así como pagos a través de PayPal, PSE y transferencias bancarias directas para pedidos seleccionados.</p>",
                    category: "pagos"
                },
                {
                    id: "q3",
                    question: "¿Cómo puedo rastrear mi envío?",
                    answer: "<p>Una vez que tu pedido sea enviado, recibirás un correo electrónico con un número de seguimiento y un enlace directo para consultar el estado del transporte en tiempo real.</p>",
                    category: "envios"
                },
                {
                    id: "q4",
                    question: "¿Cuál es la política de devoluciones?",
                    answer: "<p>Ofrecemos devoluciones gratuitas dentro de los primeros 30 días posteriores a la recepción del producto, siempre y cuando el artículo se encuentre en su estado original y con el embalaje completo.</p>",
                    category: "devoluciones"
                },
                {
                    id: "q5",
                    question: "¿Cómo cambio la contraseña de mi cuenta?",
                    answer: "<p>Puedes cambiar tu contraseña desde la sección 'Ajustes' en tu panel de usuario. Si has olvidado tu contraseña actual, utiliza la opción 'Olvidé mi contraseña' en la pantalla de inicio de sesión.</p>",
                    category: "cuenta"
                }
            ],
            cta: {
                title: "¿No encontraste lo que buscabas?",
                description: "Nuestro equipo de soporte está disponible para ayudarte.",
                buttonText: "Chatear con un experto"
            }
        },
        seo_title: "Preguntas Frecuentes | FAQ",
        seo_description: "Encuentra respuestas a las preguntas más comunes sobre nuestros productos, envíos y políticas."
    },

    // Terms Template (Prototipo 43)
    {
        slug: "terminos",
        title: "Términos y Condiciones",
        content_jsonb: {
            type: 'legal',
            title: "Términos y Condiciones",
            lastUpdated: new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }),
            sections: [
                {
                    id: "intro",
                    title: "Introducción",
                    content: "<p>Bienvenida/o a nuestra tienda. Al acceder y utilizar este sitio web, usted acepta cumplir con los siguientes términos y condiciones de uso. Estos términos rigen la relación entre nuestra tienda y sus usuarios finales.</p><p>Si no está de acuerdo con alguna parte de estos términos, le rogamos que no utilice nuestros servicios. La utilización continuada de la plataforma constituye la aceptación de cualquier modificación realizada en el futuro.</p>"
                },
                {
                    id: "uso",
                    title: "Uso del Sitio",
                    content: "<p>El contenido de las páginas de este sitio web es para su información general y uso exclusivo. Está sujeto a cambios sin previo aviso. Ni nosotros ni terceros ofrecemos ninguna garantía en cuanto a la exactitud, puntualidad, rendimiento, integridad o adecuación de la información encontrada.</p><ul class='list-disc pl-6 space-y-3 mb-6'><li>El uso de cualquier información o material en este sitio es bajo su propio riesgo.</li><li>Es su responsabilidad asegurarse de que cualquier producto o servicio cumpla con sus requisitos específicos.</li><li>Se prohíbe el uso no autorizado de este sitio web, lo que puede dar lugar a una reclamación por daños y perjuicios.</li></ul>"
                },
                {
                    id: "propiedad",
                    title: "Propiedad Intelectual",
                    content: "<p>Este sitio web contiene material que es propiedad nuestra o tiene licencia para nosotros. Este material incluye, pero no se limita a, el diseño, la maquetación, el aspecto, la apariencia y los gráficos. La reproducción está prohibida salvo de conformidad con el aviso de derechos de autor.</p><p>Todas las marcas comerciales reproducidas en este sitio web, que no son propiedad del operador ni tienen licencia para este, son reconocidas en el sitio web.</p>"
                },
                {
                    id: "responsabilidad",
                    title: "Responsabilidad",
                    content: "<p>No seremos responsables de ningún daño indirecto, incidental o consecuente que surja del uso de los servicios. Trabajamos diligentemente para mantener el sitio activo 24/7, sin embargo, no nos hacemos responsables por caídas temporales del servidor debido a problemas técnicos ajenos a nuestro control.</p>"
                },
                {
                    id: "contacto",
                    title: "Contacto",
                    content: "<p>Si tiene alguna pregunta sobre estos Términos y Condiciones, puede ponerse en contacto con nosotros a través de nuestro correo electrónico de soporte: <strong>legal@tutienda.com</strong></p>"
                }
            ]
        },
        seo_title: "Términos y Condiciones",
        seo_description: "Lee nuestros términos y condiciones de uso del sitio web y servicios."
    },

    // Privacy Template (Prototipo 44)
    {
        slug: "privacidad",
        title: "Política de Privacidad",
        content_jsonb: {
            type: 'legal',
            title: "Política de Privacidad",
            lastUpdated: new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }),
            sections: [
                {
                    id: "recopilacion",
                    title: "Información que recopilamos",
                    content: "<p>Nos tomamos muy en serio la privacidad de nuestros usuarios. Recopilamos información para proporcionar mejores servicios a todos nuestros clientes. Los tipos de datos que podemos recopilar incluyen:</p><ul class='list-disc pl-6 space-y-4 mb-6'><li><strong class='text-slate-900 dark:text-white'>Datos de identificación:</strong> Nombre, apellidos, dirección de correo electrónico y número de teléfono.</li><li><strong class='text-slate-900 dark:text-white'>Información de facturación:</strong> Detalles de pago necesarios para procesar sus suscripciones o compras.</li><li><strong class='text-slate-900 dark:text-white'>Datos de uso:</strong> Información sobre cómo interactúa con nuestra plataforma, incluyendo dirección IP y tipo de navegador.</li><li><strong class='text-slate-900 dark:text-white'>Contenido del usuario:</strong> Mensajes y configuraciones personalizadas dentro de su panel.</li></ul>"
                },
                {
                    id: "uso",
                    title: "Cómo usamos su información",
                    content: "<p>Utilizamos la información recopilada con el único propósito de mejorar nuestra oferta de servicios y personalizar su experiencia en la plataforma. Específicamente, los datos se utilizan para:</p><ul class='list-disc pl-6 space-y-4 mb-6'><li>Gestionar y mantener su cuenta de usuario de forma segura.</li><li>Procesar transacciones y enviar notificaciones de facturación.</li><li>Brindar soporte técnico eficiente y responder a sus consultas.</li><li>Analizar el rendimiento del sitio para optimizar la velocidad y seguridad.</li></ul>"
                },
                {
                    id: "proteccion",
                    title: "Protección de datos",
                    content: "<p>Implementamos una variedad de medidas de seguridad para mantener la seguridad de su información personal. Utilizamos encriptación SSL de nivel bancario para proteger la información confidencial transmitida en línea.</p><p>Solo los empleados que necesitan la información para realizar un trabajo específico (por ejemplo, facturación o servicio al cliente) tienen acceso a la información de identificación personal. Los servidores en los que almacenamos la información se mantienen en un entorno seguro y controlado.</p>"
                },
                {
                    id: "cookies",
                    title: "Cookies",
                    content: "<p>Las cookies son pequeños archivos que un sitio o su proveedor de servicios transfiere al disco duro de su computadora a través de su navegador web. Utilizamos cookies para:</p><ul class='list-disc pl-6 space-y-4 mb-6'><li>Recordar y procesar los artículos en su carrito de compras.</li><li>Comprender y guardar las preferencias del usuario para futuras visitas.</li><li>Recopilar datos agregados sobre el tráfico del sitio y las interacciones para ofrecer mejores experiencias en el futuro.</li></ul>"
                },
                {
                    id: "derechos",
                    title: "Sus derechos",
                    content: "<p>Usted tiene derecho en cualquier momento a solicitar acceso a sus datos, su corrección o eliminación. También puede oponerse al tratamiento de sus datos o solicitar la limitación del mismo bajo las condiciones establecidas por la ley de protección de datos aplicable.</p>"
                },
                {
                    id: "contacto",
                    title: "Contacto",
                    content: "<p>Si tiene preguntas adicionales sobre nuestra política de privacidad, no dude en ponerse en contacto con nuestro oficial de protección de datos a través de: <strong>privacy@tutienda.com</strong></p>"
                }
            ]
        },
        seo_title: "Política de Privacidad",
        seo_description: "Conoce cómo protegemos y utilizamos tu información personal."
    },

    // About Template (Prototipo 45)
    {
        slug: "sobre-nosotros",
        title: "Sobre Nosotros",
        content_jsonb: {
            type: 'about',
            hero: {
                title: "Nuestra Esencia",
                subtitle: "Creando conexiones que trascienden el comercio y transforman experiencias a través de la pasión y el detalle.",
                ctaText: "Conoce nuestra historia"
            },
            story: {
                tagline: "Donde Todo Comenzó",
                title: "Una visión compartida por la excelencia",
                paragraphs: [
                    "Desde nuestros inicios, nos hemos propuesto redefinir la calidad y el compromiso social. No solo vendemos productos; entregamos pedazos de nuestra historia en cada interacción.",
                    "Nuestra narrativa es una de perseverancia e innovación. Creemos que el comercio digital debe sentirse tan cercano y humano como una charla entre amigos. Esa es la chispa detrás de nuestro proyecto."
                ]
            },
            values: [
                {
                    icon: "energy_savings_leaf",
                    title: "Sustentabilidad",
                    description: "Comprometidos con el medio ambiente y procesos responsables en cada etapa de producción."
                },
                {
                    icon: "workspace_premium",
                    title: "Calidad",
                    description: "Cada pieza cuenta una historia de excelencia local y manos expertas que cuidan el detalle."
                },
                {
                    icon: "lightbulb",
                    title: "Innovación",
                    description: "Buscamos constantemente nuevas formas de sorprenderte y mejorar tu vida cotidiana."
                }
            ],
            stats: [
                { value: "5+", label: "Años de Experiencia" },
                { value: "+1k", label: "Clientes Felices" },
                { value: "100%", label: "Hecho con ❤️" }
            ],
            cta: {
                title: "¿Quieres saber más?",
                description: "Estamos a un clic de distancia. Chatea con nuestro equipo ahora y descubre cómo podemos transformar tu experiencia.",
                buttonText: "Chatear con nosotros ahora"
            }
        },
        seo_title: "Sobre Nosotros",
        seo_description: "Conoce nuestra historia, valores y el equipo detrás de esta experiencia única."
    }
]
