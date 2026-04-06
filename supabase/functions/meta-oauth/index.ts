import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { short_lived_token } = await req.json()
        
        // 1. Get Global Secrets (Configured by the SaaS SuperAdmin)
        const appId = Deno.env.get('META_APP_ID')
        const appSecret = Deno.env.get('META_APP_SECRET')
        
        if (!appId || !appSecret) {
            throw new Error('Las credenciales de configuración de la App Meta (App ID y Secret) no están configuradas en este servidor.')
        }

        if (!short_lived_token) {
            throw new Error('Falta el short_lived_token en la petición.')
        }

        // 2. Exchange for Long-Lived User Token
        const exchangeUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${short_lived_token}`
        const exRes = await fetch(exchangeUrl)
        const exData = await exRes.json()
        
        if (exData.error) throw new Error('Error al intercambiar token: ' + exData.error.message)
        const longLivedUserToken = exData.access_token

        // 3. Fetch User's Pages with the Long-Lived Token
        const pagesUrl = `https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedUserToken}`
        const pagesRes = await fetch(pagesUrl)
        const pagesData = await pagesRes.json()
        
        if (pagesData.error) throw new Error('Error al listar páginas: ' + pagesData.error.message)
        
        const pages = pagesData.data || []
        
        // Return pages list to the frontend (including safe Page Access Tokens and IDs)
        // The frontend will prompt the user to select ONE page and then save that selection in DB.
        
        return new Response(JSON.stringify({ pages }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
