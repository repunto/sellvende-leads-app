import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import nodemailer from "npm:nodemailer";

// CORS: Allow requests from browser clients
const ALLOWED_ORIGINS = [
    'http://localhost:3002',
    'http://localhost:5173',
    'https://leads.sellvende.com',
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

    // Allow internal service-role calls (e.g. from meta-webhook or pg_cron trigger)
    if (token === supabaseServiceKey) {
        console.log('[Drips Auth] Authorized via service-role key (internal call).');
        return true;
    }

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
// CONCURRENCY LOCK
// ============================================================
const DRIP_LOCK_KEY = 111222333

async function acquireAdvisoryLock(): Promise<boolean> {
    try {
        const { data, error } = await supabase.rpc('try_advisory_lock', { lock_key: DRIP_LOCK_KEY })
        if (error) return true 
        return data === true
    } catch (e) {
        return true 
    }
}

async function releaseAdvisoryLock(): Promise<void> {
    try {
        await supabase.rpc('release_advisory_lock', { lock_key: DRIP_LOCK_KEY })
    } catch (_) {}
}

// ============================================================
// 🛡️ XSS-SAFE HTML ESCAPE — Bulletproof 2026
// ============================================================
// All user-generated data MUST pass through this before HTML injection.
// Prevents <script>, <img src=x onerror=...>, and other XSS vectors
// that trigger phishing/malware flags from Google Postmaster.
function escapeHtml(str: string): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatTemporada(t: string | null | undefined): string {
    if (!t) return 'sus próximas vacaciones';
    const str = t.toLowerCase();
    if (str.includes('lluvia') || str.includes('baja') || str.includes('octubre') || str.includes('marzo')) {
        return 'octubre - marzo';
    }
    return 'abril - setiembre';
}

async function generateUnsubToken(leadId: string): Promise<string> {
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'fallback-secret';
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(leadId));
    const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return b64.replace(/[+/=]/g, '').substring(0, 32);
}

function extractEmail(raw: string): string {
    if (!raw) return '';
    const match = raw.match(/<([^>]+)>/);
    return match ? match[1].trim() : raw.trim();
}

function flattenHtml(raw: string): string {
    if (!raw) return '';
    let s = raw;
    // Safe, bounded loop — max 10 passes to collapse nested empty <p> tags.
    const MAX_PASSES = 10;
    for (let i = 0; i < MAX_PASSES; i++) {
        const next = s
            .replace(/<p([^>]*)>\s*<p/gi, '<p')
            .replace(/<\/p>\s*<\/p>/gi, '</p>');
        if (next === s) break;
        s = next;
    }
    // Collapse multiple consecutive <br> into a single one — safe single-pass
    s = s.replace(/(<br\s*\/?\s*>[\s\n]*){2,}/gi, '<br>');
    return s.trim();
}

