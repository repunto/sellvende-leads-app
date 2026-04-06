import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const ANON_KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

async function testResend() {
    console.log('Testing resend-email at:', SUPABASE_URL);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/resend-email`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json',
            'apikey': ANON_KEY,
        },
        body: JSON.stringify({
            from: "Test <test@test.com>",
            to: "repunto@gmail.com",
            subject: "Test",
            html: "<p>Test</p>",
            agencia_id: "some-id" // Might throw 400 if invalid, but not 500
        })
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
}
testResend();
