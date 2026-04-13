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
        const { short_lived_token } = await req.json()
        
        const appId = Deno.env.get('META_APP_ID')
        const appSecret = Deno.env.get('META_APP_SECRET')
        
        console.log('[meta-oauth] Secrets:', { appId: appId ? 'OK' : 'MISSING', appSecret: appSecret ? 'OK' : 'MISSING' })
        
        if (!appId || !appSecret) {
            return new Response(JSON.stringify({ error: 'Las credenciales Meta (App ID y Secret) no están configuradas en el servidor.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
            })
        }

        if (!short_lived_token) {
            return new Response(JSON.stringify({ error: 'Falta el short_lived_token.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
            })
        }

        // 1. Exchange short-lived → long-lived user token
        const exchangeUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${short_lived_token}`
        const exRes = await fetch(exchangeUrl)
        const exData = await exRes.json()
        
        console.log('[meta-oauth] Exchange response:', JSON.stringify(exData))
        
        if (exData.error) {
            return new Response(JSON.stringify({ error: 'Error al intercambiar token: ' + exData.error.message }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
            })
        }
        
        const longLivedUserToken = exData.access_token

        // 2. Check what permissions this token actually has
        const permsRes = await fetch(`https://graph.facebook.com/v19.0/me/permissions?access_token=${longLivedUserToken}`)
        const permsData = await permsRes.json()
        console.log('[meta-oauth] Token permissions:', JSON.stringify(permsData))

        // 3. Check who this token belongs to
        const meRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${longLivedUserToken}`)
        const meData = await meRes.json()
        console.log('[meta-oauth] Token owner:', JSON.stringify(meData))

        // 4. Fetch user's pages
        const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedUserToken}`)
        const pagesData = await pagesRes.json()
        console.log('[meta-oauth] Pages raw response:', JSON.stringify(pagesData))
        
        if (pagesData.error) {
            return new Response(JSON.stringify({ 
                error: 'Error al listar páginas: ' + pagesData.error.message,
                debug: { permissions: permsData, owner: meData }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
            })
        }
        
        const pages = pagesData.data || []
        
        // If empty, return debug info to help diagnose
        if (pages.length === 0) {
            const grantedPerms = (permsData.data || []).filter((p: {status: string}) => p.status === 'granted').map((p: {permission: string}) => p.permission)
            return new Response(JSON.stringify({ 
                pages: [],
                debug: {
                    owner: meData,
                    granted_permissions: grantedPerms,
                    has_pages_show_list: grantedPerms.includes('pages_show_list'),
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
            })
        }
        
        return new Response(JSON.stringify({ pages }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        console.error('[meta-oauth] Unexpected error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