function sanitizeHtmlForEmail(raw: string): string {
    if (!raw) return '';
    let s = flattenHtml(raw);

    // 1. Fill truly empty <p></p> with a line break so email clients render spacing
    s = s.replace(/<p([^>]*)>\s*<\/p>/gi, '<p$1><br></p>');

    // 2. Merge standalone emoji-only <p> into adjacent content paragraphs.
    //    Safe bounded loop (max 10) — each pass reduces emoji-orphan <p> count by at least 1.
    const MAX_PASSES = 10;
    for (let i = 0; i < MAX_PASSES; i++) {
        const emojiMergeRe = /<p([^>]*)>([\s\S]*?)<\/p>[\s\n]*(?:<br\s*\/?>)?[\s\n]*<p([^>]*)>([\s\S]*?)<\/p>/i;
        const prev = s;
        s = s.replace(emojiMergeRe, (match, a1, c1, a2, c2) => {
            const strip1 = c1.replace(/<[^>]+>/g, '').replace(/&[a-zA-Z0-9#]+;/g, '').trim();
            const isEmoji1 = strip1.length > 0 && strip1.length <= 10 && !/[a-zA-Z0-9]/.test(strip1);
            const strip2 = c2.replace(/<[^>]+>/g, '').replace(/&[a-zA-Z0-9#]+;/g, '').trim();
            const isEmoji2 = strip2.length > 0 && strip2.length <= 10 && !/[a-zA-Z0-9]/.test(strip2);
            if (isEmoji2 && !isEmoji1) return `<p${a1}>${c1} ${c2}</p>`;
            if (isEmoji1 && !isEmoji2) return `<p${a2}>${c1} ${c2}</p>`;
            if (isEmoji1 && isEmoji2) return `<p${a2}>${c1} ${c2}</p>`;
            return match;
        });
        if (s === prev) break;
    }

    // 3. Strip standalone emoji+br fragments (single-pass, no loop risk)
    s = s.replace(/(<[^>]*>)?(?:&nbsp;|\s)*([^\s<a-zA-Z0-9&;#>="']{1,8})(?:&nbsp;|\s)*<br\s*\/?>\s*/gi,
        (match, tag, chars) => (tag || '') + chars + ' ');

    // 4. Inject email-safe margin to bare <p> tags (single-pass)
    s = s.replace(/<p>/gi, '<p style="margin: 0 0 14px 0;">');

    // 5. Cleanup: remove duplicate style attrs if a <p> already had inline style
    s = s.replace(/style="margin: 0 0 14px 0;" style="margin: 0 0 14px 0;"/gi,
        'style="margin: 0 0 14px 0;"');

    // 6. Normalize <b> to <strong>
    s = s.replace(/<b>/gi, '<strong>').replace(/<\/b>/gi, '</strong>');

    return s;
}

// ============================================================
// 🎨 OUTLOOK-PROOF EMAIL TEMPLATE — Bulletproof 2026
// ============================================================
// Key changes vs. legacy:
// - Body content wrapped in <table> instead of <div> for Outlook Desktop
// - Outlook conditional comments (<!--[if mso]>) for border-radius fallback
// - All spacing via table cells, not CSS margins (Outlook ignores margin on divs)
function wrapEmailTemplate(opts: any): string {
    const { body, agencyName = 'Agencia', agencyUrl = '', agencyEmail = '', agencyPhone = '', logoUrl = '', previewText = '', primaryColor = '#1a73e8', unsubscribeUrl = '' } = opts;
    const safeBody = sanitizeHtmlForEmail(body || '');
    const year = new Date().getFullYear();
    const safeAgencyName = escapeHtml(agencyName);
    const displayPreview = escapeHtml(previewText || `${agencyName} — Información importante`);
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
    <title>${safeAgencyName}</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:AllowPNG/>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
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
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" class="container" style="width:100%;max-width:600px;">
                    <tr>
                        <td style="background-color:#ffffff;border:1px solid #e1e4e8;border-radius:16px;overflow:hidden;">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="center" style="background-color:#000000;border-radius:16px 16px 0 0;padding:28px 20px;">
                                        ${safeLogoUrl ? `<img src="${safeLogoUrl}" alt="${safeAgencyName}" width="220" style="max-width:220px;height:auto;display:block;border:0;margin:0 auto;" />` : `<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="font-size:26px;font-weight:800;letter-spacing:-0.03em;font-family:'Segoe UI',Roboto,sans-serif;color:#ffffff;">${safeAgencyName}</td></tr></table>`}
                                    </td>
                                </tr>
                                <tr>
                                    <td class="content-padding" style="padding:40px 40px 30px 40px;">
                                        <!--[if mso]><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="font-size:16px;line-height:1.6;color:#3c4043;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><![endif]-->
                                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td style="font-size:16px;line-height:1.6;color:#3c4043;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${safeBody}</td>
                                            </tr>
                                        </table>
                                        <!--[if mso]></td></tr></table><![endif]-->
                                    </td>
                                </tr>
                                <tr><td style="padding:0 40px;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="border-top:1px dashed #e2e8f0;font-size:1px;line-height:1px;">&nbsp;</td></tr></table></td></tr>
                                <tr>
                                    <td class="content-padding" style="padding:24px 40px 32px 40px;">
                                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td style="font-size:13px;color:#70757a;line-height:1.5;">
                                                    <strong style="color:#202124;">${safeAgencyName}</strong><br />
                                                    ${agencyUrl ? `<a href="${agencyUrl}" style="color:${primaryColor};text-decoration:none;font-weight:600;">${agencyUrl.replace(/^https?:\/\//, '')}</a>` : ''}
                                                    ${agencyPhone ? `<br />WhatsApp: ${escapeHtml(agencyPhone)}` : ''}
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
                        Este es un mensaje automático enviado por <strong style="color:#70757a;">${safeAgencyName}</strong>.<br />
                        ${agencyEmail ? `Contacto: <a href="mailto:${agencyEmail}" style="color:#9aa0a6;">${escapeHtml(agencyEmail)}</a>` : ''}
                        ${unsubscribeUrl ? `<br /><br /><a href="${unsubscribeUrl}" style="color:#9aa0a6;font-size:11px;text-decoration:underline;">Cancelar suscripción a correos automáticos</a>` : ''}
                    </td></tr>
                </table>
            </td>
        </tr>
    </table>
</body></html>`;
}

// Helper to pause execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================
// 🔁 POISON PILL GUARD — Bulletproof 2026
// ============================================================
// If a lead fails soft (non-bounce, non-auth) errors repeatedly,
// we must NOT retry it infinitely. After MAX_SOFT_RETRIES the
// sequence is paused to prevent the cron from burning API quota.
const MAX_SOFT_RETRIES = 5;

async function checkAndIncrementRetry(lsId: string): Promise<boolean> {
    try {
        // Read current retry count from leads_secuencias.notas (JSON metadata field)
        const { data, error } = await supabase.from('leads_secuencias').select('notas').eq('id', lsId).single();
        if (error) {
            console.warn(`[Drips] Error reading notas for retry (probably missing column): ${error.message}`);
            // Fallback: don't crash, let it retry later
            return true;
        }

        let meta: any = {};
        try { meta = JSON.parse(data?.notas || '{}'); } catch (_) { meta = {}; }
        
        const retries = (meta.soft_retries || 0) + 1;
        meta.soft_retries = retries;
        meta.last_retry = new Date().toISOString();
        
        const { error: updErr } = await supabase.from('leads_secuencias').update({ notas: JSON.stringify(meta) }).eq('id', lsId);
        if (updErr) {
            console.warn(`[Drips] Error saving notas retries: ${updErr.message}`);
        }

        if (retries >= MAX_SOFT_RETRIES) {
            console.warn(`[Drips] Poison Pill: Lead sequence ${lsId} hit ${retries} soft retries — pausing.`);
            await supabase.from('leads_secuencias').update({ estado: 'pausada' }).eq('id', lsId);
            return false; // signal: do NOT retry again
        }
        return true; // ok to retry next cycle
    } catch (err: any) {
        console.warn(`[Drips] Fatal Retry Check Error: ${err.message}`);
        return true; // Don't crash processLead completely
    }
}

// ============================================================
// MAIN HANDLER
// ============================================================
serve(async (req: Request) => {
    const corsHeaders = getCorsHeaders(req)

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const isAuthenticated = await verifyAuth(req);
    if (!isAuthenticated) {
        console.warn('[Drips] Unauthorized execution attempt blocked.');
        return new Response(JSON.stringify({ error: 'Unauthorized. Require valid Bearer token.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    const lockAcquired = await acquireAdvisoryLock()
    if (!lockAcquired) {
        console.warn('[Drips] Another instance is already running — skipping.')
        return new Response(JSON.stringify({ skipped: true, reason: 'concurrent_lock' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    try {
        console.log("[Drips] Lock acquired. Starting Bulletproof drip engine v2...");

        const { data: activeLeadsSecs, error: lsErr } = await supabase
            .from('leads_secuencias')
            .select(`
                *,
                lead:leads!inner(id, nombre, email, telefono, producto_interes, form_name, temporada, agencia_id, estado, ultimo_contacto, idioma, unsubscribed, email_rebotado),
                secuencia:secuencias_marketing!inner(
                    id, activa, nombre, agencia_id,
                    pasos:pasos_secuencia(dia_envio, plantilla_email_id, tipo_mensaje, whatsapp_template_name)
                )
            `)
            .eq('estado', 'en_progreso')
            .order('updated_at', { ascending: true, nullsFirst: true })
            .limit(100);

        if (lsErr) throw lsErr;

        console.log(`[Drips] Processing ${activeLeadsSecs?.length || 0} active sequences in this batch.`);

        // --- PREPARE AGENCY CONFIGS AND CONNECTION POOLS ---
        const agencyMap = new Map<string, any>();
        
        // Group leads by agency
        const agencyLeads = new Map<string, any[]>();
        
        for (const ls of (activeLeadsSecs || [])) {
            if (!ls.secuencia?.activa || !ls.secuencia?.agencia_id) continue;
            const agId = ls.secuencia.agencia_id;
            
            if (!agencyMap.has(agId)) {
                // Fetch config
                const { data: configData } = await supabase.from('configuracion').select('clave, valor').eq('agencia_id', agId);
                const config: Record<string, string> = {};
                configData?.forEach((r: any) => { config[r.clave] = r.valor });
                
                agencyMap.set(agId, { id: agId, config, authError: false, transporter: null });
                agencyLeads.set(agId, []);
            }
            
            agencyLeads.get(agId)!.push(ls);
        }

        // Create nodemailer pools
        for (const [agId, st] of agencyMap.entries()) {
            const finalResendKey = st.config['resend_api_key'];
            const gmailAppPassword = st.config['gmail_app_password'] || '';
            const provider = st.config['proveedor_email'] || (gmailAppPassword ? 'gmail' : finalResendKey ? 'resend' : '');
            st.provider = provider;
            
            if (provider === 'gmail' && gmailAppPassword) {
                const fromEmailRaw = st.config['email_remitente'] || 'noreply@agencia.com';
                const smtpUser = st.config['gmail_user'] || extractEmail(fromEmailRaw);
                // CREATE A SINGLE CONNECTION POOL
                st.transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: { user: smtpUser, pass: gmailAppPassword },
                    pool: true,
                    maxConnections: 1, // Be polite to Google
                    maxMessages: 50
                });
            } else if (provider === 'resend') {
                st.resendKey = finalResendKey;
            }
        }

        // ============================================================
        // 🚀 PARALLEL MULTITENANT PROCESSING — Bulletproof 2026
        // ============================================================
        // Each agency runs its own leads SEQUENTIALLY (respecting rate limits),
        // but AGENCIES run in PARALLEL (Promise.allSettled).
        // This means Resend agencies (instant) don't wait for Gmail agencies (1.2s/email).
        const counter = { enviados: 0 };
        const failedEmails: string[] = [];

        const agencyPromises = Array.from(agencyLeads.entries()).map(async ([agId, leads]) => {
            const agencyContext = agencyMap.get(agId);
            const agencyFailed: string[] = [];
            let agencyEnviados = 0;

            for (const ls of leads) {
                try {
                    // Touch queue correctly to re-order
                    await supabase.from('leads_secuencias').update({ updated_at: new Date().toISOString() }).eq('id', ls.id);
                    
                    // If agency is broken globally (e.g. invalid password), skip its leads immediately
                    if (agencyContext?.authError) {
                        console.log(`[Drips] Skipping lead ${ls.lead?.email} due to existing agency auth failure.`);
                        continue;
                    }

                    const result = await processLead(ls, agencyFailed, agencyContext);
                    if (result) agencyEnviados++;

                    // Anti-spam delay between emails ONLY for Gmail
                    if (agencyContext?.provider === 'gmail') {
                        await delay(1200); // Wait 1.2s between Gmail sends
                    }
                } catch (leadErr: any) {
                    console.error(`[Drips] Unhandled error for lead ${ls.lead?.id}:`, leadErr.message);
                    agencyFailed.push(`Error procesando lead ${ls.lead?.email || ls.lead?.id}: ${leadErr.message}`);
                    
                    // If the error is a definitive auth failure from Gmail, mark the agency as broken
                    if (leadErr.message?.includes('Invalid login') || leadErr.message?.includes('Application-specific password required')) {
                        if (agencyContext) agencyContext.authError = true;
                    }
                }
            }

            return { agId, enviados: agencyEnviados, errors: agencyFailed };
        });

        // Run all agencies in parallel
        const results = await Promise.allSettled(agencyPromises);

        // Aggregate results
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                counter.enviados += result.value.enviados;
                failedEmails.push(...result.value.errors);
            } else if (result.status === 'rejected') {
                console.error('[Drips] Agency batch failed:', result.reason);
                failedEmails.push(`Agency batch error: ${result.reason?.message || result.reason}`);
            }
        }

        // --- TEARDOWN POOLS ---
        for (const [_, st] of agencyMap.entries()) {
            if (st.transporter) {
                st.transporter.close();
            }
        }

        return new Response(JSON.stringify({ success: true, enviados: counter.enviados, errors: failedEmails }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (err: any) {
        console.error("[Drips] Fatal error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } finally {
        await releaseAdvisoryLock()
        console.log('[Drips] Lock released.')
    }
})


// ============================================================
// PROCESS INDIVIDUAL LEAD — Returns true if email was sent
// ============================================================
async function processLead(ls: any, failedEmails: string[], agencyContext: any): Promise<boolean> {
    if (!ls.secuencia?.activa || !agencyContext) return false;

    const leadEmail = ls.lead?.email;
    const leadId = ls.lead?.id;

    if (ls.lead?.unsubscribed === true || ls.lead?.email_rebotado === true) {
        await supabase.from('leads_secuencias').update({ estado: 'cancelada' }).eq('id', ls.id);
        return false;
    }

    if (!leadEmail) return false;

    const config = agencyContext.config;
    if (config['master_sequence_switch'] !== 'true') return false;

    const provider = agencyContext.provider;
    if (!provider) {
        failedEmails.push(`Agencia ${agencyContext.id}: No hay proveedor configurado.`);
        return false;
    }

    if (provider === 'gmail' && !agencyContext.transporter) {
        failedEmails.push(`Lead ${leadEmail}: Motor Gmail sin Contraseña de Aplicación.`);
        return false;
    }
    if (provider === 'resend' && !agencyContext.resendKey) {
        failedEmails.push(`Lead ${leadEmail}: Motor Resend sin API Key.`);
        return false;
    }

    const fromEmailRaw = config['email_remitente'] || 'noreply@agencia.com';
    const fromEmailClean = extractEmail(fromEmailRaw);
    const remitenteNombre = config['nombre_remitente'] || config['nombre_visible'] || 'Tu Agencia';
    const agencyPhone = config['telefono_agencia'] || config['whatsapp'] || '';

    const pasos = (ls.secuencia.pasos || []).sort((a: any, b: any) => a.dia_envio - b.dia_envio);
    if (pasos.length === 0) return false;

    const assignDate = new Date(ls.created_at).getTime();
    const daysElapsed = Math.floor((Date.now() - assignDate) / (1000 * 60 * 60 * 24));
    const lastExecuted = ls.ultimo_paso_ejecutado || 0;

    let pasoAEnviar: any = null;
    for (const p of pasos) {
        if (p.dia_envio <= daysElapsed + 1 && p.dia_envio > lastExecuted) {
            pasoAEnviar = p;
            break;
        }
    }

    if (!pasoAEnviar) {
        if (lastExecuted >= pasos[pasos.length - 1].dia_envio) {
            await supabase.from('leads_secuencias').update({ estado: 'completada' }).eq('id', ls.id);
        }
        return false;
    }

    if (lastExecuted > 0 && ls.lead?.ultimo_contacto) {
        const hoursSince = (Date.now() - new Date(ls.lead.ultimo_contacto).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 8) return false;
    }

    // ============================================================
    // WHATSAPP OMNICHANNEL BRANCH
    // ============================================================
    const tipoMensaje = pasoAEnviar.tipo_mensaje || 'email';
    if (tipoMensaje === 'whatsapp') {
        console.log(`[Drips] WhatsApp branch for lead ${leadId} step ${pasoAEnviar.dia_envio}. Architecture ready.`);
        // TODO: Replace this stub with WhatsApp Cloud API call when credentials are configured.
        const waSuccess = false; // stub — flip to true after WA credentials are set up
        const waLogId = crypto.randomUUID();
        const isLast = pasoAEnviar.dia_envio === pasos[pasos.length - 1].dia_envio;
        
        if (waSuccess) {
            await supabase.from('email_log').insert({
                id: waLogId,
                agencia_id: agencyContext.id,
                lead_id: leadId,
                tipo: 'secuencia',
                canal: 'whatsapp',
                email_enviado: ls.lead.telefono || leadEmail,
                asunto: pasoAEnviar.whatsapp_template_name || 'wa_template',
                estado: 'enviado'
            });
            await supabase.from('leads').update({ ultimo_contacto: new Date().toISOString() }).eq('id', leadId);
            
            await supabase.from('leads_secuencias').update({
                ultimo_paso_ejecutado: pasoAEnviar.dia_envio,
                estado: isLast ? 'completada' : 'en_progreso'
            }).eq('id', ls.id);
            return true;
        } else {
            console.warn(`[Drips] WhatsApp stub for ${leadId}: WA credentials not yet configured, skipping step to prevent blockage.`);
            // CRITICAL FIX: Advance the sequence anyway so mixed (Email/WA) sequences don't get permanently stuck
            await supabase.from('leads_secuencias').update({
                ultimo_paso_ejecutado: pasoAEnviar.dia_envio,
                estado: isLast ? 'completada' : 'en_progreso'
            }).eq('id', ls.id);
        }
        return false;
    }

    if (!pasoAEnviar.plantilla_email_id) {
        const isLast = pasoAEnviar.dia_envio === pasos[pasos.length - 1].dia_envio;
        await supabase.from('leads_secuencias').update({
            ultimo_paso_ejecutado: pasoAEnviar.dia_envio,
            estado: isLast ? 'completada' : 'en_progreso'
        }).eq('id', ls.id);
        return false;
    }

    const { data: tpl, error: tplErr } = await supabase
        .from('plantillas_email').select('*').eq('id', pasoAEnviar.plantilla_email_id).single();

    if (tplErr || !tpl) {
        const errorMsg = `Plantilla borrada o no encontrada (${pasoAEnviar.plantilla_email_id})`;
        failedEmails.push(`Lead ${leadEmail}: ${errorMsg}`);
        console.error(`[Drips] Template missing for ${leadEmail}`);

        await supabase.from('email_log').insert({
            id: crypto.randomUUID(),
            agencia_id: agencyContext.id,
            lead_id: leadId,
            tipo: 'secuencia',
            canal: 'email',
            estado: 'fallido',
            asunto: 'Error Estructural',
            cuerpo: errorMsg
        });
        
        // Critical: Pause sequence so they don't infinite-loop
        await supabase.from('leads_secuencias').update({ estado: 'pausada' }).eq('id', ls.id);
        return false;
    }

    // ============================================================
    // 🛡️ XSS-SAFE VARIABLE INJECTION — Bulletproof 2026
    // ============================================================
    // All user-sourced data is escaped BEFORE template replacement.
    // Template HTML (from plantillas_email) is trusted content authored by agency admins.
    const leadNombre = escapeHtml(ls.lead.nombre || 'Cliente');
    const activeTourName = escapeHtml(tpl.origen || ls.lead.producto_interes || ls.lead.form_name || 'nuestro servicio');
    const socialProof = tpl.idioma === 'EN'
        ? '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="background:#f4f4f5;padding:12px;border-left:4px solid #facc15;font-style:italic;font-size:15px;color:#3c4043;">"An unforgettable experience, totally recommended!" - Verified Customer</td></tr></table>'
        : '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="background:#f4f4f5;padding:12px;border-left:4px solid #facc15;font-style:italic;font-size:15px;color:#3c4043;">"Una experiencia inolvidable, 100% recomendado" - Cliente Verificado</td></tr></table>';

    const mesesArray = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const mesAgotado = mesesArray[(new Date().getMonth() + 2) % 12];

    const replaceVars = (s: string) => s
        .replace(/{nombre}/gi, leadNombre)
        .replace(/{producto}/gi, activeTourName)
        .replace(/{tour}/gi, activeTourName)
        .replace(/{agencia}/gi, escapeHtml(config['nombre_visible'] || 'Agencia'))
        .replace(/{remitente}/gi, escapeHtml(remitenteNombre))
        .replace(/{email}/gi, escapeHtml(fromEmailClean))
        .replace(/{telefono}/gi, escapeHtml(agencyPhone))
        .replace(/{fechaviaje}/gi, formatTemporada(ls.lead.temporada))
        .replace(/{fecha}/gi, formatTemporada(ls.lead.temporada))
        .replace(/{mesagotado}/gi, mesAgotado)
        .replace(/{social_proof}/gi, socialProof);

    const emailSubject = replaceVars(tpl.asunto || `Mensaje de ${remitenteNombre}`);
    
    // Generate specific ID for tracking this exact email send
    const logId = crypto.randomUUID();
    const trackingPixel = `<img src="${Deno.env.get('SUPABASE_URL')}/functions/v1/track-open?logId=${logId}" width="1" height="1" alt="" style="display:none; visibility:hidden;" />`;
    const bodyContent = replaceVars(tpl.contenido_html || '') + trackingPixel;
    
    const unsubToken = await generateUnsubToken(leadId);
    const unsubscribeUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/unsubscribe?id=${leadId}&token=${unsubToken}`;

    const wrappedHtml = wrapEmailTemplate({
        body: bodyContent,
        agencyName: config['nombre_visible'] || remitenteNombre,
        agencyUrl: config['url_web'] || '',
        agencyEmail: fromEmailClean,
        agencyPhone,
        logoUrl: config['logo_url'] || '',
        previewText: config['email_preheader'] || '',
        primaryColor: config['color_marca'] || '#1a73e8',
        unsubscribeUrl
    });

    console.log(`[Drips] Sending step ${pasoAEnviar.dia_envio} to ${leadEmail} via ${provider}`);

    let engineSuccess = false;
    let errorMessage = '';

    try {
        if (provider === 'gmail') {
            // ============================================================
            // 📧 GMAIL SMTP — RFC 2369 List-Unsubscribe Headers
            // ============================================================
            const info = await agencyContext.transporter.sendMail({
                from: `${remitenteNombre} <${fromEmailClean}>`,
                to: [leadEmail],
                subject: emailSubject,
                html: wrappedHtml,
                messageId: `<${logId}@leads.sellvende.com>`, // INJECTED TRACKER FOR BOUNCE RADAR
                headers: {
                    'List-Unsubscribe': `<${unsubscribeUrl}>`,
                    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                    'Precedence': 'bulk',
                    'X-Auto-Response-Suppress': 'OOF, AutoReply',
                    'X-Mailer': 'Sellvende-Drip-Engine/2.0',
                },
            });
            engineSuccess = !!info.messageId;
            if (engineSuccess) console.log(`[Drips] Gmail sent: ${info.messageId}`);
        } else if (provider === 'resend') {
            // ============================================================
            // 📧 RESEND API — RFC 2369 List-Unsubscribe Headers
            // ============================================================
            const resendRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${agencyContext.resendKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: `${remitenteNombre} <${fromEmailClean}>`,
                    to: [leadEmail],
                    subject: emailSubject,
                    html: wrappedHtml,
                    headers: {
                        'List-Unsubscribe': `<${unsubscribeUrl}>`,
                        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                        'Precedence': 'bulk',
                        'X-Auto-Response-Suppress': 'OOF, AutoReply',
                        'X-Mailer': 'Sellvende-Drip-Engine/2.0',
                    },
                    tags: [
                        { name: 'agencia_id', value: agencyContext.id },
                        { name: 'lead_id', value: leadId }
                    ]
                })
            });
            if (resendRes.ok) engineSuccess = true;
            else errorMessage = await resendRes.text();
        }
    } catch (e: any) {
        errorMessage = e.message;
        // Re-throw if it's a critical auth error so the loop aborts for this agency
        if (errorMessage.includes('Invalid login') || errorMessage.includes('Application-specific password required')) {
            throw e;
        }
    }

    const isLast = pasoAEnviar.dia_envio === pasos[pasos.length - 1].dia_envio;
    if (engineSuccess) {
        const { error: logErr } = await supabase.from('email_log').insert({
            id: logId,
            agencia_id: agencyContext.id,
            lead_id: leadId,
            tipo: 'secuencia',
            canal: 'email',
            email_enviado: leadEmail,
            asunto: emailSubject,
            estado: 'enviado'
        });
        if (logErr) console.error(`[Drips] DB Error (email_log):`, logErr.message);

        const leadUpdate: Record<string, any> = { ultimo_contacto: new Date().toISOString() };
        if (ls.lead.estado === 'nuevo') leadUpdate.estado = 'contactado';
        await supabase.from('leads').update(leadUpdate).eq('id', leadId);

        await supabase.from('leads_secuencias').update({
            ultimo_paso_ejecutado: pasoAEnviar.dia_envio,
            estado: isLast ? 'completada' : 'en_progreso'
        }).eq('id', ls.id);

        return true;

    } else {
        const errorMsg = errorMessage || 'Error desconocido al enviar';
        failedEmails.push(`Error al enviar a ${leadEmail} (paso ${pasoAEnviar.dia_envio}): ${errorMsg}`);
        console.error(`[Drips] Send failed for ${leadEmail}:`, errorMsg);

        // ── CRITICAL FIX: Log the failure to email_log so Radar can show it ──
        await supabase.from('email_log').insert({
            id: logId,
            agencia_id: agencyContext.id,
            lead_id: leadId,
            tipo: 'secuencia',
            canal: 'email',
            email_enviado: leadEmail,
            asunto: emailSubject,
            estado: 'fallido',
            cuerpo: errorMsg.substring(0, 1000),
        });

        // ── HARD BOUNCE DETECTION: 550/5.1.x = address doesn't exist ──
        // These are permanent failures — no point retrying ever.
        const isHardBounce = /550|5\.1\.[12]|NoSuchUser|user.?unknown|does not exist|can't receive mail|invalid.*address|no such/i.test(errorMsg);
        if (isHardBounce) {
            console.log(`[Drips] Hard bounce SMTP detected for ${leadEmail} — marking as correo_falso`);
            await Promise.allSettled([
                supabase.from('leads').update({
                    email_rebotado: true,
                    estado: 'correo_falso',
                    motivo_rebote: `Hard Bounce SMTP: ${errorMsg.substring(0, 250)}`,
                    fecha_rebote: new Date().toISOString(),
                }).eq('id', leadId),
                supabase.from('leads_secuencias').update({ estado: 'cancelada' }).eq('id', ls.id),
            ]);
        } else {
            // ── POISON PILL GUARD: Prevent infinite soft-error retries ──
            await checkAndIncrementRetry(ls.id);
        }

        return false;
    }
}
