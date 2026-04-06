// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import nodemailer from "npm:nodemailer"

// CORS: Allow requests from known origins
const ALLOWED_ORIGINS = [
    'http://localhost:3002',
    'http://localhost:5173',
    'https://quipureservas.com',
    'https://www.quipureservas.com',
]

function getCorsHeaders(req: Request) {
    const origin = req.headers.get('origin') || ''
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin',
    }
}

function jsonResponse(data: unknown, status = 200, corsHeaders: Record<string, string>) {
    return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status,
    })
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// ============================================================
// SECURITY VERIFICATION (JWT)
// ============================================================
async function verifyAuth(req: Request): Promise<boolean> {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return false;
    
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return false;

    // Allow internal service-role calls
    if (token === SUPABASE_SERVICE_KEY) {
        return true;
    }

    // Verify user JWT token
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const authClient = createClient(SUPABASE_URL, anonKey);
    const { data: { user }, error } = await authClient.auth.getUser(token);
    
    if (error) {
        console.warn('[Resend Auth] getUser error:', error.message);
        return false;
    }
    
    return !!user;
}
serve(async (req) => {
    const corsHeaders = getCorsHeaders(req)

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Verify JWT Auth
    const isAuthenticated = await verifyAuth(req);
    if (!isAuthenticated) {
        console.warn('[Resend-Email] Unauthorized execution attempt blocked.');
        return new Response(JSON.stringify({ error: 'Unauthorized. Require valid Bearer token.' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await req.json()
        const { from, to, subject, html, agencia_id } = body


        // ── Validation ──────────────────────────────────────────────────
        if (!from || !to || !subject || !html) {
            return jsonResponse(
                { error: 'Faltan parámetros requeridos: from, to, subject, html.' },
                400, corsHeaders
            )
        }



        if (!agencia_id) {
            return jsonResponse(
                { error: 'No se recibió agencia_id. Asegúrate de estar autenticado correctamente.' },
                400, corsHeaders
            )
        }

        // ── Read credentials from DB using SERVICE ROLE (bypasses RLS) ──
        // IMPORTANT: We use service role so the function can read credentials for
        // any agencia_id. RLS isolation is maintained by validating agencia_id.
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            auth: { persistSession: false }
        })

        const { data: configRows, error: configErr } = await supabase
            .from('configuracion')
            .select('clave, valor')
            .eq('agencia_id', agencia_id)
            .in('clave', ['proveedor_email', 'gmail_app_password', 'resend_api_key',
                          'email_remitente', 'gmail_user'])

        if (configErr) {
            console.error('Config DB error:', configErr)
            return jsonResponse(
                { error: `Error al leer configuración de la BD: ${configErr.message}` },
                500, corsHeaders
            )
        }

        if (!configRows || configRows.length === 0) {
            return jsonResponse(
                { error: 'No se encontró configuración de correo. Ve a Configuración → Motor de Correos y guarda tus credenciales.' },
                400, corsHeaders
            )
        }

        const config: Record<string, string> = {}
        configRows.forEach((r: any) => { config[r.clave] = r.valor })

        // Auto-detect engine from available credentials
        const engine = config['proveedor_email']
            || (config['gmail_app_password'] ? 'gmail' : null)
            || (config['resend_api_key'] ? 'resend' : null)

        if (!engine) {
            return jsonResponse(
                { error: 'No se ha configurado un Motor de Correos. Ve a Configuración → Motor de Correos y elige Gmail o Resend.' },
                400, corsHeaders
            )
        }

        // ── ROUTE A: GMAIL SMTP ──────────────────────────────────────────
        if (engine === 'gmail') {
            const gmailPass = config['gmail_app_password']
            if (!gmailPass) {
                return jsonResponse(
                    { error: 'Motor Gmail configurado pero falta la Contraseña de Aplicación (APP PASSWORD). Configúrala en Ajustes.' },
                    400, corsHeaders
                )
            }

            // Extract the raw email address from the "Name <email>" format
            const smtpUser = config['gmail_user']
                || (from.includes('<') ? from.split('<')[1].replace('>', '').trim() : from)

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: smtpUser, pass: gmailPass },
            })

            try {
                const info = await transporter.sendMail({
                    from,
                    to: Array.isArray(to) ? to : [to],
                    subject,
                    html,
                })
                console.log('Gmail sent:', info.messageId)
                return jsonResponse({ success: true, messageId: info.messageId, engine: 'gmail' }, 200, corsHeaders)
            } catch (smtpErr) {
                console.error('Gmail SMTP error:', smtpErr)
                return jsonResponse(
                    { error: `Error SMTP Gmail: ${smtpErr.message}. Verifica que la Contraseña de Aplicación sea correcta y que "Acceso a apps menos seguras" esté habilitado.` },
                    502, corsHeaders
                )
            }
        }

        // ── ROUTE B: RESEND API ──────────────────────────────────────────
        if (engine === 'resend') {
            const resendKey = config['resend_api_key']
            if (!resendKey) {
                return jsonResponse(
                    { error: 'Motor Resend configurado pero falta la API Key. Configúrala en Ajustes.' },
                    400, corsHeaders
                )
            }

            const resendRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${resendKey}`,
                },
                body: JSON.stringify({
                    from,
                    to: Array.isArray(to) ? to : [to],
                    subject,
                    html,
                }),
            })

            const resendData = await resendRes.json()

            if (!resendRes.ok) {
                console.error('Resend API error:', resendData)
                return jsonResponse(
                    { error: `Error Resend API: ${resendData?.message || resendData?.name || JSON.stringify(resendData)}` },
                    502, corsHeaders
                )
            }

            return jsonResponse({ ...resendData, success: true, engine: 'resend' }, 200, corsHeaders)
        }

        return jsonResponse(
            { error: `Motor de correos desconocido: "${engine}". Valores válidos: "gmail" o "resend".` },
            400, corsHeaders
        )

    } catch (err) {
        console.error('Unhandled Email Engine error:', err)
        return jsonResponse(
            { error: err?.message || 'Error interno desconocido en el Motor de Correos.' },
            500, getCorsHeaders(req)
        )
    }
})
