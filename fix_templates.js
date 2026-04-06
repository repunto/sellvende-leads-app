import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envStr = '';
try { envStr = fs.readFileSync('.env', 'utf-8'); } catch(e) {}
const envs = {};
envStr.split('\n').forEach(l => {
    const p = l.split('=');
    if (p.length >= 2) envs[p[0].trim()] = p.slice(1).join('=').trim();
});

const sbUrl = envs.VITE_SUPABASE_URL || 'https://dtloiqfkeasfcxiwlvzp.supabase.co';
const sbKey = envs.VITE_SUPABASE_ANON_KEY;

const sb = createClient(sbUrl, sbKey);

async function run() {
    const { data: records, error } = await sb.from('plantillas_email').select('id, nombre, contenido_html');
    if (error) {
        console.error(error);
        return;
    }
    fs.writeFileSync('templates_dump.json', JSON.stringify(records, null, 2));
    console.log('Dumped', records.length, 'templates');
}

run();
