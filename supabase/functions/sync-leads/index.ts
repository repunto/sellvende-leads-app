// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

serve(async (req: Request) => {
    const corsHeaders = getCorsHeaders(req)
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const body = await req.json()
        const { agencia_id } = body
        if (!agencia_id) throw new Error('Agencia ID no provisto')

        // Fetch auth header to forward to user token or use service key for internal logic
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Sin autorización')
        
        const token = authHeader.replace('Bearer ', '').trim();
        const isServiceRole = token === SUPABASE_SERVICE_KEY;

        // Verify user JWT token and instantiate client with user's context
        if (!isServiceRole) {
            const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
            const authClient = createClient(SUPABASE_URL, anonKey, { global: { headers: { Authorization: authHeader } } });
            
            const { data: { user }, error: authErr } = await authClient.auth.getUser();
            if (authErr || !user) throw new Error('Token inválido o expirado.');

            // Re-check agency access under user's RLS constraints
            const { data: userAgencias, error: rlsErr } = await authClient
                .from('usuarios_agencia')
                .select('agencia_id')
                .eq('agencia_id', agencia_id)
                .limit(1);
            
            if (rlsErr || !userAgencias || userAgencias.length === 0) {
                console.warn(`[Security IDOR Block] User attempted to access sync for agency ${agencia_id}`);
                throw new Error('Prohibido: No perteneces a la agencia solicitada (IDOR Prevented).');
            }
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

        // 1. Fetch Config
        const { data: configData, error: configErr } = await supabase.from('configuracion').select('clave, valor').eq('agencia_id', agencia_id)
        if (configErr) throw configErr

        const config: Record<string, string> = {}
        configData?.forEach((r: any) => { config[r.clave] = r.valor })

        const metaToken = config['meta_page_access_token']
        const pageId = config['meta_page_id']

        if (!metaToken || !pageId) {
            return new Response(JSON.stringify({ error: 'Configuración Meta incompleta' }), { headers: corsHeaders, status: 400 })
        }

        // 2. Fetch Forms
        const formsResp = await fetch(`https://graph.facebook.com/v19.0/${pageId}/leadgen_forms?fields=id,name&access_token=${metaToken}`)
        const formsData = await formsResp.json()
        if (formsData.error) throw new Error('Error Meta Forms: ' + formsData.error.message)
        
        const forms = formsData.data || []
        if (forms.length === 0) {
            return new Response(JSON.stringify({ message: 'No hay formularios', totalImported: 0, totalSkipped: 0 }), { headers: corsHeaders, status: 200 })
        }

        // 3. Prepare for parsing
        const { data: existingPhoneRows } = await supabase.from('leads').select('telefono').eq('agencia_id', agencia_id).not('telefono', 'is', null).neq('telefono', '')
        const seenPhones = new Set((existingPhoneRows || []).map((l: any) => (l.telefono || '').replace(/[\s\-().+]/g, '')).filter(Boolean))
        const seenMetaIds = new Set()
        const seenEmails = new Set()

        let totalImported = 0
        let totalSkipped = 0

        // 4. Fetch leads
        for (const form of forms) {
            const formName = form.name || 'Formulario Meta'
            const productoFromForm = formName.split('-')[0].trim()

            let url = `https://graph.facebook.com/v19.0/${form.id}/leads?fields=id,field_data,created_time,platform&limit=100&access_token=${metaToken}`

            while (url) {
                const resp = await fetch(url)
                const page = await resp.json()
                if (page.error) break

                const leadsArray = page.data || []

                for (const lead of leadsArray) {
                    const metaId = lead.id
                    if (metaId && seenMetaIds.has(metaId)) { totalSkipped++; continue }

                    const fields = lead.field_data || []
                    let nombre = '', email = '', telefono = '', campana = productoFromForm
                    let idioma = 'ES', personas = '', temporada = '', notas = ''
                    let utm_source = '', utm_medium = '', utm_campaign = ''
                    let plataforma = 'facebook'
                    let origen = 'Facebook Ads'

                    const rawPlatform = (lead.platform || '').toLowerCase()
                    if (rawPlatform.includes('instagram') || rawPlatform === 'ig') {
                        plataforma = 'instagram'
                        origen = 'Instagram Ads'
                    }

                    for (const f of fields) {
                        const fn = (f.name || '').toLowerCase()
                                .replace(/[áäâà]/g, 'a').replace(/[éëêè]/g, 'e')
                                .replace(/[íïîì]/g, 'i').replace(/[óöôò]/g, 'o')
                                .replace(/[úüûù]/g, 'u').replace(/[¿?]/g, '')
                        const fv = f.values?.[0] || ''
                        if (!fv) continue

                        if (fn.includes('email') || fn.includes('correo')) email = fv
                        else if (fn.includes('name') || fn.includes('nombre') || fn.includes('full') || fn.includes('first')) nombre = nombre ? nombre + ' ' + fv : fv
                        else if (fn.includes('phone') || fn.includes('celular') || fn.includes('whatsapp') || fn.includes('telefono')) telefono = fv
                        else if (fn.includes('producto') || fn.includes('tour') || fn.includes('campaign') || fn.includes('campana') || fn.includes('paquete')) campana = fv
                        else if (fn.includes('language') || fn.includes('idioma')) idioma = fv.toUpperCase().includes('EN') ? 'EN' : 'ES'
                        else if (fn.includes('cuanta') || fn.includes('persona') || fn.includes('pasajero') || fn.includes('pax')) personas = fv
                        else if (fn.includes('cuando') || fn.includes('fecha') || fn.includes('viaj') || fn.includes('travel') || fn.includes('temporada') || fn.includes('mes')) temporada = fv
                        else if (fn === 'utm_source' || fn.includes('source')) utm_source = fv
                        else if (fn === 'utm_medium' || fn.includes('medium')) utm_medium = fv
                        else if (fn === 'utm_campaign' || fn.includes('campaign')) utm_campaign = fv
                        else if (!['inbox_url', 'is_organic', 'id', 'ad_id', 'adset_id', 'campaign_id', 'form_id', 'platform'].includes(fn)) { notas += f.name + ': ' + fv + ' | ' }
                    }

                    if (!nombre) nombre = 'Sin Nombre'
                    const cleanEmail = (email || '').toLowerCase().trim()
                    const cleanPhone = (telefono || '').replace(/[\s\-().+]/g, '')
                    const hasEmail = cleanEmail && cleanEmail !== 'sin_correo@fb.com'

                    if (hasEmail && seenEmails.has(cleanEmail)) { totalSkipped++; continue }
                    if (!hasEmail && cleanPhone && seenPhones.has(cleanPhone)) { totalSkipped++; continue }

                    const payload = {
                        agencia_id,
                        nombre,
                        email: hasEmail ? cleanEmail : '',
                        telefono: cleanPhone,
                        producto_interes: campana,
                        origen,
                        plataforma,
                        form_name: formName,
                        idioma,
                        personas,
                        temporada,
                        notas: notas.replace(/\s*\|\s*$/, ''),
                        estado: 'nuevo',
                        meta_lead_id: metaId || null,
                        created_at: lead.created_time || new Date().toISOString(),
                        utm_source: utm_source || null,
                        utm_medium: utm_medium || null,
                        utm_campaign: utm_campaign || null
                    }

                    let inserted = false

                    if (metaId) {
                        const { error: uErr } = await supabase.from('leads').upsert(payload, { onConflict: 'meta_lead_id', ignoreDuplicates: true })
                        if (!uErr) inserted = true
                    }

                    if (!inserted && hasEmail) {
                        const { error: uErr2 } = await supabase.from('leads').upsert(payload, { onConflict: 'email', ignoreDuplicates: true })
                        if (!uErr2) inserted = true
                    }

                    if (!inserted) {
                        if (cleanPhone && seenPhones.has(cleanPhone)) { totalSkipped++; continue }
                        const { error: insErr } = await supabase.from('leads').insert(payload)
                        if (!insErr) inserted = true
                    }

                    if (inserted) {
                        totalImported++
                        if (metaId) seenMetaIds.add(metaId)
                        if (hasEmail) seenEmails.add(cleanEmail)
                        if (cleanPhone) seenPhones.add(cleanPhone)

                        // ── AUTO-ENROLLMENT: Assign lead to matching sequence ──
                        // Mirror the same logic from meta-webhook (lines 300-351)
                        try {
                            // We need the inserted lead's UUID for leads_secuencias
                            const { data: foundLead } = metaId
                                ? await supabase.from('leads').select('id').eq('meta_lead_id', metaId).maybeSingle()
                                : hasEmail
                                    ? await supabase.from('leads').select('id').eq('email', cleanEmail).eq('agencia_id', agencia_id).maybeSingle()
                                    : { data: null }

                            if (foundLead?.id) {
                                const normalizedProduct = productoFromForm.toLowerCase().trim()

                                // Check if already enrolled in ANY sequence
                                const { data: existingEnroll } = await supabase
                                    .from('leads_secuencias')
                                    .select('id')
                                    .eq('lead_id', foundLead.id)
                                    .in('estado', ['en_progreso', 'completada'])
                                    .limit(1)

                                if (!existingEnroll || existingEnroll.length === 0) {
                                    // 1. Try smart match by producto_match keyword
                                    const { data: matchedSecs } = await supabase
                                        .from('secuencias_marketing')
                                        .select('id, nombre')
                                        .eq('agencia_id', agencia_id)
                                        .eq('activa', true)
                                        .ilike('producto_match', `%${normalizedProduct}%`)
                                        .limit(1)

                                    let targetSecId = matchedSecs?.[0]?.id

                                    if (targetSecId) {
                                        console.log(`[Sync Auto-Enroll] Smart match: "${matchedSecs[0].nombre}" for "${productoFromForm}"`)
                                    } else {
                                        // 2. Fallback: find a General sequence
                                        const { data: generalSecs } = await supabase
                                            .from('secuencias_marketing')
                                            .select('id, nombre')
                                            .eq('agencia_id', agencia_id)
                                            .eq('activa', true)
                                            .or('producto_match.is.null,producto_match.eq.,producto_match.ilike.general')
                                            .limit(1)

                                        if (generalSecs?.[0]?.id) {
                                            targetSecId = generalSecs[0].id
                                            console.log(`[Sync Auto-Enroll] Fallback General: "${generalSecs[0].nombre}"`)
                                        }
                                    }

                                    if (targetSecId) {
                                        await supabase.from('leads_secuencias').insert({
                                            agencia_id: agencia_id,
                                            lead_id: foundLead.id,
                                            secuencia_id: targetSecId,
                                            estado: 'en_progreso',
                                            ultimo_paso_ejecutado: 0
                                        })
                                        console.log(`[Sync Auto-Enroll] ✅ Lead ${foundLead.id} enrolled in sequence ${targetSecId}`)
                                    } else {
                                        console.warn(`[Sync Auto-Enroll] ⚠️ No active sequence found for lead ${foundLead.id} (product: "${productoFromForm}"). Lead will NOT receive automated emails.`)
                                    }
                                }
                            }
                        } catch (enrollErr) {
                            console.error(`[Sync Auto-Enroll] Error enrolling lead:`, enrollErr.message)
                            // Non-blocking: lead was inserted, enrollment failure shouldn't break sync
                        }
                    }
                }
                
                url = page.paging && page.paging.next ? page.paging.next : null
            }
        }

        return new Response(JSON.stringify({ message: 'Sync Completado', totalImported, totalSkipped }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        })
    }
})
