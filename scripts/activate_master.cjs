const fs = require('fs');

async function run() {
  const env = fs.readFileSync('.env', 'utf-8');
  let VITE_SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
  const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bG9pcWZrZWFzZmN4aXdsdnpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjkyNjU4NywiZXhwIjoyMDg4NTAyNTg3fQ.IIjXlYf1DvfHmOhftrewJAOGPEdk7vMSXv0el2z6PwY';

  if (!VITE_SUPABASE_URL) VITE_SUPABASE_URL = 'https://dtloiqfkeasfcxiwlvzp.supabase.co';

  const ag = "c05752dc-1fc4-438c-af64-f83b013f9c24";
  
  const r2 = await fetch(`${VITE_SUPABASE_URL}/rest/v1/configuracion?agencia_id=eq.${ag}&clave=eq.master_sequence_switch`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ valor: 'true' })
  });

  if (!r2.ok) {
    console.error(`Error configurando master switch:`, await r2.text());
  } else {
    console.log(`✅ Master switch activado para agencia ${ag}`);
  }
}

run();
