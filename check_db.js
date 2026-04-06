import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dtloiqfkeasfcxiwlvzp.supabase.co'
const supabaseKey = 'sb_publishable_TS1zqRv0HQgmrOt_GglaRQ_0gm8jp4C' // Use anon key since leads_secuencias and email_log might be readable by authenticated user if RLS is setup, but wait! We can bypass RLS by getting the service role key from .env... Oh wait, the local env doesn't have it.
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPlaybooks() {
  const { data: envs, error: e1 } = await supabase
    .from('leads_secuencias')
    .select('*, lead:leads(email)')
    .order('created_at', { ascending: false })
    .limit(10)

  console.log('--- ULTIMOS ENROLAMIENTOS ---')
  if (e1) console.error('Error:', e1)
  else console.log(envs)

  const { data: logs, error: e2 } = await supabase
    .from('email_log')
    .select('id, lead_id, tipo, asunto, estado, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  console.log('\n--- ULTIMOS EMAILS ENVIADOS ---')
  if (e2) console.error('Error:', e2)
  else console.log(logs)
}

checkPlaybooks()
