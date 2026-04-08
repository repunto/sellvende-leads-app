import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// 1x1 Transparent GIF Pixel
const PIXEL = new Uint8Array([
    71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 0, 0, 0, 
    255, 255, 255, 33, 249, 4, 1, 0, 0, 0, 0, 44, 0, 0, 0, 0, 
    1, 0, 1, 0, 0, 2, 2, 68, 1, 0, 59
])

serve(async (req) => {
    const url = new URL(req.url)
    const logId = url.searchParams.get('logId')

    if (logId) {
        // Fire-and-forget DB update for idempotency
        await supabase.from('email_log')
            .update({ abierto_at: new Date().toISOString(), estado: 'abierto' })
            .eq('id', logId)
            // We only update if it is 'enviado'. If it's already 'abierto', that's fine, it just overwrites the timestamp.
            .then(({ error }) => {
                if (error) console.error("[TrackOpen] Failed to update log:", error)
                else console.log(`[TrackOpen] Log ${logId} marked as OPEN.`)
            })
    }

    return new Response(PIXEL, {
        headers: {
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            // Allow cross-origin image loads
            'Access-Control-Allow-Origin': '*'
        }
    })
})
