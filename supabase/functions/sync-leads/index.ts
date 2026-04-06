// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

        // 1. Fetch Config
        const { data: configData, error: configErr } = await supabase.from('configuracion').select('clave, valor').eq('agencia_id', agencia_id)
        if (configErr) throw configErr

        const config: Record<string, string> = {}
        configData?.forEach((r: any) => { config[r.clave] = r.valor })

        const token = config['meta_page_access_token']
        const pageId = config['meta_page_id']

        if (!token || !pageId) {
            return new Response(JSON.stringify({ error: 'Configuración Meta incompleta' }), { headers: corsHeaders, status: 400 })
        }

        // 2. Fetch Forms
        const formsResp = await fetch(`https://graph.facebook.com/v19.0/${pageId}/leadgen_forms?fields=id,name&access_token=${token}`)
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
            const tourFromForm = formName.split('-')[0].trim()

            let url = `https://graph.facebook.com/v19.0/${form.id}/leads?fields=id,field_data,created_time,platform&limit=100&access_token=${token}`

            while (url) {
                const resp = await fetch(url)
                const page = await resp.json()
                if (page.error) break

                const leadsArray = page.data || []

                for (const lead of leadsArray) {
                    const metaId = lead.id
                    if (metaId && seenMetaIds.has(metaId)) { totalSkipped++; continue }

                    const fields = lead.field_data || []
                    let nombre = '', email = '', telefono = '', campana = tourFromForm
                    let idioma = 'ES', personas = '', temporada = '', notas = ''
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
                        else if (fn.includes('tour') || fn.includes('campaign') || fn.includes('campana') || fn.includes('paquete')) campana = fv
                        else if (fn.includes('language') || fn.includes('idioma')) idioma = fv.toUpperCase().includes('EN') ? 'EN' : 'ES'
                        else if (fn.includes('cuanta') || fn.includes('persona') || fn.includes('pasajero') || fn.includes('pax')) personas = fv
                        else if (fn.includes('cuando') || fn.includes('fecha') || fn.includes('viaj') || fn.includes('travel') || fn.includes('temporada') || fn.includes('mes')) temporada = fv
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
                        tour_nombre: campana,
                        origen,
                        plataforma,
                        form_name: formName,
                        idioma,
                        personas,
                        temporada,
                        notas: notas.replace(/\s*\|\s*$/, ''),
                        estado: 'nuevo',
                        meta_lead_id: metaId || null,
                        created_at: lead.created_time || new Date().toISOString()
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
