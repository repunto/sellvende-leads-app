import { supabase } from './supabase'

/**
 * Datos iniciales genéricos para demostración B2B.
 * Se insertan automáticamente al presionar "Cargar Datos Iniciales"
 * desde la página de Configuración.
 */

const PRODUCTOS_SEED = [
    { nombre: 'Plan Básico', duracion_dias: 30, precio_usd: 99.00, costo_asesor: 50.00, descripcion: 'Plan de entrada con funcionalidades esenciales.', activo: true },
    { nombre: 'Plan Profesional', duracion_dias: 30, precio_usd: 249.00, costo_asesor: 120.00, descripcion: 'Plan avanzado con reportes y soporte prioritario.', activo: true },
    { nombre: 'Plan Enterprise', duracion_dias: 30, precio_usd: 499.00, costo_asesor: 250.00, descripcion: 'Plan corporativo con integraciones a medida.', activo: true },
    { nombre: 'Consultoría Personalizada', duracion_dias: 1, precio_usd: 150.00, costo_asesor: 80.00, descripcion: 'Sesión de consultoría 1-on-1 de 2 horas.', activo: true },
]

const ASESORES_SEED = [
    { nombre: 'Vendedor Demo 1', telefono: '+51987654321', email: 'vendedor1@demo.com', activo: true },
    { nombre: 'Vendedor Demo 2', telefono: '+51999888777', email: 'vendedor2@demo.com', activo: true },
]

const LEADS_SEED = [
    { nombre: 'Carlos Rodríguez', email: 'carlos.rodriguez@gmail.com', telefono: '+14155551234', producto_interes: 'Plan Profesional', origen: 'Meta Ads', idioma: 'ES', personas: 'entre_2_a_4', temporada: 'buena_temporada', estado: 'nuevo', notas: 'Interesado en la demo del producto' },
    { nombre: 'María García', email: 'maria.garcia@hotmail.com', telefono: '+5491155778899', producto_interes: 'Plan Enterprise', origen: 'Meta Ads', idioma: 'ES', personas: 'grupo_5_mas', temporada: 'buena_temporada', estado: 'contactado', notas: 'Empresa con 15 empleados' },
    { nombre: 'David Johnson', email: 'djohnson@yahoo.com', telefono: '+447911123456', producto_interes: 'Plan Básico', origen: 'Web', idioma: 'EN', personas: 'entre_2_a_4', temporada: 'buena_temporada', estado: 'cotizado', notas: 'Startup, quiere escalar en 3 meses' },
    { nombre: 'Ana López', email: 'ana.lopez@gmail.com', telefono: '+5215512345678', producto_interes: 'Consultoría Personalizada', origen: 'Referido', idioma: 'ES', personas: 'solo_yo', temporada: 'temporada_lluvia', estado: 'nuevo', notas: 'Emprendedora, primera compra' },
]

const VENTAS_SEED = [
    { cliente_nombre: 'Pedro Martínez', cliente_email: 'pedro.m@outlook.com', cliente_telefono: '+33612345678', producto_interes: 'Plan Profesional', fecha_servicio: '2026-04-15', pax: 1, idioma: 'ES', precio_venta: 249.00, costo_asesor: 120.00, adelanto: 125.00, pago_asesor: 60.00, estado: 'confirmada' },
    { cliente_nombre: 'María García', cliente_email: 'maria.garcia@hotmail.com', cliente_telefono: '+5491155778899', producto_interes: 'Plan Enterprise', fecha_servicio: '2026-04-20', pax: 1, idioma: 'ES', precio_venta: 499.00, costo_asesor: 250.00, adelanto: 250.00, pago_asesor: 125.00, estado: 'confirmada' },
    { cliente_nombre: 'David Johnson', cliente_email: 'djohnson@yahoo.com', cliente_telefono: '+447911123456', producto_interes: 'Plan Básico', fecha_servicio: '2026-05-10', pax: 1, idioma: 'EN', precio_venta: 99.00, costo_asesor: 50.00, adelanto: 50.00, pago_asesor: 0, estado: 'pendiente' },
    { cliente_nombre: 'Laura Fernández', cliente_email: 'laura.f@gmail.com', cliente_telefono: '+81901234567', producto_interes: 'Consultoría Personalizada', fecha_servicio: '2026-05-20', pax: 1, idioma: 'ES', precio_venta: 150.00, costo_asesor: 80.00, adelanto: 0, pago_asesor: 0, estado: 'pendiente' },
]

