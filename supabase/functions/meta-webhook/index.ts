import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const META_APP_SECRET = Deno.env.get('META_APP_SECRET') || ''

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ==========================================
// HMAC-SHA256 helper (Web Crypto API)
// ==========================================
async function verifyMetaSignature(body: string, signatureHeader: string | null): Promise<boolean> {
    if (!META_APP_SECRET) {
        // If secret not configured, skip verification (dev mode only)
        console.warn('[Webhook] META_APP_SECRET not set — skipping signature check')
        return true
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

    return receivedHex === expectedHex
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
            // Read body as text first for HMAC verification
            const rawBody = await req.text()

            // --- SECURITY: Verify HMAC-SHA256 signature from Meta ---
            const signature = req.headers.get('x-hub-signature-256')
            const isValid = await verifyMetaSignature(rawBody, signature)
            if (!isValid) {
                console.error('[Webhook] HMAC signature verification FAILED — rejecting request')
                return new Response('Forbidden', { status: 403 })
            }

            const body = JSON.parse(rawBody)

            if (body.object === 'page') {
                const entries = body.entry || []
                
                let totalEnrolled = false

                for (const entry of entries) {
                    const pageId = entry.id
                    const changes = entry.changes || []

                    const leadPromises = []
                    for (const change of changes) {
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
    // 1. Find agency by page_id
    const { data: configPageId } = await supabase
        .from('configuracion')
        .select('agencia_id')
        .eq('clave', 'meta_page_id')
        .eq('valor', pageId)
        .single()

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

    const fieldData = leadData.field_data || []
    fieldData.forEach((field: any) => {
        const fn = (field.name || '').toLowerCase()
        const val = field.values?.[0] || ''
        if (!val) return
        if (fn.includes('name') || fn.includes('nombre') || fn.includes('first')) nombre = val
        if (fn.includes('email') || fn.includes('correo')) email = val.toLowerCase().trim()
        if (fn.includes('phone') || fn.includes('telefono') || fn.includes('celular') || fn.includes('whatsapp')) telefono = val
    })

    // Normalization
    if (nombre) {
        nombre = nombre.trim().split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    }
    if (telefono) {
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
        ad_name: leadData.ad_name || null
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

        // 7. Auto-assign to smart tour sequence or default active sequence
        try {
            console.log(`[Automation] Searching sequence for product match: "${productoNombre}"`)
            
            // 7.1 Try to match specifically by producto_match keyword
            const { data: matchedSecs } = await supabase
                .from('secuencias_marketing')
                .select('id, nombre')
                .eq('agencia_id', agenciaId)
                .eq('activa', true)
                .ilike('producto_match', `%${productoNombre}%`)
                .limit(1)

            let targetSecId = matchedSecs?.[0]?.id

            if (targetSecId) {
                console.log(`[Automation] Smart match found: "${matchedSecs[0].nombre}" for product "${productoNombre}"`)
            } else {
                console.log(`[Automation] No smart match for product "${productoNombre}". Trying to find a General sequence fallback...`)
                
                // 7.2 FALLBACK: Find a general sequence (producto_match is null or empty)
                const { data: generalSecs } = await supabase
                    .from('secuencias_marketing')
                    .select('id, nombre')
                    .eq('agencia_id', agenciaId)
                    .eq('activa', true)
                    .or('producto_match.is.null,producto_match.eq.,producto_match.ilike.general')
                    .limit(1)
                
                if (generalSecs && generalSecs.length > 0) {
                    targetSecId = generalSecs[0].id
                    console.log(`[Automation] Fallback General sequence found: "${generalSecs[0].nombre}"`)
                } else {
                    console.log(`[Automation] No general fallback sequence found. Lead will be processed manually without automation.`)
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
                return true // Indicate successful sequence enrollment
            } else {
                console.warn(`[Automation] No active sequences found for agency ${agenciaId}. Automation skipped.`)
            }
        } catch (autoErr) {
            console.error('[Automation] Error during lead-to-sequence linking:', autoErr)
        }
    } else {
        console.log(`[Webhook] Lead ${leadgenId} was a duplicate — upsert skipped`)
    }
}
