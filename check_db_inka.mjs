import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dtloiqfkeasfcxiwlvzp.supabase.co'
const supabaseKey = 'sb_publishable_TS1zqRv0HQgmrOt_GglaRQ_0gm8jp4C' // Use anon key since leads_secuencias and email_log might be readable by authenticated user if RLS is setup, but wait! We can bypass RLS by getting the service role key from .env... Oh wait, the local env doesn't have it.
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPlaybooks() {
  const { data: leads, error: e0 } = await supabase
    .from('leads')
    .select('*')
    .ilike('tour_nombre', '%inkan%')
    .limit(10)
    
  console.log('--- LEADS INKA JUNGLE ---')
  if (e0) {
      console.error('Error:', e0)
  } else {
      console.log(leads)
  }

  const { data: leads2, error: e00 } = await supabase
    .from('leads')
    .select('id, form_name, tour_nombre')
    .ilike('form_name', '%inka jungle%')
    .limit(10)
    
  console.log('--- LEADS INKA JUNGLE (form_name) ---')
  if (e00) {
      console.error('Error:', e00)
  } else {
      console.log(leads2)
  }
}

checkPlaybooks()
