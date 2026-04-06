import { supabase } from './supabase'

/**
 * Datos iniciales basados en el Google Sheet del usuario.
 * Se insertan automáticamente al presionar "Cargar Datos Iniciales"
 * desde la página de Configuración.
 */

const TOURS_SEED = [
    { nombre: 'Salkantay Trek Meta Form', duracion_dias: 5, precio_usd: 450.00, costo_operador: 250.00, descripcion: 'Trek clásico de Salkantay a Machupicchu.', activo: true },
    { nombre: 'Inka Jungle Trek', duracion_dias: 4, precio_usd: 380.00, costo_operador: 200.00, descripcion: 'Aventura y selva Inka Jungle.', activo: true },
    { nombre: 'Inca Trail 4D/3N', duracion_dias: 4, precio_usd: 650.00, costo_operador: 400.00, descripcion: 'Camino Inca clásico.', activo: true },
    { nombre: 'Valle Sagrado de los Incas V.I.P.', duracion_dias: 1, precio_usd: 80.00, costo_operador: 45.00, descripcion: 'Tour Valle Sagrado 1 día Full.', activo: true },
]

const OPERADORES_SEED = [
    { nombre: 'Machu Picchu Reservations', telefono: '+51987654321', email: 'reservas@machupicchu.com', activo: true },
    { nombre: 'Inka Time Tours', telefono: '+51999888777', email: 'operaciones@inkatime.com', activo: true },
]

const LEADS_SEED = [
    { nombre: 'John Smith', email: 'john.smith@gmail.com', telefono: '+14155551234', tour_nombre: 'Salkantay Trek Meta Form', origen: 'Meta Ads', idioma: 'EN', personas: 'entre_2_a_4', temporada: 'buena_temporada', estado: 'nuevo', notas: 'Interested in May dates' },
    { nombre: 'María García', email: 'maria.garcia@hotmail.com', telefono: '+5491155778899', tour_nombre: 'Inka Jungle Trek', origen: 'Meta Ads', idioma: 'ES', personas: 'grupo_5_mas', temporada: 'buena_temporada', estado: 'contactado', notas: 'Grupo de 6 amigos, quieren junio' },
    { nombre: 'David Johnson', email: 'djohnson@yahoo.com', telefono: '+447911123456', tour_nombre: 'Inca Trail 4D/3N', origen: 'Web', idioma: 'EN', personas: 'entre_2_a_4', temporada: 'buena_temporada', estado: 'cotizado', notas: 'Wants permit for July, couple trip' },
    { nombre: 'Ana López', email: 'ana.lopez@gmail.com', telefono: '+5215512345678', tour_nombre: 'Valle Sagrado de los Incas V.I.P.', origen: 'Referido', idioma: 'ES', personas: 'solo_yo', temporada: 'temporada_lluvia', estado: 'nuevo', notas: 'Viaja sola, primera vez en Perú' },
]

const RESERVAS_SEED = [
    { cliente_nombre: 'Pierre Dubois', cliente_email: 'pierre.d@outlook.fr', cliente_telefono: '+33612345678', tour_nombre: 'Salkantay Trek Meta Form', fecha_tour: '2026-04-15', pax: 2, idioma: 'EN', precio_venta: 900.00, costo_operador: 500.00, adelanto: 450.00, pago_operador: 250.00, estado: 'confirmada' },
    { cliente_nombre: 'María García', cliente_email: 'maria.garcia@hotmail.com', cliente_telefono: '+5491155778899', tour_nombre: 'Inka Jungle Trek', fecha_tour: '2026-04-20', pax: 6, idioma: 'ES', precio_venta: 2280.00, costo_operador: 1200.00, adelanto: 1000.00, pago_operador: 600.00, estado: 'confirmada' },
    { cliente_nombre: 'David Johnson', cliente_email: 'djohnson@yahoo.com', cliente_telefono: '+447911123456', tour_nombre: 'Inca Trail 4D/3N', fecha_tour: '2026-05-10', pax: 2, idioma: 'EN', precio_venta: 1300.00, costo_operador: 800.00, adelanto: 650.00, pago_operador: 0, estado: 'pendiente' },
    { cliente_nombre: 'Takeshi Yamamoto', cliente_email: 'takeshi.y@gmail.com', cliente_telefono: '+81901234567', tour_nombre: 'Inca Trail 4D/3N', fecha_tour: '2026-05-20', pax: 2, idioma: 'EN', precio_venta: 1300.00, costo_operador: 800.00, adelanto: 0, pago_operador: 0, estado: 'pendiente' },
]

