import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dtloiqfkeasfcxiwlvzp.supabase.co'
const supabaseKey = 'sb_publishable_TS1zqRv0HQgmrOt_GglaRQ_0gm8jp4C'
const supabase = createClient(supabaseUrl, supabaseKey)

// Create a mock user auth token by calling a Supabase edge function?
// Let's just try logging in as a known user if the user left a test password.
async function checkTable() {
    const { data: cols, error: e1 } = await supabase
      .from('email_log')
      .select('agencia_id, lead_id, tipo, email_enviado, asunto, estado')
      .limit(1)

    console.log('--- SCHEMA TEST email_log ---')
    if (e1) console.error('Error:', e1)
    else console.log('Schema is valid')
}
checkTable()
