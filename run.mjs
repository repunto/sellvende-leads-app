import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dtloiqfkeasfcxiwlvzp.supabase.co';
const supabaseKey = 'sb_publishable_TS1zqRv0HQgmrOt_GglaRQ_0gm8jp4C';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('--- FETCHING LAST LOGS ---');
  const { data: logs, error: err1 } = await supabase.from('email_log').select('*').order('created_at', { ascending: false }).limit(5);
  console.log(logs);

  console.log('--- FETCHING LAST LEADS SECUENCIAS ---');
  const { data: ls, error: err2 } = await supabase.from('leads_secuencias').select('*, lead:leads(email, ultimo_contacto)').order('created_at', { ascending: false }).limit(3);
  console.log(JSON.stringify(ls, null, 2));

  console.log('--- DONE ---');
}
check();