const EMAIL_TEMPLATES_SEED = [
    { tipo: 'cotizacion', idioma: 'ES', asunto: 'Tu cotización para la aventura: {tour} ⛰️', contenido_html: '<p>Hola {nombre},</p><p>Gracias por tu interés en <b>{tour}</b>.</p><p>Adjuntamos el programa y los precios para {pax} pasajero(s).</p><p>💬 Si tienes preguntas, escríbenos a nuestro WhatsApp o responde este correo.</p><p><br></p><p>Saludos,<br>El equipo de reservas</p>' },
    { tipo: 'cotizacion', idioma: 'EN', asunto: 'Your quote for the adventure: {tour} ⛰️', contenido_html: '<p>Hi {nombre},</p><p>Thank you for your interest in <b>{tour}</b>.</p><p>Please find attached the itinerary and pricing for {pax} passenger(s).</p><p>💬 If you have questions, message us on WhatsApp or reply to this email.</p><p><br></p><p>Best regards,<br>The Reservations Team</p>' },
    { tipo: 'confirmacion', idioma: 'ES', asunto: '✅ Reserva Confirmada: {tour}', contenido_html: '<p>Hola {nombre},</p><p>¡Tu reserva para <b>{tour}</b> está confirmada!</p><p>Nos emociona acompañarte en esta aventura.</p><p>Adjunto encontrarás tu recibo y las indicaciones importantes.</p><p><br></p><p>Saludos cordiales,<br>El equipo de reservas</p>' },
    { tipo: 'confirmacion', idioma: 'EN', asunto: '✅ Booking Confirmed: {tour}', contenido_html: '<p>Hi {nombre},</p><p>Your booking for <b>{tour}</b> is confirmed!</p><p>We are thrilled to accompany you on this adventure.</p><p>Please find attached your receipt and important instructions.</p><p><br></p><p>Best regards,<br>The Reservations Team</p>' },
    { tipo: 'recordatorio', idioma: 'ES', asunto: '⏰ Recordatorio: Tu viaje a {tour} inicia pronto', contenido_html: '<p>Hola {nombre},</p><p>Queríamos recordarte que tu viaje a <b>{tour}</b> está cerca.</p><p>Por favor revisa que todo esté listo para tu aventura.</p><p>¡Te esperamos!</p>' },
    { tipo: 'recordatorio', idioma: 'EN', asunto: '⏰ Reminder: Your trip to {tour} starts soon', contenido_html: '<p>Hi {nombre},</p><p>We wanted to remind you that your trip to <b>{tour}</b> is coming up.</p><p>Please make sure everything is ready for your adventure.</p><p>We wait for you!</p>' },
    { tipo: 'resena', idioma: 'ES', asunto: '✨ ¿Cómo fue tu experiencia en {tour}?', contenido_html: '<p>¡Hola {nombre}!</p><p>Esperamos que hayas disfrutado al máximo de tu aventura en <b>{tour}</b>. Para nosotros fue un honor acompañarte.</p><p>Tu opinión es el motor que nos ayuda a seguir creando experiencias mágicas. ¿Tendrías un minuto para compartir tu reseña con otros viajeros?</p><p align="center"><a href="https://www.tripadvisor.com" style="background:#00af87; color:white; padding:12px 20px; text-decoration:none; border-radius:5px; font-weight:bold;">Dejar mi Opinión en TripAdvisor</a></p><p>¡Gracias por ser parte de la familia {agencia}!</p>' },
    { tipo: 'resena', idioma: 'EN', asunto: '✨ How was your experience at {tour}?', contenido_html: '<p>Hi {nombre}!</p><p>We hope you fully enjoyed your adventure at <b>{tour}</b>. It was an honor for us to accompany you.</p><p>Your opinion is the engine that helps us continue creating magical experiences. Could you take a minute to share your review with other travelers?</p><p align="center"><a href="https://www.tripadvisor.com" style="background:#00af87; color:white; padding:12px 20px; text-decoration:none; border-radius:5px; font-weight:bold;">Leave a Review on TripAdvisor</a></p><p>Thank you for being part of the {agencia} family!</p>' },
]

