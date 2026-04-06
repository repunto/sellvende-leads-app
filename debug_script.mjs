import { createClient } from '@supabase/supabase-js';
import process from 'process';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: q1 } = await supabase.from('email_log').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('--- RECENT EMAIL LOGS ---');
  console.log(JSON.stringify(q1, null, 2));
  
  const { data: q2 } = await supabase.from('leads_secuencias').select('*, lead:leads(email, ultimo_contacto)').order('created_at', { ascending: false }).limit(3);
  console.log('--- RECENT LEADS SECUENCIAS ---');
  console.log(JSON.stringify(q2, null, 2));
}

run();
