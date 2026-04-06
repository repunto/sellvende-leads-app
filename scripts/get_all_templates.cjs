const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const VITE_SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const VITE_SUPABASE_ANON_KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

fetch(`${VITE_SUPABASE_URL}/rest/v1/plantillas_email?select=id,tipo,nombre,asunto`, {
  headers: {
    'apikey': VITE_SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${VITE_SUPABASE_ANON_KEY}`
  }
}).then(r => r.json()).then(data => {
  if (data.error || data.code) { console.error('Error fetching', data); return; }
  console.log(JSON.stringify(data, null, 2));
}).catch(console.error);
