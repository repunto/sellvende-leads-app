import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dtloiqfkeasfcxiwlvzp.supabase.co'
const supabaseKey = 'sb_publishable_TS1zqRv0HQgmrOt_GglaRQ_0gm8jp4C' 
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: leads } = await supabase.from('leads').select('form_name, tour_nombre').limit(20)
  console.log(leads)
}
run()
