// @ts-nocheck
/**
 * handle-bounce — Recibe webhooks de Resend cuando un email rebota.
 *
 * Flujo:
 *  1. Verificar firma HMAC-SHA256 del header `svix-signature` (Resend usa Svix)
 *  2. Procesar solo eventos: email.bounced, email.complained
 *  3. Buscar el lead por email en la tabla `leads`
 *  4. Marcar: email_rebotado = true, estado = 'correo_falso'
 *  5. Cancelar todas sus secuencias activas
 *  6. Registrar en email_log
 *  7. Retornar 200 siempre (para que Resend no reintente)
 *
 * Configuración requerida:
 *  - Variable de entorno en Supabase: RESEND_WEBHOOK_SECRET
 *  - Webhook en Resend Dashboard → Endpoints → Add, eventos: email.bounced, email.complained
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const WEBHOOK_SECRET       = Deno.env.get('RESEND_WEBHOOK_SECRET') || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
})

// ── HMAC-SHA256 signature verification (Svix format used by Resend) ──────────
async function verifyWebhookSignature(req: Request, rawBody: string): Promise<boolean> {
    if (!WEBHOOK_SECRET) {
        // No secret configured — warn but allow in dev mode
        console.warn('[Bounce] RESEND_WEBHOOK_SECRET not set. Skipping signature check.')
        return true
    }

    // Svix sends: svix-id, svix-timestamp, svix-signature headers
    const svixId        = req.headers.get('svix-id') || ''
    const svixTimestamp = req.headers.get('svix-timestamp') || ''
    const svixSig       = req.headers.get('svix-signature') || ''

    if (!svixId || !svixTimestamp || !svixSig) {
        console.warn('[Bounce] Missing Svix headers.')
        return false
    }

    // Reject requests older than 5 minutes
    const now = Math.floor(Date.now() / 1000)
    const ts  = parseInt(svixTimestamp, 10)
    if (Math.abs(now - ts) > 300) {
        console.warn('[Bounce] Webhook timestamp too old:', ts)
        return false
    }

    try {
        const toSign = `${svixId}.${svixTimestamp}.${rawBody}`
        const secret = WEBHOOK_SECRET.startsWith('whsec_')
            ? atob(WEBHOOK_SECRET.substring(6))
            : WEBHOOK_SECRET

        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        )
        const sig    = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign))
        const b64Sig = btoa(String.fromCharCode(...new Uint8Array(sig)))

        // Svix sends multiple signatures separated by space: "v1,<sig1> v1,<sig2>"
        const signatures = svixSig.split(' ')
        const isValid    = signatures.some(s => {
            const [, sigVal] = s.split(',')
            return sigVal === b64Sig
        })

        if (!isValid) console.warn('[Bounce] Signature mismatch.')
        return isValid
    } catch (e) {
        console.error('[Bounce] Signature verification error:', e)
        return false
    }
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
    // Always return 200 to prevent Resend from retrying indefinitely
    const ok = new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    })

    if (req.method !== 'POST') return ok

    let rawBody = ''
    try {
        rawBody = await req.text()
    } catch {
        return ok
    }

    // ── Verify signature ──
    const isValid = await verifyWebhookSignature(req, rawBody)
    if (!isValid) {
        console.warn('[Bounce] Rejected: invalid signature.')
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    let event: any
    try {
        event = JSON.parse(rawBody)
    } catch {
        console.warn('[Bounce] Could not parse JSON body.')
        return ok
    }

    const eventType = event?.type || ''
    console.log(`[Bounce] Received event: ${eventType}`)

    // ── Only process bounce and complaint events ──
    const isBounce    = eventType === 'email.bounced'
    const isComplaint = eventType === 'email.complained'
    if (!isBounce && !isComplaint) {
        console.log(`[Bounce] Ignoring event type: ${eventType}`)
        return ok
    }

    // ── Extract recipient email ──
    const data         = event?.data || {}
    const toAddresses  = data?.to || []
    const bouncedEmail = Array.isArray(toAddresses)
        ? toAddresses[0]
        : (typeof toAddresses === 'string' ? toAddresses : null)

    if (!bouncedEmail) {
        console.warn('[Bounce] No recipient email found in event.')
        return ok
    }

    const motivoRaw = isBounce
        ? (data?.bounce_type === 'hard' ? 'Hard Bounce via Resend' : 'Soft Bounce via Resend')
        : 'Spam Complaint via Resend'

    console.log(`[Bounce] Processing ${eventType} for: ${bouncedEmail}`)

    // ── Find the lead(s) ──
    // Use strict matching via tags if available to ensure correct tenant routing!
    const tags = data?.tags || [];
    const tagAgenciaId = tags.find((t: any) => t.name === 'agencia_id')?.value;
    const tagLeadId = tags.find((t: any) => t.name === 'lead_id')?.value;

    let query = supabase.from('leads').select('id, agencia_id, email, nombre');
    
    if (tagLeadId && tagAgenciaId) {
        // STRICT TENANT ISOLATION: We know exactly which lead and agency this bounce belongs to.
        query = query.eq('id', tagLeadId).eq('agencia_id', tagAgenciaId);
        console.log(`[Bounce] Using strict tenant matching via tags. Lead: ${tagLeadId}, Agencia: ${tagAgenciaId}`);
    } else {
        // Fallback (for older emails sent without tags)
        query = query.eq('email', bouncedEmail.toLowerCase().trim());
        console.log(`[Bounce] No tags found, falling back to email match: ${bouncedEmail}`);
    }

    const { data: matchedLeads, error: findErr } = await query;

    if (findErr) {
        console.error('[Bounce] DB lookup error:', findErr.message)
        return ok
    }

    if (!matchedLeads || matchedLeads.length === 0) {
        console.log(`[Bounce] No lead found for target bounce.`)
        return ok
    }

    // ── Process each matching lead (could belong to multiple agencies) ──
    for (const lead of matchedLeads) {
        const leadId    = lead.id
        const agenciaId = lead.agencia_id

        const isSoftBounce = isBounce && data?.bounce_type === 'soft'

        // 1. Mark lead as bounced
        const leadUpdate: Record<string, any> = {
            email_rebotado: true,
            fecha_rebote:   new Date().toISOString(),
            motivo_rebote:  motivoRaw,
        }
        if (!isSoftBounce) {
            leadUpdate.estado = 'correo_falso'
        }

        const { error: updateErr } = await supabase
            .from('leads')
            .update(leadUpdate)
            .eq('id', leadId)

        if (updateErr) {
            console.error(`[Bounce] Failed to update lead ${leadId}:`, updateErr.message)
            continue
        }

        // 2. Action on sequences
        if (!isSoftBounce) {
            // Cancel all active sequences for hard bounce/complaint
            const { error: seqErr } = await supabase
                .from('leads_secuencias')
                .update({ estado: 'cancelada' })
                .eq('lead_id', leadId)
                .in('estado', ['en_progreso', 'pausado'])

            if (seqErr) console.warn(`[Bounce] Could not cancel sequences for lead ${leadId}:`, seqErr.message)
        } else {
            // Pause sequences for soft bounce (e.g. inbox full)
            const { error: seqErr } = await supabase
                .from('leads_secuencias')
                .update({ estado: 'pausado' })
                .eq('lead_id', leadId)
                .in('estado', ['en_progreso'])
            
            if (seqErr) console.warn(`[Bounce] Could not pause sequences for lead ${leadId}:`, seqErr.message)
        }

        // 3. Log the bounce in email_log
        const { error: logErr } = await supabase
            .from('email_log')
            .insert({
                agencia_id:     agenciaId,
                lead_id:        leadId,
                tipo:           'bounce',
                email_enviado:  bouncedEmail,
                asunto:         `[REBOTE] ${motivoRaw}`,
                cuerpo:         JSON.stringify(data),
                estado:         'rebotado',
            })

        if (logErr) {
            console.warn(`[Bounce] Could not insert email_log for lead ${leadId}:`, logErr.message)
        }

        console.log(`[Bounce] ✅ Lead ${leadId} (${lead.nombre}) marked as bounced — sequences cancelled.`)
    }

    return ok
})
