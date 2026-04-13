import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
        'Access-Control-Allow-Methods': 'OPTIONS, POST',
    }
}

serve(async (req) => {
    const corsHeaders = getCorsHeaders(req)
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { page_access_token } = await req.json()

        if (!page_access_token || page_access_token.trim().length < 10) {
            return new Response(JSON.stringify({ 
                valid: false, 
                error: 'Token inválido o vacío. Debe ser un Page Access Token generado desde Meta Business Suite.' 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
            })
        }

        const token = page_access_token.trim()

        // Step 1: Debug the token to check type and validity
        const debugRes = await fetch(
            `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`
        )
        const debugData = await debugRes.json()
        console.log('[validate-meta-token] Token debug:', JSON.stringify(debugData).slice(0, 500))

        if (debugData.error) {
            return new Response(JSON.stringify({
                valid: false,
                error: `Token rechazado por Meta: ${debugData.error.message}`
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
            })
        }

        const tokenInfo = debugData.data || {}
        const isValid = tokenInfo.is_valid !== false
        const tokenType = tokenInfo.type // e.g. 'PAGE', 'USER', 'APP'
        const expiresAt = tokenInfo.expires_at // 0 means never
        const scopes = tokenInfo.scopes || []

        if (!isValid) {
            return new Response(JSON.stringify({
                valid: false,
                error: 'El token ha expirado o fue revocado. Genera uno nuevo desde Meta Business Suite.'
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
            })
        }

        // Step 2: Fetch page info using the token
        const pageRes = await fetch(
            `https://graph.facebook.com/v19.0/me?fields=id,name,category,fan_count,picture.type(large)&access_token=${encodeURIComponent(token)}`
        )
        const pageData = await pageRes.json()
        console.log('[validate-meta-token] Page info:', JSON.stringify(pageData).slice(0, 500))

        if (pageData.error) {
            // If /me fails with a PAGE token, try getting page info differently
            return new Response(JSON.stringify({
                valid: false,
                error: `No se pudo obtener información de la página: ${pageData.error.message}. Asegúrate de pegar un Page Access Token (no un User Token).`
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
            })
        }

        // Step 3: Check required permissions
        const requiredScopes = ['leads_retrieval', 'pages_show_list']
        const missingScopes = requiredScopes.filter(s => !scopes.includes(s))
        const hasLeadAccess = scopes.includes('leads_retrieval')

        // Step 4: Auto-subscribe to leadgen webhook
        let webhookSubscribed = false
        try {
            const subRes = await fetch(
                `https://graph.facebook.com/v19.0/${pageData.id}/subscribed_apps?subscribed_fields=leadgen&access_token=${encodeURIComponent(token)}`,
                { method: 'POST' }
            )
            const subData = await subRes.json()
            console.log('[validate-meta-token] Webhook subscription:', JSON.stringify(subData))
            webhookSubscribed = subData.success === true
        } catch (e) {
            console.warn('[validate-meta-token] Webhook subscription failed:', e)
        }

        // Step 5: Try a test leadgen forms query to confirm full access
        let leadFormsCount = 0
        try {
            const formsRes = await fetch(
                `https://graph.facebook.com/v19.0/${pageData.id}/leadgen_forms?fields=id,name,status&limit=5&access_token=${encodeURIComponent(token)}`
            )
            const formsData = await formsRes.json()
            leadFormsCount = formsData.data?.length ?? 0
            console.log('[validate-meta-token] Lead forms found:', leadFormsCount)
        } catch (e) {
            console.warn('[validate-meta-token] Lead forms query failed:', e)
        }

        // Build the response
        const expiresLabel = expiresAt === 0 
            ? 'Permanente (no expira)' 
            : new Date(expiresAt * 1000).toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' })

        return new Response(JSON.stringify({
            valid: true,
            page: {
                id: pageData.id,
                name: pageData.name || 'Página sin nombre',
                category: pageData.category || '',
                fan_count: pageData.fan_count || 0,
                picture_url: pageData.picture?.data?.url || null,
            },
            token_info: {
                type: tokenType || 'PAGE',
                expires: expiresLabel,
                is_permanent: expiresAt === 0,
                scopes: scopes,
            },
            integration: {
                has_lead_access: hasLeadAccess,
                missing_scopes: missingScopes,
                webhook_subscribed: webhookSubscribed,
                lead_forms_count: leadFormsCount,
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
        })

    } catch (error) {
        console.error('[validate-meta-token] Unexpected error:', error)
        return new Response(JSON.stringify({ valid: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
        })
    }
})
