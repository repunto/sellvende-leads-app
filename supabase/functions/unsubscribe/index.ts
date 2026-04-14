import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ─── HMAC Token Verification ───
// Token = first 32 chars of base64(HMAC-SHA256(leadId, SERVICE_ROLE_KEY))
// This makes the UUID+token pair unguessable without the server secret.
async function generateToken(leadId: string): Promise<string> {
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada');

    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(leadId))
    const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    return b64.replace(/[+/=]/g, '').substring(0, 32)
}

function htmlPage(title: string, message: string, emoji: string, color: string) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #f0f2f5;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 20px;
    }
    .card {
      background: white; border-radius: 20px; padding: 48px 40px;
      max-width: 480px; width: 100%; text-align: center;
      box-shadow: 0 8px 40px rgba(0,0,0,0.08);
    }
    .emoji { font-size: 3.5rem; margin-bottom: 20px; }
    h1 { font-size: 1.5rem; font-weight: 800; color: #202124; margin-bottom: 12px; }
    p { font-size: 0.95rem; color: #5f6368; line-height: 1.6; }
    .badge {
      display: inline-block; margin-top: 24px;
      background: ${color}15; color: ${color};
      border: 1px solid ${color}40; border-radius: 20px;
      padding: 6px 18px; font-size: 0.82rem; font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">${emoji}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="badge">${title}</div>
  </div>
</body>
</html>`
}

serve(async (req: Request) => {
    // Only GET requests
    if (req.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 })
    }

    const url = new URL(req.url)
    const leadId = url.searchParams.get('id')
    const token = url.searchParams.get('token')

    // ─── Validate params ───
    if (!leadId || !token) {
        return new Response(
            htmlPage('Enlace Inválido', 'Este enlace de cancelación no es válido. Puede que haya expirado o haya sido modificado.', '❌', '#ef4444'),
            { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
    }

    // ─── Validate UUID format ───
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(leadId)) {
        return new Response(
            htmlPage('Enlace Inválido', 'El identificador del enlace no es válido.', '❌', '#ef4444'),
            { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
    }

    // ─── Verify HMAC token ───
    const expectedToken = await generateToken(leadId)
    if (token !== expectedToken) {
        console.warn(`[Unsubscribe] Invalid token for lead ${leadId}. Expected: ${expectedToken}, Got: ${token}`)
        return new Response(
            htmlPage('Enlace Inválido', 'El token de cancelación no coincide. Utiliza el enlace exacto del correo que recibiste.', '🔐', '#f59e0b'),
            { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
    }

    // ─── Fetch lead ───
    const { data: lead, error: fetchErr } = await supabase
        .from('leads')
        .select('id, nombre, email, unsubscribed')
        .eq('id', leadId)
        .maybeSingle()

    if (fetchErr || !lead) {
        console.error(`[Unsubscribe] Lead not found: ${leadId}`, fetchErr?.message)
        return new Response(
            htmlPage('No Encontrado', 'No encontramos un contacto asociado a este enlace.', '🔍', '#6b7280'),
            { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
    }

    // ─── Already unsubscribed ───
    if (lead.unsubscribed) {
        return new Response(
            htmlPage(
                'Ya estás dado de baja',
                `${lead.nombre || 'Este contacto'} ya había cancelado la suscripción anteriormente. No recibirás más correos automáticos.`,
                '✅',
                '#10b981'
            ),
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
    }

    // ─── Mark as unsubscribed ───
    const { error: updateErr } = await supabase
        .from('leads')
        .update({
            unsubscribed: true,
            unsubscribed_at: new Date().toISOString()
        })
        .eq('id', leadId)

    if (updateErr) {
        console.error(`[Unsubscribe] Failed to update lead ${leadId}:`, updateErr.message)
        return new Response(
            htmlPage('Error', 'Hubo un problema procesando tu solicitud. Por favor inténtalo más tarde.', '⚠️', '#ef4444'),
            { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
    }

    console.log(`[Unsubscribe] Lead ${lead.email} (${leadId}) successfully unsubscribed.`)

    return new Response(
        htmlPage(
            'Cancelación Exitosa',
            `Hola ${lead.nombre || ''}. Has cancelado exitosamente la suscripción a nuestros correos automáticos. No recibirás más mensajes de este tipo.<br/><br/>Si fue un error, puedes contactarnos directamente y te reactivamos.`,
            '✌️',
            '#10b981'
        ),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
})
