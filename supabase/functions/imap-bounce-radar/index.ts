import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { ImapFlow } from "npm:imapflow"; // Modern Async IMAP client

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
    // Basic auth protection mimicking Supabase edge function secrets if called directly via curl,
    // though this is normally scheduled via pg_cron without headers (so we skip strict auth for now 
    // or rely on pg_cron running it as service_role).
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    console.log(`[BOUNCE-RADAR] Iniciando escaneo IMAP para agencias...`);

    // 1. Obtener agencias que usan Gmail (SMTP externo)
    const { data: configs } = await supabase
        .from('configuracion')
        .select('agencia_id, clave, valor')
        .in('clave', ['gmail_user', 'gmail_app_password']);

    // Agrupar credenciales por agencia
    const agencies = new Map();
    configs?.forEach(c => {
        if (!agencies.has(c.agencia_id)) agencies.set(c.agencia_id, {});
        agencies.get(c.agencia_id)[c.clave] = c.valor;
    });

    let processedCount = 0;

    for (const [agenciaId, creds] of agencies.entries()) {
        const user = creds['gmail_user'];
        const pass = creds['gmail_app_password'];
        
        if (!user || !pass) continue;

        const client = new ImapFlow({
            host: 'imap.gmail.com',
            port: 993,
            secure: true,
            auth: { user, pass },
            logger: false // Silence verbose logs
        });

        try {
            await client.connect();
            console.log(`[BOUNCE-RADAR] Agencia ${agenciaId} conectada correctamente a IMAP.`);
            
            // Abre Inbox en modo READ-WRITE para poder borrar/mover correos luego
            let lock = await client.getMailboxLock('INBOX');
            try {
                // Fetch correos de mailer-daemon que no se han leído
                for await (let msg of client.fetch({ from: 'mailer-daemon@googlemail.com', seen: false }, { envelope: true, source: true })) {
                    const sourceText = msg.source.toString();
                    
                    // --- Análisis Exhaustivo de Hard vs Soft Bounce ---
                    const isHardBounce = /550(?:\s+5\.1\.[12]|.*does not exist|.*not found|.*User unknown)/i.test(sourceText);
                    const isSoftBounce = /4[0-9]{2}(?:\s+.*quota exceeded|.*Delay|.*mailbox full|.*Over quota)/i.test(sourceText);
                    
                    // --- Trazabilidad ---
                    // En process-drips nosotros generamos Message-ID: <uuid@leads.sellvende.com>
                    const logIdMatch = sourceText.match(/Message-ID:\s*<([0-9a-f\-]+)@leads\.sellvende\.com>/i);
                    // Alternativa en caso de que no haya logId explícito (fallback manual)
                    const bouncedEmailMatch = sourceText.match(/Failed recipient:\s*([^\s]+)/i) || sourceText.match(/To:\s*([^\s<]+@[^\s>]+)/i);

                    const emailLogId = logIdMatch ? logIdMatch[1] : null;
                    const bouncedEmail = bouncedEmailMatch ? bouncedEmailMatch[1] : null;

                    if (emailLogId) {
                        // Mapeo exacto
                        const { data: logInfo } = await supabase
                            .from('email_log')
                            .select('lead_id')
                            .eq('id', emailLogId)
                            .single();
                        
                        if (logInfo) {
                            if (isHardBounce) {
                                // AUTO-KILL PROTOCOL
                                await supabase.from('leads').update({
                                    email_rebotado: true,
                                    estado: 'correo_falso',
                                    motivo_rebote: 'Gmail API Hard Bounce'
                                }).eq('id', logInfo.lead_id);

                                await supabase.from('leads_secuencias')
                                    .update({ estado: 'cancelada' })
                                    .eq('lead_id', logInfo.lead_id)
                                    .eq('agencia_id', agenciaId); // Paranoia Check
                                
                                console.log(`[BOUNCE-RADAR] Ejecutado Auto-Kill para lead ${logInfo.lead_id} (Agencia: ${agenciaId}).`);
                            } else if (isSoftBounce) {
                                // Pausamos The Drip
                                await supabase.from('leads_secuencias')
                                    .update({ estado: 'pausada' })
                                    .eq('lead_id', logInfo.lead_id);
                                console.log(`[BOUNCE-RADAR] Ejecutada Pausa Temporal por Soft Bounce para lead ${logInfo.lead_id}.`);
                            }
                        }
                    } else if (bouncedEmail) {
                         // Fallback si no tiene Message-ID nuestro (quizás fue enviado manual)
                         console.log(`[BOUNCE-RADAR] Rebote detectado para ${bouncedEmail} pero sin Message-ID de rastreo. Loggeado pero inactivo para Auto-Kill.`);
                    }

                    // --- LIMPIEZA INVISIBLE ---
                    // Marcar como leído
                    await client.messageFlagsAdd(msg.seq, ['\\Seen']);
                    // Mover a la papelera (Trabajando con las carpetas standard de Gmail)
                    try {
                        await client.messageMove(msg.seq, '[Gmail]/Trash'); 
                    } catch (err) {
                        // Fallback si el folder [Gmail]/Trash no se llama así por lenguaje
                        try {
                            await client.messageMove(msg.seq, '[Gmail]/Papelera');
                        } catch(e2) {
                            console.warn(`No se pudo mover a la papelera el msg ${msg.seq}`);
                        }
                    }
                    processedCount++;
                }
            } finally {
                lock.release();
            }
            await client.logout();
            console.log(`[BOUNCE-RADAR] Agencia ${agenciaId} procesada y desconectada.`);
        } catch (e: any) {
            console.error(`[BOUNCE-RADAR] Error conectando/leyendo IMAP para Agencia ${agenciaId}: ${e.message}`);
        }
    }

    return new Response(JSON.stringify({ status: "success", processed: processedCount }), { 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
    });
});
