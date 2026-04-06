const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = (envFile.match(/VITE_SUPABASE_URL\s*=\s*['"]?([^'"\s]+)/) || [])[1];
const SUPABASE_SERVICE_ROLE_KEY = (envFile.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"]?([^'"\s]+)/) || [])[1];
const SUPABASE_ANON_KEY = (envFile.match(/VITE_SUPABASE_ANON_KEY\s*=\s*['"]?([^'"\s]+)/) || [])[1];

async function checkLogs() {
    const fnUrl = `${SUPABASE_URL}/rest/v1/email_log?select=*&order=created_at.desc&limit=100`;
    
    try {
        const res = await fetch(fnUrl, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const data = await res.json();
        
        if (Array.isArray(data)) {
            console.log("Total recent logs:", data.length);
            if (data.length > 0) {
                const counts = {};
                data.forEach(log => {
                    const date = log.created_at.split('T')[0];
                    const key = `${date} | ${log.tipo}`;
                    counts[key] = (counts[key] || 0) + 1;
                });
                console.log("\nDistribution of last 100 emails by Day & Type:");
                console.table(counts);
                
                console.log("\nSample of most recent 5 emails:");
                console.table(data.slice(0, 5));
            } else {
                console.log("No emails found in log.");
            }
        } else {
            console.log("Response ERROR:", data);
        }
    } catch(e) {
        console.error("Error:", e.message);
    }
}
checkLogs();
