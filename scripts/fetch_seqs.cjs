const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const VITE_SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bG9pcWZrZWFzZmN4aXdsdnpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjkyNjU4NywiZXhwIjoyMDg4NTAyNTg3fQ.IIjXlYf1DvfHmOhftrewJAOGPEdk7vMSXv0el2z6PwY';

fetch(`${VITE_SUPABASE_URL}/rest/v1/secuencias_marketing?select=*,pasos:pasos_secuencia(*)`, {
  headers: {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
  }
}).then(r => r.json()).then(data => {
  if (data.error || data.code) { console.error('Error fetching', data); return; }
  console.log('--- SECUENCIAS ---');
  console.log(JSON.stringify(data, null, 2));
}).catch(console.error);

fetch(`${VITE_SUPABASE_URL}/rest/v1/plantillas_email?select=id,tipo,nombre,asunto,contenido_html,origen`, {
  headers: {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
  }
}).then(r => r.json()).then(data => {
  console.log('--- EMAILS ---');
  if (data.error) return console.log(data.error);
  const ix = data.filter(d => true);
  console.log(JSON.stringify(ix, null, 2));
}).catch(console.error);