const EMAIL_TEMPLATES_SEED = [
    { tipo: 'cotizacion', idioma: 'ES', asunto: 'Tu cotización para: {producto} 📋', contenido_html: '<p>Hola {nombre},</p><p>Gracias por tu interés en <b>{producto}</b>.</p><p>Adjuntamos los detalles y precios para tu requerimiento.</p><p>💬 Si tienes preguntas, escríbenos a nuestro WhatsApp o responde este correo.</p><p><br></p><p>Saludos,<br>El equipo de ventas</p>' },
    { tipo: 'cotizacion', idioma: 'EN', asunto: 'Your quote for: {producto} 📋', contenido_html: '<p>Hi {nombre},</p><p>Thank you for your interest in <b>{producto}</b>.</p><p>Please find attached the details and pricing for your request.</p><p>💬 If you have questions, message us on WhatsApp or reply to this email.</p><p><br></p><p>Best regards,<br>The Sales Team</p>' },
    { tipo: 'confirmacion', idioma: 'ES', asunto: '✅ Venta Confirmada: {producto}', contenido_html: '<p>Hola {nombre},</p><p>¡Tu compra de <b>{producto}</b> está confirmada!</p><p>Adjunto encontrarás tu recibo y las indicaciones importantes.</p><p><br></p><p>Saludos cordiales,<br>El equipo de ventas</p>' },
    { tipo: 'confirmacion', idioma: 'EN', asunto: '✅ Order Confirmed: {producto}', contenido_html: '<p>Hi {nombre},</p><p>Your purchase of <b>{producto}</b> is confirmed!</p><p>Please find attached your receipt and important instructions.</p><p><br></p><p>Best regards,<br>The Sales Team</p>' },
    { tipo: 'recordatorio', idioma: 'ES', asunto: '⏰ Recordatorio: Tu servicio de {producto} inicia pronto', contenido_html: '<p>Hola {nombre},</p><p>Queríamos recordarte que tu servicio de <b>{producto}</b> está por comenzar.</p><p>Por favor revisa que todo esté listo.</p><p>¡Te esperamos!</p>' },
    { tipo: 'recordatorio', idioma: 'EN', asunto: '⏰ Reminder: Your {producto} service starts soon', contenido_html: '<p>Hi {nombre},</p><p>We wanted to remind you that your <b>{producto}</b> service is coming up.</p><p>Please make sure everything is ready.</p><p>See you soon!</p>' },
    { tipo: 'resena', idioma: 'ES', asunto: '✨ ¿Cómo fue tu experiencia con {producto}?', contenido_html: '<p>¡Hola {nombre}!</p><p>Esperamos que hayas disfrutado al máximo de <b>{producto}</b>. Para nosotros fue un honor atenderte.</p><p>Tu opinión nos ayuda a seguir mejorando. ¿Tendrías un minuto para compartir tu experiencia?</p><p>¡Gracias por ser parte de la familia {agencia}!</p>' },
    { tipo: 'resena', idioma: 'EN', asunto: '✨ How was your experience with {producto}?', contenido_html: '<p>Hi {nombre}!</p><p>We hope you fully enjoyed <b>{producto}</b>. It was an honor to serve you.</p><p>Your feedback helps us continue improving. Could you take a minute to share your experience?</p><p>Thank you for being part of the {agencia} family!</p>' },
]

