import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dtloiqfkeasfcxiwlvzp.supabase.co'
const supabaseKey = 'sb_publishable_TS1zqRv0HQgmrOt_GglaRQ_0gm8jp4C'
const supabase = createClient(supabaseUrl, supabaseKey)

async function testJoin() {
  const { data, error } = await supabase.from('leads').select('id, email, leads_secuencias(estado, secuencia_id), email_log(count)').limit(2)
  console.log("Error:", error)
  console.log("Data:", JSON.stringify(data, null, 2))
}
testJoin()
