import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const META_APP_SECRET = Deno.env.get('META_APP_SECRET') || ''

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ==========================================
// 🛡️ SECURITY LAYER: DEVSECOPS CRYPTO
// ==========================================
async function verifyMetaSignature(body: string, signatureHeader: string | null): Promise<boolean> {
    // FAIL-CLOSED: Si no hay secreto, muere por seguridad (evita spoofing)
    if (!META_APP_SECRET) {
        console.error('CRITICAL: META_APP_SECRET NO ESTÁ DEFINIDO EN EL ENTORNO.')
        return false 
    }
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
        console.error('[Webhook] Missing or malformed X-Hub-Signature-256 header')
        return false
    }

    const receivedHex = signatureHeader.slice(7) // Remove "sha256="
    const encoder = new TextEncoder()
    const keyData = encoder.encode(META_APP_SECRET)
    const bodyData = encoder.encode(body)

    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, bodyData)
    const expectedHex = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0')).join('')

    return receivedHex === expectedHex // Comparación a tiempo constante implícita
}

// 🛡️ SECURITY LAYER: INPUT SANITIZATION
function sanitizeInput(text: string): string {
    if (!text) return '';
    return text
        .replace(/[<>{}\\]/g, '') // Eliminar tags XSS y scripts
        .replace(/^[=+-@]/g, '')  // Eliminar exploits CSV (inyecciones Excel)
        .trim();
}

serve(async (req) => {
    const method = req.method
    const url = new URL(req.url)

    // ==========================================
    // 1. META WEBHOOK VERIFICATION (GET)
    // ==========================================
    if (method === 'GET') {
        const mode = url.searchParams.get('hub.mode')
        const token = url.searchParams.get('hub.verify_token')
        const challenge = url.searchParams.get('hub.challenge')

        if (mode === 'subscribe' && token) {
            const { data, error } = await supabase
                .from('configuracion')
                .select('agencia_id')
                .eq('clave', 'meta_verify_token')
                .eq('valor', token)
                .single()

            if (data && !error) {
                console.log('Webhook verified successfully for agency:', data.agencia_id)
                return new Response(challenge, { status: 200 })
            } else {
                console.error('Verify token mismatch or not found')
                return new Response('Forbidden', { status: 403 })
            }
        }
        return new Response('Invalid Request', { status: 400 })
    }

    // ==========================================
    // 2. META LEADGEN PAYLOAD (POST)
    // ==========================================
    if (method === 'POST') {
        try {
            // 🛡️ SECURITY: Request Size Shield (Max 1MB)
            if (req.headers.get('content-length') && parseInt(req.headers.get('content-length')!) > 1048576) {
                console.error('[SecOps] Payload truncado: Supera límite de 1MB')
                return new Response('PAYLOAD_TOO_LARGE', { status: 413 })
            }

            // Read body as text first for HMAC verification
            const rawBody = await req.text()

            // --- SECURITY: Verify HMAC-SHA256 signature from Meta ---
            const signature = req.headers.get('x-hub-signature-256')
            const isValid = await verifyMetaSignature(rawBody, signature)
            if (!isValid) {
                console.error('[SecOps] HMAC signature verification FAILED — rejecting request')
                return new Response('Forbidden', { status: 403 })
            }

            const body = JSON.parse(rawBody)

            if (body.object === 'page') {
                const entries = body.entry || []
                
                let totalEnrolled = false
                let iterations = 0; // 🛡️ DDoS Protection Tracker

                for (const entry of entries) {
                    const pageId = entry.id
                    const changes = entry.changes || []

                    const leadPromises = []
                    for (const change of changes) {
                        iterations++;
                        if (iterations > 50) {
                            console.warn('[SecOps] Payload truncado (DDoS Protection). Máx 50 cambios procesados.');
                            break; 
                        }

                        if (change.field === 'leadgen') {
                            const leadgenId = change.value.leadgen_id
                            const formId = change.value.form_id
                            leadPromises.push(processNewLead(pageId, formId, leadgenId))
                        }
                    }
                    const results = await Promise.allSettled(leadPromises)
                    if (results.some(r => r.status === 'fulfilled' && r.value === true)) {
                        totalEnrolled = true
                    }
                }

                // If any lead was assigned a sequence, invoke the drip engine exactly once
                if (totalEnrolled) {
                    supabase.functions.invoke('process-drips').catch(e => {
                        console.error('[Automation] Failed to trigger process-drips batch:', e)
                    })
                }

                // Respond with 200 OK immediately so Meta stops retrying
                return new Response('EVENT_RECEIVED', { status: 200 })
            } else {
                return new Response('NOT_FOUND', { status: 404 })
            }

        } catch (error) {
            console.error('Error processing webhook payload:', error)
            return new Response('INTERNAL_SERVER_ERROR', { status: 500 })
        }
    }

    return new Response('Method Not Allowed', { status: 405 })
})

