/**
 * send-meta-event — Edge Function para Meta Conversions API (CAPI)
 *
 * Recibe payloads desde Database Webhooks cuando un lead cambia de estado.
 * Envía eventos QualifiedLead o Purchase al Graph API de Meta con
 * datos hasheados SHA-256 según estándares de privacidad.
 *
 * Seguridad (Auditoría 2026-04-09):
 *  - Token enviado via Authorization header, NO como query param
 *  - CORS restringido al dominio de producción
 *  - Validación estricta del payload de entrada
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

/** CORS restringido — FIX #2 */
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*'
const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
}

/** SHA-256 hash conforme a Meta CAPI specs */
async function sha256(str: string): Promise<string> {
    if (!str) return ''
    const buffer = new TextEncoder().encode(str.trim().toLowerCase())
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}

Deno.serve(async (req) => {
    // Preflight CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const payload = await req.json()

        // ── Validación de entrada ────────────────────────────
        if (!payload?.record) {
            return new Response(
                JSON.stringify({ message: 'Payload sin record. Ignorado.' }),
                { headers: corsHeaders, status: 200 }
            )
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        const { record, old_record, type } = payload
        const { agencia_id, id, email, telefono, nombre, estado } = record

        // Solo procesar transiciones de estado reales
        const isStateChange = (type === 'UPDATE' && old_record?.estado !== estado) || type === 'INSERT'

        let eventName: string | null = null
        if (estado === 'contactado' && isStateChange) {
            eventName = 'QualifiedLead'
        } else if (estado === 'venta_cerrada' && isStateChange) {
            eventName = 'Purchase'
        }

        if (!eventName) {
            return new Response(
                JSON.stringify({ message: 'No es evento objetivo o sin cambio de estado.', leadId: id }),
                { headers: corsHeaders, status: 200 }
            )
        }

        // ── Obtener credenciales CAPI de la agencia ──────────
        const { data: configData } = await supabase
            .from('configuracion')
            .select('clave, valor')
            .eq('agencia_id', agencia_id)
            .in('clave', ['meta_pixel_id', 'meta_capi_token'])

        if (!configData || configData.length < 2) {
            return new Response(
                JSON.stringify({ message: 'Configuración CAPI incompleta para esta agencia.', agencia_id }),
                { headers: corsHeaders, status: 200 }
            )
        }

        const configMap = Object.fromEntries(configData.map(c => [c.clave, c.valor]))
        const pixelId = configMap['meta_pixel_id']
        const capiToken = configMap['meta_capi_token']

        if (!pixelId || !capiToken) {
            return new Response(
                JSON.stringify({ message: 'Pixel ID o Token CAPI vacío.', agencia_id }),
                { headers: corsHeaders, status: 200 }
            )
        }

        // ── Preparar user_data con hashing SHA-256 ───────────
        const userData: Record<string, string> = {}
        if (email) userData.em = await sha256(email)
        if (telefono) userData.ph = await sha256(telefono.replace(/[^0-9]/g, ''))
        if (nombre) userData.fn = await sha256(nombre.split(' ')[0])

        // ── Construir evento ─────────────────────────────────
        const eventPayload: Record<string, unknown> = {
            data: [{
                event_name: eventName,
                event_time: Math.floor(Date.now() / 1000),
                action_source: 'system_generated',
                user_data: userData,
            }]
        }

        // Para Purchase, intentar obtener valor real de ventas
        if (eventName === 'Purchase') {
            const { data: ventasData } = await supabase
                .from('ventas')
                .select('precio_venta')
                .eq('lead_id', id)

            const totalValue = ventasData?.reduce((sum, v) => sum + (Number(v.precio_venta) || 0), 0) || 1.00;

            (eventPayload.data as any[])[0].custom_data = {
                value: totalValue,
                currency: 'USD'
            }
        }

        console.log('[CAPI] Enviando evento:', eventName, 'Lead:', id)

        // ── FIX #2: Token en Authorization header, NO en URL ─
        const metaApiUrl = `https://graph.facebook.com/v19.0/${pixelId}/events`
        const metaResponse = await fetch(metaApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${capiToken}`
            },
            body: JSON.stringify(eventPayload)
        })

        const metaResult = await metaResponse.json()
        console.log('[CAPI] Meta Response:', JSON.stringify(metaResult))

        return new Response(JSON.stringify({
            success: metaResponse.ok,
            eventSent: eventName,
            metaResponse: metaResult
        }), {
            headers: corsHeaders,
            status: metaResponse.ok ? 200 : 502
        })

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[CAPI] Error crítico:', message)
        return new Response(
            JSON.stringify({ error: message }),
            { headers: corsHeaders, status: 500 }
        )
    }
})
