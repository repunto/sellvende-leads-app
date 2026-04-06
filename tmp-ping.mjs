import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const ANON_KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

// We need the SERVICE ROLE key to bypass JWT verification
// If the anon key is not working use the service role key from the dashboard
const KEY_TO_USE = ANON_KEY; // change to service role if needed

async function test() {
    console.log('Testing process-drips at:', SUPABASE_URL);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/process-drips`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${KEY_TO_USE}`,
            'Content-Type': 'application/json',
            'apikey': KEY_TO_USE,
        },
        body: JSON.stringify({})
    });
    const text = await res.text();
    console.log('Status:', res.status);
    try {
        const json = JSON.parse(text);
        console.log('Response:', JSON.stringify(json, null, 2));
        if (json.errors?.length > 0) {
            console.log('\n❌ ERRORES EN EL MOTOR:');
            json.errors.forEach(e => console.log('  -', e));
        } else if (json.success) {
            console.log('\n✅ Motor OK. Enviados:', json.enviados);
        }
    } catch {
        console.log('Raw:', text);
    }
}
test();