const WA_TEMPLATES_SEED = [
    { tipo: 'cotizacion', idioma: 'ES', contenido: 'Hola {nombre}, te escribo del equipo de Reservas. Acabo de ver tu interés en el tour {tour} para la opción de {personas}. ¿Tienes alguna fecha exacta en mente? ⛰️🎒' },
    { tipo: 'cotizacion', idioma: 'EN', contenido: 'Hi {nombre}, this is from the Reservations team. I noticed your interest in the {tour} for {personas}. Do you have exact dates in mind? ⛰️🎒' },
    { tipo: 'confirmacion', idioma: 'ES', contenido: 'Hola {nombre}, ¡tu reserva para el tour {tour} está confirmada! ✅ Te acabo de enviar un correo con los detalles. Avísanos si lo recibiste.' },
    { tipo: 'confirmacion', idioma: 'EN', contenido: 'Hi {nombre}, your booking for the {tour} tour is confirmed! ✅ I just sent you an email with the details. Let us know if you received it.' },
    { tipo: 'recordatorio', idioma: 'ES', contenido: 'Hola {nombre}, solo un recordatorio para tu tour: {tour} que comenzará pronto. Avísanos si tienes dudas.' },
    { tipo: 'recordatorio', idioma: 'EN', contenido: 'Hi {nombre}, just a quick reminder for your tour: {tour} starting soon. Let us know if you have questions.' },
    { tipo: 'resena', idioma: 'ES', contenido: '¡Hola {nombre}! 👋 Espero que hayas llegado bien a casa. Fue un gusto tenerte en el tour {tour}. Si tienes un momentito, nos ayudarías muchísimo dejando una reseña aquí: https://tripadvisor.com ✨ ¡Gracias por elegirnos!' },
    { tipo: 'resena', idioma: 'EN', contenido: 'Hi {nombre}! 👋 Hope you got home safely. It was a pleasure having you on the {tour} tour. If you have a moment, you would help us a lot by leaving a review here: https://tripadvisor.com ✨ Thanks for choosing us!' }
]

export async function seedAllData() {
    const results = { tours: 0, operadores: 0, leads: 0, reservas: 0, plantillas_email: 0, plantillas_wa: 0, errors: [] }

    // 0. Limpiar datos inventados previamente (Seguro por RLS)
    await supabase.from('plantillas_whatsapp').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('plantillas_email').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('reservas').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('tours').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('operadores').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // 1. Insert Tours
    const { data: toursData, error: toursErr } = await supabase
        .from('tours')
        .upsert(TOURS_SEED, { onConflict: 'nombre', ignoreDuplicates: true })
        .select()
    if (toursErr) {
        // If upsert fails, try plain insert
        const { data: t2, error: t2Err } = await supabase
            .from('tours')
            .insert(TOURS_SEED)
            .select()
        if (t2Err) results.errors.push('Tours: ' + t2Err.message)
        else results.tours = (t2 || []).length
    } else {
        results.tours = (toursData || []).length
    }

    // 2. Insert Operadores
    const { data: opsData, error: opsErr } = await supabase
        .from('operadores')
        .insert(OPERADORES_SEED)
        .select()
    if (opsErr) results.errors.push('Operadores: ' + opsErr.message)
    else results.operadores = (opsData || []).length

    // 3. Insert Leads
    const { data: leadsData, error: leadsErr } = await supabase
        .from('leads')
        .insert(LEADS_SEED)
        .select()
    if (leadsErr) results.errors.push('Leads: ' + leadsErr.message)
    else results.leads = (leadsData || []).length

    // 4. Insert Reservas
    const { data: resData, error: resErr } = await supabase
        .from('reservas')
        .insert(RESERVAS_SEED)
        .select()
    if (resErr) results.errors.push('Reservas: ' + resErr.message)
    else results.reservas = (resData || []).length

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