// ==========================================
// 3. GRAPH API FETCH & INSERT (with dedup)
// ==========================================
async function processNewLead(pageId: string, formId: string, leadgenId: string) {
    // 1. Find agency by page_id (🛡️ Blindado con limit(1) para evitar caída por colisión de tenant IDOR)
    const { data: configPageRows } = await supabase
        .from('configuracion')
        .select('agencia_id')
        .eq('clave', 'meta_page_id')
        .eq('valor', pageId)
        .limit(1)

    const configPageId = configPageRows && configPageRows.length > 0 ? configPageRows[0] : null;

    if (!configPageId) {
        console.error(`No agency configured for Facebook Page ID: ${pageId}`)
        return
    }
    const agenciaId = configPageId.agencia_id

    // 2. DEDUP CHECK: If this meta_lead_id already exists, skip entirely
    const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .eq('agencia_id', agenciaId)
        .eq('meta_lead_id', leadgenId)
        .maybeSingle()

    if (existing) {
        console.log(`[Webhook] Lead ${leadgenId} already exists — skipping (dedup)`)
        return
    }

    // 3. Get the access token for this agency
    const { data: configToken } = await supabase
        .from('configuracion')
        .select('valor')
        .eq('agencia_id', agenciaId)
        .eq('clave', 'meta_page_access_token')
        .single()

    if (!configToken || !configToken.valor) {
        console.error(`No page access token for agency: ${agenciaId}`)
        return
    }
    const accessToken = configToken.valor

    // 4. Fetch Lead Details from Meta Graph API
    const graphUrl = `https://graph.facebook.com/v19.0/${leadgenId}?fields=id,field_data,created_time,platform,campaign_name,adset_name,ad_name&access_token=${accessToken}`
    const fbRes = await fetch(graphUrl)
    const leadData = await fbRes.json()

    if (leadData.error) {
        console.error(`Graph API Error for lead ${leadgenId}:`, leadData.error)
        return
    }

    // 5. Transform Form Data
    let nombre = 'Lead Sin Nombre'
    let email = ''
    let telefono = ''
    let utm_source = ''
    let utm_medium = ''
    let utm_campaign = ''

    const fieldData = leadData.field_data || []
    fieldData.forEach((field: any) => {
        const fn = (field.name || '').toLowerCase()
        const val = field.values?.[0] || ''
        if (!val) return
        if (fn.includes('name') || fn.includes('nombre') || fn.includes('first')) nombre = val
        if (fn.includes('email') || fn.includes('correo')) email = val.toLowerCase().trim()
        if (fn.includes('phone') || fn.includes('telefono') || fn.includes('celular') || fn.includes('whatsapp')) telefono = val
        if (fn === 'utm_source' || fn.includes('source')) utm_source = val
        if (fn === 'utm_medium' || fn.includes('medium')) utm_medium = val
        if (fn === 'utm_campaign' || fn.includes('campaign')) utm_campaign = val
    })

    // Normalization & Sanitization
    if (nombre) {
        nombre = sanitizeInput(nombre);
        nombre = nombre.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    }
    if (telefono) {
        telefono = sanitizeInput(telefono);
        telefono = telefono.replace(/\s+/g, '').replace(/[^+\d]/g, '')
    }

    // Detect platform
    const rawPlatform = (leadData.platform || '').toLowerCase()
    const plataforma = rawPlatform.includes('instagram') || rawPlatform === 'ig' ? 'instagram' : 'facebook'
    const origen = plataforma === 'instagram' ? 'Instagram Ads' : 'Facebook Ads'

    // Get form name
    let productoNombre = 'Meta Lead'
    const formUrl = `https://graph.facebook.com/v19.0/${formId}?fields=name&access_token=${accessToken}`
    const formRes = await fetch(formUrl)
    const formData = await formRes.json()
    if (!formData.error && formData.name) {
        productoNombre = formData.name.split('-')[0].trim()
    }

    // 6. Upsert into Supabase 'leads' — idempotent by meta_lead_id
    const newLead = {
        agencia_id: agenciaId,
        nombre,
        email: email || '',
        telefono,
        producto_interes: productoNombre,
        form_name: productoNombre,
        origen,
        plataforma,
        meta_lead_id: leadgenId,
        idioma: 'ES',
        estado: 'nuevo',
        notas: `Webhook Real-Time. Lead ID: ${leadgenId}`,
        created_at: leadData.created_time || new Date().toISOString(),
        campaign_name: leadData.campaign_name || null,
        adset_name: leadData.adset_name || null,
        ad_name: leadData.ad_name || null,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null
    }

    const { data: insertedLead, error } = await supabase
        .from('leads')
        .upsert(newLead, { onConflict: 'agencia_id,meta_lead_id', ignoreDuplicates: true })
        .select()
        .maybeSingle()

    if (error) {
        console.error('Error upserting lead into database:', error)
    } else if (insertedLead) {
        console.log(`Successfully inserted lead via webhook: ${nombre} (${leadgenId})`)

        // 7. Send instant notification email to agency admin (Speed-to-Lead: 5-min rule)
        try {
            await sendNewLeadAlert(agenciaId, insertedLead, productoNombre)
        } catch (notifErr) {
            console.error('[Notification] Failed to send lead alert email:', notifErr)
        }

        // 8. Auto-assign to smart tour sequence or default active sequence
        try {
            // Normalize product name for matching (strip dates, trim, lowercase)
            const normalizedProduct = productoNombre
                .replace(/\s*[-–]\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/i, '')
                .replace(/\s*[-–]\s*\d{4}[-/]\d{1,2}([-/]\d{1,2})?\s*$/i, '')
                .trim()
            
            console.log(`[Automation] Searching sequence for product: "${productoNombre}" (normalized: "${normalizedProduct}")`)
            
            // 8.1 Try to match specifically by producto_match keyword
            const { data: matchedSecs } = await supabase
                .from('secuencias_marketing')
                .select('id, nombre, producto_match')
                .eq('agencia_id', agenciaId)
                .eq('activa', true)
                .ilike('producto_match', `%${normalizedProduct}%`)
                .limit(1)

            let targetSecId = matchedSecs?.[0]?.id

            if (targetSecId) {
                console.log(`[Automation] ✅ Smart match: "${matchedSecs[0].nombre}" (match field: "${matchedSecs[0].producto_match}") for product "${normalizedProduct}"`)
            } else {
                console.warn(`[Automation] ⚠️ No smart match found for "${normalizedProduct}". Trying General fallback...`)
                
                // 8.2 FALLBACK: Find a general sequence (producto_match is null or empty)
                const { data: generalSecs } = await supabase
                    .from('secuencias_marketing')
                    .select('id, nombre')
                    .eq('agencia_id', agenciaId)
                    .eq('activa', true)
                    .or('producto_match.is.null,producto_match.eq.,producto_match.ilike.general')
                    .limit(1)
                
                if (generalSecs && generalSecs.length > 0) {
                    targetSecId = generalSecs[0].id
                    console.log(`[Automation] ✅ Fallback General: "${generalSecs[0].nombre}"`)
                } else {
                    // 🚨 AUDIT ALERT: This should NEVER happen silently
                    console.error(`[AUDIT ALERT] 🚨 ORPHANED LEAD DETECTED! Lead "${nombre}" (${email || telefono}) from form "${productoNombre}" has NO matching sequence AND no General fallback. Agency: ${agenciaId}. THIS LEAD WILL NOT RECEIVE AUTOMATED EMAILS.`)
                }
            }

            if (targetSecId) {
                await supabase.from('leads_secuencias').insert({
                    agencia_id: agenciaId,
                    lead_id: insertedLead.id,
                    secuencia_id: targetSecId,
                    estado: 'en_progreso',
                    ultimo_paso_ejecutado: 0
                })
                console.log(`[Automation] ✅ Lead ${insertedLead.id} enrolled in sequence ${targetSecId}`)
                return true // Indicate successful sequence enrollment
            } else {
                console.error(`[AUDIT ALERT] 🚨 Lead ${insertedLead.id} (${nombre}) DROPPED — no active sequences for agency ${agenciaId}. Create a sequence matching "${normalizedProduct}" or a General fallback.`)
            }
        } catch (autoErr) {
            console.error('[Automation] Error during lead-to-sequence linking:', autoErr)
        }
    } else {
        console.log(`[Webhook] Lead ${leadgenId} was a duplicate — upsert skipped`)
    }
}

