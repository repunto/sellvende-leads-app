import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''

async function verifyAuth(req: Request): Promise<boolean> {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return false;
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return false;

    try {
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
        const authClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data: { user }, error } = await authClient.auth.getUser();
        if (error) return false;
        return !!user;
    } catch {
        return false;
    }
}
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

    const isAuthenticated = await verifyAuth(req);
    if (!isAuthenticated) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    try {
        const { short_lived_token, page_id } = await req.json()
        
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

        // 1. Exchange short-lived user token → long-lived user token
        const exchangeUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${short_lived_token}`
        const exRes = await fetch(exchangeUrl)
        const exData = await exRes.json()
        
        console.log('[meta-oauth] Token exchange:', exData.error || 'OK, expires_in=' + exData.expires_in)
        
        if (exData.error) {
            return new Response(JSON.stringify({ error: 'Error al intercambiar token: ' + exData.error.message }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
            })
        }
        
        const userToken = exData.access_token
        const allPages: Array<{id: string, name: string, access_token: string, category?: string}> = []

        // 2. Strategy A: Standard me/accounts
        // SECURITY (Risk #12): Using headers for tokens
        const accountsRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,category&limit=50`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        })
        const accountsData = await accountsRes.json()
        console.log('[meta-oauth] me/accounts count:', accountsData?.data?.length ?? 'error', accountsData?.error?.message ?? '')
        
        if (accountsData.data?.length > 0) {
            allPages.push(...accountsData.data)
        }

        // 3. Strategy B: If page_id provided, fetch page token directly
        // (Works for Business-portfolio-managed pages that don't appear in me/accounts)
        if (page_id && allPages.find(p => p.id === page_id) === undefined) {
            // SECURITY (Risk #12): Using headers for tokens
            const directRes = await fetch(`https://graph.facebook.com/v19.0/${page_id}?fields=id,name,access_token,category`, {
                headers: { 'Authorization': `Bearer ${userToken}` }
            })
            const directData = await directRes.json()
            console.log('[meta-oauth] Direct page fetch:', JSON.stringify(directData).slice(0, 200))
            
            if (directData.id && directData.access_token) {
                allPages.push(directData)
            } else if (directData.id && !directData.access_token) {
                // Has access to page info but no token — need page-level scope
                console.warn('[meta-oauth] Page found but no access_token in response:', directData.id)
                allPages.push({ id: directData.id, name: directData.name, access_token: userToken, category: directData.category })
            } else {
                console.warn('[meta-oauth] Direct page fetch failed:', JSON.stringify(directData))
            }
        }

        // 4. Strategy C: Business Portfolio — owned_pages + client_pages
        if (allPages.length === 0) {
            // SECURITY (Risk #12): Using headers for tokens
            const bizRes = await fetch(`https://graph.facebook.com/v19.0/me/businesses?fields=id,name&limit=10`, {
                headers: { 'Authorization': `Bearer ${userToken}` }
            })
            const bizData = await bizRes.json()
            console.log('[meta-oauth] me/businesses:', bizData?.data?.length ?? 0, 'businesses')

            for (const biz of (bizData.data || [])) {
                // SECURITY (Risk #12): Using headers for tokens
                const ownedRes = await fetch(`https://graph.facebook.com/v19.0/${biz.id}/owned_pages?fields=id,name,access_token,category&limit=50`, {
                    headers: { 'Authorization': `Bearer ${userToken}` }
                })
                const ownedData = await ownedRes.json()
                console.log(`[meta-oauth] business ${biz.id} owned_pages:`, ownedData?.data?.length ?? 0, ownedData?.error?.message ?? '')
                for (const page of (ownedData.data || [])) {
                    if (!allPages.find(p => p.id === page.id)) allPages.push(page)
                }

                // SECURITY (Risk #12): Using headers for tokens
                const clientRes = await fetch(`https://graph.facebook.com/v19.0/${biz.id}/client_pages?fields=id,name,access_token,category&limit=50`, {
                    headers: { 'Authorization': `Bearer ${userToken}` }
                })
                const clientData = await clientRes.json()
                console.log(`[meta-oauth] business ${biz.id} client_pages:`, clientData?.data?.length ?? 0, clientData?.error?.message ?? '')
                for (const page of (clientData.data || [])) {
                    if (!allPages.find(p => p.id === page.id)) allPages.push(page)
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
