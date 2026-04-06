import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import nodemailer from "npm:nodemailer";

// CORS: Allow requests from browser clients
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

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const resendKey = Deno.env.get('RESEND_API_KEY') || ''

// We create a master service client for DB operations inside the function
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ============================================================
// SECURITY VERIFICATION (JWT)
// ============================================================
async function verifyAuth(req: Request): Promise<boolean> {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return false;
    
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return false;

    // Allow internal service-role calls (e.g. from meta-webhook)
    if (token === supabaseServiceKey) {
        console.log('[Drips Auth] Authorized via service-role key (internal call).');
        return true;
    }

    // Verify user JWT token
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const authClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error } = await authClient.auth.getUser(token);
    
    if (error) {
        console.warn('[Drips Auth] getUser error:', error.message);
        return false;
    }
    
    return !!user;
}

// ============================================================
// CONCURRENCY LOCK — Soft in-memory lock using a flag in DB
// Falls back gracefully if the RPC does not exist.
// ============================================================
const DRIP_LOCK_KEY = 111222333

async function acquireAdvisoryLock(): Promise<boolean> {
    try {
        const { data, error } = await supabase.rpc('try_advisory_lock', { lock_key: DRIP_LOCK_KEY })
        if (error) {
            // RPC might not exist — log but do NOT crash the function
            console.warn('[Drips] Advisory lock RPC failed (non-fatal):', error.message)
            return true // proceed without lock
        }
        return data === true
    } catch (e) {
        console.warn('[Drips] Advisory lock exception (non-fatal):', e)
        return true // proceed without lock
    }
}

async function releaseAdvisoryLock(): Promise<void> {
    try {
        await supabase.rpc('release_advisory_lock', { lock_key: DRIP_LOCK_KEY })
    } catch (_) {
        // Ignore — non-fatal
    }
}

function formatTemporada(t: string | null | undefined): string {
    if (!t) return 'sus próximas vacaciones';
    const str = t.toLowerCase();
    // Identificar temporada de lluvias / final de año
    if (str.includes('lluvia') || str.includes('baja') || str.includes('octubre') || str.includes('marzo')) {
        return 'octubre - marzo';
    }
    // Por defecto asume buena temporada / temporada seca
    return 'abril - setiembre';
}

// ─── HMAC Token for Unsubscribe Links ───
// Same algorithm as in the unsubscribe Edge Function
async function generateUnsubToken(leadId: string): Promise<string> {
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'fallback-secret';
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(leadId));
    const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return b64.replace(/[+/=]/g, '').substring(0, 32);
}

// ─── Extract clean email from "Name <email>" format ───
function extractEmail(raw: string): string {
    if (!raw) return '';
    const match = raw.match(/<([^>]+)>/);
    return match ? match[1].trim() : raw.trim();
}

// ─── HTML Flattener — Fixes malformed nested <p> from TipTap editor ───
function flattenHtml(raw: string): string {
    if (!raw) return '';
    let s = raw;

    // 1. Flatten nested <p> tags: <p><p>content</p></p> → <p>content</p>
    let prev = '';
    while (s !== prev) {
        prev = s;
        s = s.replace(/<p([^>]*)>\s*<p/gi, '<p');
        s = s.replace(/<\/p>\s*<\/p>/gi, '</p>');
    }

    // 2. Collapse excessive consecutive <br> tags into one
    s = s.replace(/(<br\s*\/?\s*>[\s\n]*){2,}/gi, '<br>');

    return s.trim();
}

