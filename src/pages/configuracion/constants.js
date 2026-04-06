export const TABS = [
    { id: 'agencia', label: '🏢 Datos de Agencia', icon: '🏢' },
    { id: 'plantillas', label: '✉️ Plantillas Email', icon: '✉️' },
    { id: 'whatsapp', label: '📲 Plantillas WhatsApp', icon: '📲' },
    { id: 'backup', label: '☁️ Copias de Seguridad', icon: '☁️' },
    { id: 'seed', label: '📥 Datos Iniciales', icon: '📥' },
]

export const TIPOS_PLANTILLA = ['lead_primer_contacto', 'lead_seguimiento', 'lead_reenganche', 'cotizacion', 'confirmacion', 'recordatorio', 'resena']
export const TIPOS_MARKETING = ['lead_primer_contacto', 'lead_seguimiento', 'lead_reenganche']
export const TIPOS_OPERATIVAS = ['cotizacion', 'confirmacion', 'recordatorio', 'resena']

export const TIPOS_LABELS = {
    lead_primer_contacto: '1. Primer Contacto (Lead Nuevo)',
    lead_seguimiento: '2. Seguimiento (Lead Frío)',
    lead_reenganche: '3. Re-enganche (Promo Lead)',
    cotizacion: '1. Cotización',
    confirmacion: '2. Confirmación de Reserva',
    recordatorio: '3. Recordatorio Pre-Tour',
    resena: '4. Solicitud de Reseña',
}

export const SHORTCODES_HELP = [
    { code: '{nombre}', desc: 'Nombre del cliente' },
    { code: '{tour}', desc: 'Tour contratado' },
    { code: '{fecha}', desc: 'Fecha del tour' },
    { code: '{FechaViaje}', desc: 'Fecha exacta o Mes de Viaje' },
    { code: '{pax}', desc: 'Número de pasajeros' },
    { code: '{precio}', desc: 'Precio total de venta' },
    { code: '{adelanto}', desc: 'Monto del adelanto' },
    { code: '{saldo}', desc: 'Saldo pendiente' },
    { code: '{agencia}', desc: 'Nombre de tu agencia' },
    { code: '{remitente}', desc: 'Firma gerente / dueño' },
    { code: '{email}', desc: 'Email de tu Agencia' },
    { code: '{telefono}', desc: 'WhatsApp de tu Agencia' },
    { code: '{opcionales}', desc: 'Opcionales contratados' },
    { code: '{social_proof}', desc: 'Testimonios / Reviews' },
]

// Keys rendered as normal form fields (email keys handled separately by custom UI)
export const CONFIG_KEYS = [
    { clave: 'nombre_visible', label: 'Nombre Visible de la Agencia', placeholder: 'Ej. SamiMunay Tours', type: 'text' },
    { clave: 'logo_url', label: 'URL del Logo (1:1 o horizontal)', placeholder: 'https://...', type: 'url' },
    { clave: 'color_marca', label: 'Color de Marca (Naranja/Azul/Verde)', placeholder: '#1a73e8', type: 'color' }, // Added brand color
    { clave: 'whatsapp', label: 'WhatsApp Principal', placeholder: '+51987654321', type: 'text' },
    { clave: 'email_contacto', label: 'Email de Contacto', placeholder: 'reservas@tuagencia.com', type: 'email' },
    { clave: 'email_preheader', label: 'Texto Preview en Bandeja (Inbox)', placeholder: 'Ej. Tu aventura en Cusco te espera...', type: 'text' }, // Added preheader
    { clave: 'nombre_remitente', label: 'Nombre del Remitente (Firma)', placeholder: 'Ej. Carlos de SamiMunay', type: 'text' },
    { clave: 'moneda', label: 'Moneda por Defecto', placeholder: 'USD', type: 'text' },
    { clave: 'mensaje_whatsapp', label: 'Mensaje WhatsApp por Defecto', placeholder: 'Hola {nombre}, gracias por...', type: 'textarea' },
    { clave: 'url_web', label: 'URL de tu Sitio Web', placeholder: 'https://www.tuagencia.com', type: 'url' },
    { clave: 'meta_page_id', label: 'Facebook Page ID (Numérico)', placeholder: 'Ej. 1029384756', type: 'text' },
    { clave: 'meta_page_access_token', label: 'Meta Page Access Token (Token Permanente)', placeholder: 'EAAO...', type: 'password' },
    { clave: 'meta_verify_token', label: 'Meta Webhook Verify Token', placeholder: 'mi_secreto_123', type: 'password' },
    { clave: 'webhook_api_key', label: 'Tu Webhook API Key (Lead Externa)', placeholder: 'm1-s3cr3t-t0k3n', type: 'password' },
]

// These keys are persisted to DB alongside CONFIG_KEYS but rendered via the custom Email Provider UI
export const EMAIL_CONFIG_KEYS = [
    'proveedor_email',      // 'gmail' | 'resend'
    'resend_api_key',
    'gmail_app_password',
    'email_remitente',
]
