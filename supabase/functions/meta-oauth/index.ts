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
        
        if (!appId || !appSecret) {
            return new Response(JSON.stringify({ error: 'Las credenciales Meta no están configuradas en el servidor.' }), {
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
        
        if (exData.error) {
            return new Response(JSON.stringify({ error: 'Error al intercambiar token: ' + exData.error.message }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
            })
        }
        
        const userToken = exData.access_token
        const allPages: Array<{id: string, name: string, access_token: string, category?: string}> = []

        // 2. Try standard me/accounts (pages with direct personal role)
        const accountsRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,category&limit=50&access_token=${userToken}`)
        const accountsData = await accountsRes.json()
        console.log('[meta-oauth] me/accounts:', JSON.stringify(accountsData))
        
        if (accountsData.data && accountsData.data.length > 0) {
            allPages.push(...accountsData.data)
        }

        // 3. Also try Business Portfolio pages (for pages managed via Meta Business Suite)
        const businessRes = await fetch(`https://graph.facebook.com/v19.0/me/businesses?fields=id,name,owned_pages{id,name,access_token,category}&limit=10&access_token=${userToken}`)
        const businessData = await businessRes.json()
        console.log('[meta-oauth] me/businesses:', JSON.stringify(businessData))

        if (businessData.data) {
            for (const biz of businessData.data) {
                if (biz.owned_pages?.data) {
                    for (const page of biz.owned_pages.data) {
                        // Avoid duplicates
                        if (!allPages.find(p => p.id === page.id)) {
                            allPages.push(page)
                        }
                    }
                }
            }
        }

        // 4. Also check client pages in business portfolio
        if (businessData.data) {
            for (const biz of businessData.data) {
                const clientPagesRes = await fetch(`https://graph.facebook.com/v19.0/${biz.id}/client_pages?fields=id,name,access_token,category&limit=50&access_token=${userToken}`)
                const clientPagesData = await clientPagesRes.json()
                console.log(`[meta-oauth] business ${biz.id} client_pages:`, JSON.stringify(clientPagesData))
                
                if (clientPagesData.data) {
                    for (const page of clientPagesData.data) {
                        if (!allPages.find(p => p.id === page.id)) {
                            allPages.push(page)
                        }
                    }
                }
            }
        }

        console.log('[meta-oauth] Total pages found:', allPages.length)
        
        return new Response(JSON.stringify({ pages: allPages }), {
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
