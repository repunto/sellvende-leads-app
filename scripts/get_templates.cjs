const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const VITE_SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const VITE_SUPABASE_ANON_KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

fetch(`${VITE_SUPABASE_URL}/rest/v1/plantillas_email?select=tipo,nombre,asunto,contenido_html`, {
  headers: {
    'apikey': VITE_SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${VITE_SUPABASE_ANON_KEY}`
  }
}).then(r => r.json()).then(data => {
  if (data.error || data.code) { console.error('Error fetching', data); return; }
  const ijTemplates = data.filter(t => t.nombre && t.nombre.toLowerCase().includes('inka'));
  console.log(JSON.stringify(ijTemplates, null, 2));
}).catch(console.error);