// ─── HTML Sanitizer — Simplified for Raw HTML mode ───
function sanitizeHtmlForEmail(raw: string): string {
    if (!raw) return '';

    // STEP 0: Flatten nested/malformed HTML from TipTap editor
    let s = flattenHtml(raw);

    // STEP 0.5: Force empty paragraphs to have a <br> so email clients do not collapse them
    s = s.replace(/<p([^>]*)>\s*<\/p>/gi, '<p$1><br></p>');

    // STEP 1: Merge lone-emoji paragraphs with the next paragraph.
    // We use a while loop to handle consecutive emoji blocks, and
    let prev = '';
    while (s !== prev) {
        prev = s;
        // Match 2 consecutive paragraphs
        s = s.replace(/<p([^>]*)>([\s\S]*?)<\/p>[\s\n]*(?:<br\s*\/?>)?[\s\n]*<p([^>]*)>([\s\S]*?)<\/p>/gi, (match, a1, c1, a2, c2) => {
            const strip1 = c1.replace(/<[^>]+>/g, '').replace(/&[a-zA-Z0-9#]+;/g, '').trim();
            const isEmoji1 = (strip1.length > 0 && strip1.length <= 10 && !/[a-zA-Z0-9]/.test(strip1));

            const strip2 = c2.replace(/<[^>]+>/g, '').replace(/&[a-zA-Z0-9#]+;/g, '').trim();
            const isEmoji2 = (strip2.length > 0 && strip2.length <= 10 && !/[a-zA-Z0-9]/.test(strip2));

            // Merge backwards: Para 2 is emoji -> append to Para 1
            if (isEmoji2 && !isEmoji1) {
                return `<p${a1}>${c1} ${c2}</p>`;
            }
            // Merge forwards: Para 1 is emoji -> prepend to Para 2
            if (isEmoji1 && !isEmoji2) {
                return `<p${a2}>${c1} ${c2}</p>`;
            }
            // Both emojis -> merge forward
            if (isEmoji1 && isEmoji2) {
                return `<p${a2}>${c1} ${c2}</p>`;
            }
            return match;
        });
    }

    // STEP 2: Remove <br> immediately after a short non-ASCII token (emoji) in the same block
    s = s.replace(/(<[^>]*>)?(?:&nbsp;|\s)*([^\s<a-zA-Z0-9&;#>="']{1,8})(?:&nbsp;|\s)*<br\s*\/?>[\s\n]*/gi, (match, tag, chars) => {
        return (tag || '') + chars + ' ';
    });

    // STEP 3: Apply uniform standard margins for naked paragraphs
    s = s.replace(/<p>/gi, '<p style="margin: 0 0 14px 0;">');
    s = s.replace(/style="margin: 0 0 14px 0;" style="margin: 0 0 14px 0;"/gi, 'style="margin: 0 0 14px 0;"');

    // STEP 4: Normalize bold tags
    s = s.replace(/<b>/gi, '<strong>').replace(/<\/b>/gi, '</strong>');

    return s;
}

// ─── Full HTML Email Wrapper ───
function wrapEmailTemplate(opts: {
    body: string,
    agencyName?: string,
    agencyUrl?: string,
    agencyEmail?: string,
    agencyPhone?: string,
    logoUrl?: string,
    previewText?: string,
    primaryColor?: string,
    unsubscribeUrl?: string
}): string {
    const {
        body,
        agencyName = 'Agencia',
        agencyUrl = '',
        agencyEmail = '',
        agencyPhone = '',
        logoUrl = '',
        previewText = '',
        primaryColor = '#1a73e8',
        unsubscribeUrl = ''
    } = opts;

    const safeBody = sanitizeHtmlForEmail(body || '');
    const year = new Date().getFullYear();
    const displayPreview = previewText || `${agencyName} — Información importante para tu viaje`;
    const preheaderHack = '&zwnj;&nbsp;'.repeat(100);

    let safeLogoUrl = '';
    if (logoUrl && typeof logoUrl === 'string' && logoUrl.trim().length > 4) {
        const t = logoUrl.trim();
        if (t.startsWith('http') || t.match(/\.(jpeg|jpg|gif|png|webp|svg)/i)) {
            safeLogoUrl = t.startsWith('http') ? t : `https://${t.replace(/^\/+/, '')}`;
        }
    }

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es" xml:lang="es">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="google" content="notranslate" />
    <title>${agencyName}</title>
    <style type="text/css">
        body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
        table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
        img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none;display:block}
        body{margin:0;padding:0;width:100%!important;height:100%!important;background-color:#f0f2f5}
        p{margin-top:0;margin-bottom:4px}
        ul,ol{margin-top:4px;margin-bottom:8px;padding-left:18px}
        li{margin-bottom:3px}
        @media only screen and (max-width:600px){.container{width:100%!important;padding:10px!important}.content-padding{padding:24px 20px!important}}
    </style>
</head>
<body translate="no" style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;font-size:1px;color:#f0f2f5;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${displayPreview}${preheaderHack}</div>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
            <td align="center" style="padding:40px 10px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="width:100%;max-width:600px;">
                    <tr>
                        <td style="background-color:#ffffff;border:1px solid #e1e4e8;border-radius:16px;overflow:hidden;">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="center" style="background-color:#000000;border-radius:16px 16px 0 0;padding:28px 20px;">
                                        ${safeLogoUrl
                                            ? `<img src="${safeLogoUrl}" alt="${agencyName}" width="220" style="max-width:220px;height:auto;display:block;border:0;margin:0 auto;" />`
                                            : `<h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.03em;font-family:'Segoe UI',Roboto,sans-serif;">${agencyName}</h1>`
                                        }
                                    </td>
                                </tr>
                                <tr>
                                    <td class="content-padding" style="padding:40px 40px 30px 40px;">
                                        <div style="font-size:16px;line-height:1.6;color:#3c4043;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${safeBody}</div>
                                    </td>
                                </tr>
                                <tr><td style="padding:0 40px;"><hr style="border:0;border-top:1px dashed #e2e8f0;margin:0;" /></td></tr>
                                <tr>
                                    <td class="content-padding" style="padding:24px 40px 32px 40px;">
                                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td style="font-size:13px;color:#70757a;line-height:1.5;">
                                                    <strong style="color:#202124;">${agencyName}</strong><br />
                                                    ${agencyUrl ? `<a href="${agencyUrl}" style="color:${primaryColor};text-decoration:none;font-weight:600;">${agencyUrl.replace(/^https?:\/\//, '')}</a>` : ''}
                                                    ${agencyPhone ? `<br />WhatsApp: ${agencyPhone}` : ''}
                                                </td>
                                                <td align="right" style="vertical-align:bottom;"><span style="font-size:11px;color:#dadce0;">&copy; ${year}</span></td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr><td align="center" style="padding:24px 40px;color:#9aa0a6;font-size:11px;line-height:1.6;">
                        Este es un mensaje automático enviado por <strong style="color:#70757a;">${agencyName}</strong>.<br />
                        ${agencyEmail ? `Contacto: <a href="mailto:${agencyEmail}" style="color:#9aa0a6;">${agencyEmail}</a>` : ''}
                        ${unsubscribeUrl ? `<br /><br /><a href="${unsubscribeUrl}" style="color:#9aa0a6;font-size:11px;text-decoration:underline;">Cancelar suscripción a correos automáticos</a>` : ''}
                    </td></tr>
                </table>
            </td>
        </tr>
    </table>
</body></html>`;
}


// ============================================================
// MAIN HANDLER
// ============================================================
serve(async (req: Request) => {
    const corsHeaders = getCorsHeaders(req)

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Verify JWT
    const isAuthenticated = await verifyAuth(req);
    if (!isAuthenticated) {
        console.warn('[Drips] Unauthorized execution attempt blocked.');
        return new Response(JSON.stringify({ error: 'Unauthorized. Require valid Bearer token.' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Acquire lock — non-fatal if RPC doesn't exist
    const lockAcquired = await acquireAdvisoryLock()
    if (!lockAcquired) {
        console.warn('[Drips] Another instance is already running — skipping.')
        return new Response(JSON.stringify({ skipped: true, reason: 'concurrent_lock' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })
    }

    let enviados = 0;
    const failedEmails: string[] = [];

    try {
        console.log("[Drips] Lock acquired. Starting drip engine...");

        const { data: activeLeadsSecs, error: lsErr } = await supabase
            .from('leads_secuencias')
            .select(`
                *,
                lead:leads!inner(id, nombre, email, telefono, tour_nombre, form_name, temporada, agencia_id, estado, ultimo_contacto, idioma, unsubscribed, email_rebotado),
                secuencia:secuencias_marketing!inner(
                    id, activa, nombre, agencia_id,
                    pasos:pasos_secuencia(dia_envio, plantilla_email_id)
                )
            `)
            .eq('estado', 'en_progreso')
            .order('updated_at', { ascending: true, nullsFirst: true })
            .limit(30);

        if (lsErr) throw lsErr;

        console.log(`[Drips] Processing ${activeLeadsSecs?.length || 0} active sequences in this batch.`);

        const counter = { enviados: 0 };
        for (let i = 0; i < (activeLeadsSecs || []).length; i++) {
            const ls = activeLeadsSecs![i];
            try {
                // ROUND-ROBIN QUEUE ROTATION: Touch the updated_at timestamp immediately so it goes to the back of the queue
                await supabase.from('leads_secuencias').update({ updated_at: new Date().toISOString() }).eq('id', ls.id);
                
                await processLead(ls, counter, failedEmails, resendKey);
            } catch (leadErr: any) {
                console.error(`[Drips] Unhandled error for lead ${ls.lead?.id}:`, leadErr.message);
                failedEmails.push(`Error procesando lead ${ls.lead?.email || ls.lead?.id}: ${leadErr.message}`);
            }

            // Humanized delay to prevent Gmail rate limits and SMTP connection resets
            if (i < activeLeadsSecs!.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        }

        return new Response(JSON.stringify({ success: true, enviados: counter.enviados, errors: failedEmails }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (err: any) {
        console.error("[Drips] Fatal error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    } finally {
        await releaseAdvisoryLock()
        console.log('[Drips] Lock released.')
    }
})


// ============================================================
// PROCESS INDIVIDUAL LEAD — extracted for clarity & error isolation
// ============================================================
async function processLead(ls: any, counter: { enviados: number }, failedEmails: string[], globalResendKey: string) {
    if (!ls.secuencia?.activa) return;

    const agenciaId = ls.secuencia.agencia_id;
    const leadEmail = ls.lead?.email;
    const leadId = ls.lead?.id;

    // ─── UNSUBSCRIBE CHECK — Skip silently, never send to opted-out leads ───
    if (ls.lead?.unsubscribed === true) {
        console.log(`[Drips] Lead ${leadEmail} is unsubscribed — skipping permanently.`);
        // Mark sequence as completed so it stops appearing in future cycles
        await supabase.from('leads_secuencias').update({ estado: 'cancelada' }).eq('id', ls.id);
        return;
    }

    // ─── BOUNCE CHECK — Never send to leads with invalid/bounced emails ───
    // This guard protects against: manual bounces (Gmail), pre-webhook bounces, and
    // any lead that was already marked before the handle-bounce webhook existed.
    if (ls.lead?.email_rebotado === true) {
        console.log(`[Drips] Lead ${leadEmail} has a bounced/invalid email — cancelling sequence permanently.`);
        await supabase.from('leads_secuencias').update({ estado: 'cancelada' }).eq('id', ls.id);
        return;
    }

    if (!leadEmail) {
        console.log(`[Drips] Lead ${leadId} has no email — skipping.`);
        return;
    }

    // Load agency config
    const { data: configData } = await supabase
        .from('configuracion')
        .select('clave, valor')
        .eq('agencia_id', agenciaId);

    const config: Record<string, string> = {};
    configData?.forEach((r: any) => { config[r.clave] = r.valor });

    // Check master switch
    if (config['master_sequence_switch'] !== 'true') {
        console.log(`[Drips] Agency ${agenciaId} master switch is OFF — skipping.`);
        return;
    }

    // Resolve email engine
    const finalResendKey = config['resend_api_key'] || globalResendKey;
    const gmailAppPassword = config['gmail_app_password'] || '';
    const provider = config['proveedor_email']
        || (gmailAppPassword ? 'gmail' : finalResendKey ? 'resend' : '');

    if (!provider) {
        console.log(`[Drips] Agency ${agenciaId} has no email provider configured.`);
        failedEmails.push(`Agencia ${agenciaId}: No hay proveedor de email configurado (Gmail o Resend).`);
        return;
    }

    if (provider === 'gmail' && !gmailAppPassword) {
        failedEmails.push(`Lead ${leadEmail}: Motor Gmail sin Contraseña de Aplicación.`);
        return;
    }
    if (provider === 'resend' && !finalResendKey) {
        failedEmails.push(`Lead ${leadEmail}: Motor Resend sin API Key.`);
        return;
    }

    // Resolve from address — CRITICAL: smtpUser must be raw email only
    const fromEmailRaw = config['email_remitente'] || 'noreply@agencia.com';
    const fromEmailClean = extractEmail(fromEmailRaw); // strips "Name <email>" to just "email"
    const agenciaNombre = config['nombre_visible'] || config['nombre_remitente'] || 'Tu Agencia';
    const remitenteNombre = config['nombre_remitente'] || agenciaNombre;
    const agencyUrl = config['url_web'] || '';
    const agencyPhone = config['telefono_agencia'] || config['whatsapp'] || '';
    const logoUrl = config['logo_url'] || '';
    const emailPreheader = config['email_preheader'] || '';
    const primaryColor = config['color_marca'] || '#1a73e8';

    // Gmail SMTP user: prefer explicit `gmail_user`, fallback to clean email
    const smtpUser = config['gmail_user'] || fromEmailClean;

    // Resolve which step to send
    const pasos = (ls.secuencia.pasos || []).sort((a: any, b: any) => a.dia_envio - b.dia_envio);
    if (pasos.length === 0) return;

    const assignDate = new Date(ls.created_at).getTime();
    const daysElapsed = Math.floor((Date.now() - assignDate) / (1000 * 60 * 60 * 24));
    const lastExecuted = ls.ultimo_paso_ejecutado || 0;

    // Find the next eligible step
    let pasoAEnviar: any = null;
    for (const p of pasos) {
        if (p.dia_envio <= daysElapsed + 1 && p.dia_envio > lastExecuted) {
            pasoAEnviar = p;
            break;
        }
    }

    // No step eligible yet
    if (!pasoAEnviar) {
        // If all steps done, mark complete
        if (lastExecuted >= pasos[pasos.length - 1].dia_envio) {
            await supabase.from('leads_secuencias').update({ estado: 'completada' }).eq('id', ls.id);
        }
        return;
    }

    // SINGLE anti-spam check: 8h cooldown between consecutive steps
    // This prevents double-sends if the cron runs twice within the same day,
    // but does NOT block legitimate next-day steps.
    if (lastExecuted > 0 && ls.lead?.ultimo_contacto) {
        const hoursSince = (Date.now() - new Date(ls.lead.ultimo_contacto).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 8) {
            console.log(`[Drips] Skipping step ${pasoAEnviar.dia_envio} for ${leadEmail} — last contact ${Math.round(hoursSince)}h ago (< 8h cooldown).`);
            return;
        }
    }

    // Handle step without template (skip step cleanly)
    if (!pasoAEnviar.plantilla_email_id) {
        const isLast = pasoAEnviar.dia_envio === pasos[pasos.length - 1].dia_envio;
        await supabase.from('leads_secuencias').update({
            ultimo_paso_ejecutado: pasoAEnviar.dia_envio,
            estado: isLast ? 'completada' : 'en_progreso'
        }).eq('id', ls.id);
        return;
    }

    // Load email template
    const { data: tpl, error: tplErr } = await supabase
        .from('plantillas_email')
        .select('*')
        .eq('id', pasoAEnviar.plantilla_email_id)
        .single();

    if (tplErr || !tpl) {
        console.error(`[Drips] Template ${pasoAEnviar.plantilla_email_id} not found:`, tplErr?.message);
        failedEmails.push(`Lead ${leadEmail}: Plantilla ${pasoAEnviar.plantilla_email_id} no encontrada.`);
        return;
    }

    // Render variables into body & subject
    const leadNombre = ls.lead.nombre || 'Viajero';
    const leadTour = ls.lead.tour_nombre || 'tu tour';

    const socialProof = tpl.idioma === 'EN'
        ? '<div style="background:#f4f4f5;padding:12px;border-left:4px solid #facc15;font-style:italic">"An unforgettable experience, totally recommended!" - TripAdvisor</div>'
        : '<div style="background:#f4f4f5;padding:12px;border-left:4px solid #facc15;font-style:italic">"Una experiencia inolvidable, 100% recomendado" - TripAdvisor</div>';

    const mesesArray = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const mesAgotado = mesesArray[(new Date().getMonth() + 2) % 12];

    const replaceVars = (s: string) => s
        .replace(/{nombre}/gi, leadNombre)
        .replace(/{tour}/gi, leadTour)
        .replace(/{agencia}/gi, agenciaNombre)
        .replace(/{remitente}/gi, remitenteNombre)
        .replace(/{email}/gi, fromEmailClean)
        .replace(/{telefono}/gi, agencyPhone)
        .replace(/{fechaviaje}/gi, formatTemporada(ls.lead.temporada))
        .replace(/{fecha}/gi, formatTemporada(ls.lead.temporada))
        .replace(/{mesagotado}/gi, mesAgotado)
        .replace(/{social_proof}/gi, socialProof);

    const bodyContent = replaceVars(tpl.contenido_html || '');
    const emailSubject = replaceVars(tpl.asunto || `Mensaje de ${agenciaNombre}`);

    // Generate secure unsubscribe URL for this lead
    const unsubToken = await generateUnsubToken(leadId);
    const projectUrl = Deno.env.get('SUPABASE_URL') || '';
    const unsubscribeUrl = projectUrl
        ? `${projectUrl}/functions/v1/unsubscribe?id=${leadId}&token=${unsubToken}`
        : '';

    const wrappedHtml = wrapEmailTemplate({
        body: bodyContent,
        agencyName: agenciaNombre,
        agencyUrl,
        agencyEmail: fromEmailClean,
        agencyPhone,
        logoUrl,
        previewText: emailPreheader,
        primaryColor,
        unsubscribeUrl
    });

    console.log(`[Drips] Sending step ${pasoAEnviar.dia_envio} to ${leadEmail} via ${provider}`);

    // ─── SEND ───
    let engineSuccess = false;
    let errorMessage = '';

    try {
        if (provider === 'gmail') {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: smtpUser, pass: gmailAppPassword },
            });
            const info = await transporter.sendMail({
                from: `${remitenteNombre} <${fromEmailClean}>`,
                to: [leadEmail],
                subject: emailSubject,
                html: wrappedHtml,
            });
            engineSuccess = !!info.messageId;
            if (engineSuccess) console.log(`[Drips] Gmail sent: ${info.messageId}`);

        } else if (provider === 'resend') {
            const resendRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${finalResendKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: `${remitenteNombre} <${fromEmailClean}>`,
                    to: [leadEmail],
                    subject: emailSubject,
                    html: wrappedHtml
                })
            });
            if (resendRes.ok) {
                engineSuccess = true;
            } else {
                errorMessage = await resendRes.text();
            }
        }
    } catch (e: any) {
        errorMessage = e.message;
    }

    // ─── POST-SEND STATE UPDATE ───
    const isLast = pasoAEnviar.dia_envio === pasos[pasos.length - 1].dia_envio;

    if (engineSuccess) {
        counter.enviados++;

        await supabase.from('email_log').insert({
            agencia_id: agenciaId,
            lead_id: leadId,
            tipo: 'secuencia',
            email_enviado: leadEmail,
            asunto: emailSubject,
            cuerpo: wrappedHtml,
            estado: 'enviado'
        });

        const leadUpdate: Record<string, any> = { ultimo_contacto: new Date().toISOString() };
        if (ls.lead.estado === 'nuevo') leadUpdate.estado = 'contactado';
        await supabase.from('leads').update(leadUpdate).eq('id', leadId);

        await supabase.from('leads_secuencias').update({
            ultimo_paso_ejecutado: pasoAEnviar.dia_envio,
            estado: isLast ? 'completada' : 'en_progreso'
        }).eq('id', ls.id);

    } else {
        failedEmails.push(`Error al enviar a ${leadEmail} (paso ${pasoAEnviar.dia_envio}): ${errorMessage}`);
        console.error(`[Drips] Send failed for ${leadEmail}:`, errorMessage);
    }
}