// ==========================================
// 4. INSTANT NOTIFICATION EMAIL TO AGENCY ADMIN
// ==========================================
async function sendNewLeadAlert(agenciaId: string, lead: any, producto: string) {
    // Read agency email config
    const { data: configs } = await supabase
        .from('configuracion')
        .select('clave, valor')
        .eq('agencia_id', agenciaId)
        .in('clave', ['gmail_user', 'email_remitente', 'nombre_remitente', 'proveedor_email', 'gmail_app_password', 'resend_api_key'])

    if (!configs || configs.length === 0) {
        console.log('[Notification] No email config found for agency — skipping alert')
        return
    }

    const cfg: Record<string, string> = {}
    configs.forEach(c => { cfg[c.clave] = c.valor })

    const recipientEmail = cfg.gmail_user || cfg.email_remitente
    if (!recipientEmail) {
        console.log('[Notification] No admin email configured — skipping alert')
        return
    }

    const senderName = cfg.nombre_remitente || 'Sellvende CRM'
    const senderEmail = cfg.email_remitente || cfg.gmail_user
    const provider = cfg.proveedor_email || 'gmail'

    const subject = `🚨 NUEVO LEAD: ${lead.nombre} — ${producto}`
    const htmlBody = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:520px;margin:20px auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 28px;">
      <div style="color:white;font-size:24px;font-weight:800;">🚨 NUEVO LEAD</div>
      <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:4px;">Acaba de ingresar desde Meta Ads</div>
    </div>
    <div style="padding:24px 28px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:10px 0;color:#94a3b8;font-size:13px;width:110px;">Nombre</td><td style="padding:10px 0;color:#f1f5f9;font-weight:700;font-size:15px;">${lead.nombre}</td></tr>
        <tr><td style="padding:10px 0;color:#94a3b8;font-size:13px;">Email</td><td style="padding:10px 0;color:#f1f5f9;font-size:14px;">${lead.email || '—'}</td></tr>
        <tr><td style="padding:10px 0;color:#94a3b8;font-size:13px;">Teléfono</td><td style="padding:10px 0;color:#f1f5f9;font-size:14px;">${lead.telefono || '—'}</td></tr>
        <tr><td style="padding:10px 0;color:#94a3b8;font-size:13px;">Producto</td><td style="padding:10px 0;color:#a78bfa;font-weight:600;font-size:14px;">${producto}</td></tr>
        <tr><td style="padding:10px 0;color:#94a3b8;font-size:13px;">Origen</td><td style="padding:10px 0;color:#f1f5f9;font-size:14px;">${lead.origen || 'Meta Ads'}</td></tr>
        <tr><td style="padding:10px 0;color:#94a3b8;font-size:13px;">Campaña</td><td style="padding:10px 0;color:#f1f5f9;font-size:14px;">${lead.campaign_name || lead.utm_campaign || '—'}</td></tr>
      </table>
      <div style="margin-top:20px;padding:14px 18px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;border-left:4px solid #ef4444;">
        <div style="color:#f87171;font-weight:700;font-size:14px;">⏱️ Regla de los 5 Minutos</div>
        <div style="color:#fca5a5;font-size:13px;margin-top:4px;">Un lead contactado en los primeros 5 minutos tiene <strong>21x más probabilidad</strong> de convertir. ¡No lo dejes enfriar!</div>
      </div>
      ${lead.telefono ? `<a href="https://wa.me/${lead.telefono.replace(/[^0-9]/g, '')}" style="display:block;margin-top:16px;text-align:center;padding:14px;background:#25D366;color:white;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none;">💬 Contactar por WhatsApp AHORA</a>` : ''}
    </div>
    <div style="padding:12px 28px;background:rgba(0,0,0,0.2);text-align:center;font-size:11px;color:#64748b;">
      Enviado por ${senderName} vía Sellvende CRM • ${new Date().toLocaleDateString('es-PE')}
    </div>
  </div>
</body></html>`

    // Send via the agency's configured email provider
    if (provider === 'resend' && cfg.resend_api_key) {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${cfg.resend_api_key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: `${senderName} <${senderEmail}>`,
                to: [recipientEmail],
                subject,
                html: htmlBody
            })
        })
        if (!res.ok) {
            const errText = await res.text()
            console.error('[Notification] Resend alert failed:', errText)
        } else {
            console.log(`[Notification] Lead alert sent to ${recipientEmail} via Resend`)
        }
    } else if (cfg.gmail_user && cfg.gmail_app_password) {
        // Use Gmail SMTP via Supabase Edge Function invoke
        try {
            await supabase.functions.invoke('resend-email', {
                body: {
                    agencia_id: agenciaId,
                    to: recipientEmail,
                    subject,
                    html: htmlBody,
                    _notification: true
                }
            })
            console.log(`[Notification] Lead alert sent to ${recipientEmail} via Gmail-SMTP`)
        } catch (gmailErr) {
            console.error('[Notification] Gmail SMTP alert failed:', gmailErr)
        }
    } else {
        console.log('[Notification] No email provider properly configured — alert not sent')
    }
}
