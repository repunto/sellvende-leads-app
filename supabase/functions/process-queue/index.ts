// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import nodemailer from "npm:nodemailer"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// helper for sleep
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

serve(async (req) => {
    // SECURITY: Ensure this is called with Service Role (Cron or internal backend)
    const authHeader = req.headers.get('Authorization') || ''
    const isAdmin = authHeader.replace('Bearer ', '').trim() === SUPABASE_SERVICE_KEY

    // Fallback: If not Service Role, allow local UI triggering IF they have valid JWT, for manual push
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
    })

    if (!isAdmin) {
        // Double check JWT if not admin
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
        const authClient = createClient(SUPABASE_URL, anonKey, { global: { headers: { Authorization: authHeader } } })
        const { data: { user } } = await authClient.auth.getUser()
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized. Service Role OR valid JWT required.' }), { status: 401 })
        }
    }

    try {
        console.log('[QueueWorker] Started process-queue worker.')

        // 1. Fetch TOP 50 pending emails across all agencies to process in this 60s execution window
        // We use 50 and 1200ms sleep = ~60 seconds max execution time for Edge Functions
        const { data: queueItems, error: fetchErr } = await supabaseClient
            .from('email_queue')
            .select('*')
            .eq('estado', 'pendiente')
            .order('created_at', { ascending: true })
            .limit(50)

        if (fetchErr) throw fetchErr
        if (!queueItems || queueItems.length === 0) {
            console.log('[QueueWorker] No pending emails.')
            return new Response(JSON.stringify({ status: 'idle', message: 'No pending emails' }), { status: 200 })
        }

        console.log(`[QueueWorker] Found ${queueItems.length} emails to process.`)

        // Mark them as "procesando" to prevent other concurrent workers from grabbing them
        const queueIds = queueItems.map(q => q.id)
        await supabaseClient.from('email_queue').update({ estado: 'procesando' }).in('id', queueIds)

        // Group by agency to fetch configs efficiently
        const itemsByAgency = queueItems.reduce((acc, item) => {
            acc[item.agencia_id] = acc[item.agencia_id] || []
            acc[item.agencia_id].push(item)
            return acc
        }, {} as Record<string, any[]>)

        let totalSent = 0
        let totalFailed = 0

        // Process each agency
        for (const agencia_id of Object.keys(itemsByAgency)) {
            const agencyItems = itemsByAgency[agencia_id]

            // Fetch agency credentials
            const { data: configRows } = await supabaseClient
                .from('configuracion')
                .select('clave, valor')
                .eq('agencia_id', agencia_id)
                .in('clave', ['proveedor_email', 'gmail_app_password', 'resend_api_key', 'email_remitente', 'gmail_user'])
            
            const config: Record<string, string> = {}
            if (configRows) configRows.forEach((r: any) => config[r.clave] = r.valor)

            const engine = config['proveedor_email'] || (config['gmail_app_password'] ? 'gmail' : null) || (config['resend_api_key'] ? 'resend' : null)
            const fromEmail = config['email_remitente'] || ''

            if (!engine || !fromEmail) {
                console.warn(`[QueueWorker] Agency ${agencia_id} missing email engine config. Setting items to failed.`)
                await supabaseClient.from('email_queue').update({ 
                    estado: 'fallido', error_log: 'Configuración faltante: Motor de Correos o Remitente no configurado' 
                }).in('id', agencyItems.map(i => i.id))
                totalFailed += agencyItems.length
                continue
            }

            // Setup Mailer 
            let transporter: any = null
            if (engine === 'gmail') {
                const smtpUser = config['gmail_user'] || fromEmail
                transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: { user: smtpUser, pass: config['gmail_app_password'] },
                })
            }

            // Process items sequentially for this agency to respect rate limits
            for (const item of agencyItems) {
                try {
                    let isSuccess = false
                    let resendId = null

                    const mailHeaders: Record<string, string> = {
                        'Precedence': 'bulk',
                        'X-Auto-Response-Suppress': 'OOF, AutoReply',
                        'X-Mailer': 'Sellvende-Email-Engine/2.2-Queue',
                    }

                    if (engine === 'gmail') {
                        const info = await transporter.sendMail({
                            from: fromEmail, // The frontend can inject Name <email> but queue only has raw values, we leave fromEmail
                            to: item.email_destinatario,
                            subject: item.asunto,
                            html: item.cuerpo_html,
                            headers: mailHeaders
                        })
                        isSuccess = true
                        resendId = info.messageId

                        // Respect Gmail limits: maximum 1 email per sec approximately 
                        await sleep(1200) 
                    } else if (engine === 'resend') {
                        const resendRes = await fetch('https://api.resend.com/emails', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${config['resend_api_key']}`,
                            },
                            body: JSON.stringify({
                                from: fromEmail,
                                to: [item.email_destinatario],
                                subject: item.asunto,
                                html: item.cuerpo_html,
                                headers: mailHeaders,
                                tags: [{ name: 'agencia_id', value: agencia_id }]
                            }),
                        })

                        const resendData = await resendRes.json()
                        if (!resendRes.ok) throw new Error(resendData.message || resendData.error || 'Resend API Error')
                        isSuccess = true
                        resendId = resendData.id

                        // Resend API allows up to 10 req/s, but we still sleep slightly to prevent spiking
                        await sleep(200)
                    }

                    if (isSuccess) {
                        // Mark as sent in queue
                        await supabaseClient.from('email_queue').update({ estado: 'enviado', intentos: item.intentos + 1 }).eq('id', item.id)
                        
                        // Insert standard email_log
                        await supabaseClient.from('email_log').insert([{
                            agencia_id: item.agencia_id,
                            lead_id: item.lead_id,
                            tipo: 'masivo', // from queue
                            asunto: item.asunto,
                            cuerpo: item.cuerpo_html,
                            estado: 'enviado',
                            resend_id: resendId,
                            template_id: item.template_id
                        }])

                        // Update lead's ultimo_contacto
                        await supabaseClient.from('leads').update({ ultimo_contacto: new Date().toISOString() }).eq('id', item.lead_id)

                        totalSent++
                    }

                } catch (err) {
                    console.error(`[QueueWorker] Failed to send email queue ${item.id}:`, err.message)
                    // Update queue with error
                    const newIntentos = item.intentos + 1
                    const newEstado = newIntentos >= 3 ? 'fallido' : 'pendiente'
                    await supabaseClient.from('email_queue').update({ 
                        estado: newEstado, 
                        intentos: newIntentos, 
                        error_log: err.message 
                    }).eq('id', item.id)

                    if (newEstado === 'fallido') {
                        await supabaseClient.from('email_log').insert([{
                            agencia_id: item.agencia_id,
                            lead_id: item.lead_id,
                            tipo: 'masivo',
                            asunto: item.asunto,
                            cuerpo: item.cuerpo_html,
                            estado: 'fallido'
                        }])
                    }
                    totalFailed++
                }
            }
        }

        console.log(`[QueueWorker] Completed. Sent: ${totalSent}, Failed/Retry: ${totalFailed}`)
        return new Response(JSON.stringify({ status: 'done', sent: totalSent, failed: totalFailed }), { status: 200 })

    } catch (e: any) {
        console.error('[QueueWorker] Critical error:', e)
        return new Response(JSON.stringify({ error: e.message }), { status: 500 })
    }
})