const WA_TEMPLATES_SEED = [
    { tipo: 'cotizacion', idioma: 'ES', contenido: 'Hola {nombre}, te escribo del equipo de Ventas. Acabo de ver tu interés en el producto {producto}. ¿Tienes alguna consulta adicional? 📋' },
    { tipo: 'cotizacion', idioma: 'EN', contenido: 'Hi {nombre}, this is from the Sales team. I noticed your interest in {producto}. Do you have any additional questions? 📋' },
    { tipo: 'confirmacion', idioma: 'ES', contenido: 'Hola {nombre}, ¡tu compra de {producto} está confirmada! ✅ Te acabo de enviar un correo con los detalles. Avísanos si lo recibiste.' },
    { tipo: 'confirmacion', idioma: 'EN', contenido: 'Hi {nombre}, your purchase of {producto} is confirmed! ✅ I just sent you an email with the details. Let us know if you received it.' },
    { tipo: 'recordatorio', idioma: 'ES', contenido: 'Hola {nombre}, solo un recordatorio: tu servicio de {producto} comenzará pronto. Avísanos si tienes dudas.' },
    { tipo: 'recordatorio', idioma: 'EN', contenido: 'Hi {nombre}, just a quick reminder: your {producto} service is starting soon. Let us know if you have questions.' },
    { tipo: 'resena', idioma: 'ES', contenido: '¡Hola {nombre}! 👋 Fue un gusto atenderte con {producto}. Si tienes un momentito, nos ayudarías muchísimo dejando una reseña. ✨ ¡Gracias por elegirnos!' },
    { tipo: 'resena', idioma: 'EN', contenido: 'Hi {nombre}! 👋 It was a pleasure serving you with {producto}. If you have a moment, you would help us a lot by leaving a review. ✨ Thanks for choosing us!' }
]

export async function seedAllData() {
    const results = { productos: 0, asesores: 0, leads: 0, ventas: 0, plantillas_email: 0, plantillas_wa: 0, errors: [] }

    // 0. Limpiar datos inventados previamente (Seguro por RLS)
    await supabase.from('plantillas_whatsapp').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('plantillas_email').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('ventas').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('productos').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('asesores').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // 1. Insert Productos
    const { data: productosData, error: productosErr } = await supabase
        .from('productos')
        .upsert(PRODUCTOS_SEED, { onConflict: 'nombre', ignoreDuplicates: true })
        .select()
    if (productosErr) {
        // If upsert fails, try plain insert
        const { data: t2, error: t2Err } = await supabase
            .from('productos')
            .insert(PRODUCTOS_SEED)
            .select()
        if (t2Err) results.errors.push('Productos: ' + t2Err.message)
        else results.productos = (t2 || []).length
    } else {
        results.productos = (productosData || []).length
    }

    // 2. Insert Asesores
    const { data: opsData, error: opsErr } = await supabase
        .from('asesores')
        .insert(ASESORES_SEED)
        .select()
    if (opsErr) results.errors.push('Asesores: ' + opsErr.message)
    else results.asesores = (opsData || []).length

    // 3. Insert Leads
    const { data: leadsData, error: leadsErr } = await supabase
        .from('leads')
        .insert(LEADS_SEED)
        .select()
    if (leadsErr) results.errors.push('Leads: ' + leadsErr.message)
    else results.leads = (leadsData || []).length

    // 4. Insert Ventas
    const { data: resData, error: resErr } = await supabase
        .from('ventas')
        .insert(VENTAS_SEED)
        .select()
    if (resErr) results.errors.push('Ventas: ' + resErr.message)
    else results.ventas = (resData || []).length

    // 5. Insert Plantillas Email
    const { data: emData, error: emErr } = await supabase
        .from('plantillas_email')
        .insert(EMAIL_TEMPLATES_SEED)
        .select()
    if (emErr) results.errors.push('Plantillas Email: ' + emErr.message)
    else results.plantillas_email = (emData || []).length

    // 6. Insert Plantillas WhatsApp
    const { data: waData, error: waErr } = await supabase
        .from('plantillas_whatsapp')
        .insert(WA_TEMPLATES_SEED)
        .select()
    if (waErr) results.errors.push('Plantillas WhatsApp: ' + waErr.message)
    else results.plantillas_wa = (waData || []).length

    return results
}
