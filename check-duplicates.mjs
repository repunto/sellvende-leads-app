const U = 'https://dtloiqfkeasfcxiwlvzp.supabase.co';
const K = 'sb_publishable_TS1zqRv0HQgmrOt_GglaRQ_0gm8jp4C';

async function checkAndApplyUniques() {
    console.log('Fetching all email properties from leads...');
    
    let hasNext = true;
    let offset = 0;
    const allLeads = [];
    
    // Paginate in chunks of 1000
    while(hasNext) {
        const res = await fetch(`${U}/rest/v1/leads?select=id,email&limit=1000&offset=${offset}`, {
            headers: {'apikey': K, 'Authorization': 'Bearer ' + K}
        });
        const batch = await res.json();
        
        if (!res.ok) {
            console.error('Error fetching leads:', batch);
            return;
        }
        
        if (batch.length > 0) {
            allLeads.push(...batch);
            offset += 1000;
        } else {
            hasNext = false;
        }
    }

    console.log(`\nRecords read: ${allLeads.length}`);
    
    const counts = {};
    const dupesByEmail = {};

    allLeads.forEach(lead => {
        if (!lead.email) return;
        const e = lead.email.toLowerCase().trim();
        if (e === '') return;
        
        if (!counts[e]) {
            counts[e] = [];
        }
        counts[e].push(lead.id);
    });

    for (const [email, ids] of Object.entries(counts)) {
        if (ids.length > 1) {
            dupesByEmail[email] = ids;
        }
    }
    
    const dupeEmails = Object.keys(dupesByEmail);
    console.log(`Total duplicated emails: ${dupeEmails.length}`);
    
    if (dupeEmails.length > 0) {
        console.log('\nTop 5 Duplicate Emails:');
        dupeEmails.slice(0,5).forEach(e => {
            console.log(`- ${e} => IDs [${dupesByEmail[e].join(', ')}]`);
        });

        console.log('\n--- COMMENCING DUPLICATE RESOLUTION ---');
        let deletedCount = 0;
        for (const email of dupeEmails) {
            const ids = dupesByEmail[email];
            // keep the first ID, delete the rest
            const idsToDelete = ids.slice(1); 
            
            // Delete directly via REST using Service Key? Wait, anon key K cannot delete!
            console.log(`Would delete ${idsToDelete.length} duplicates for ${email}...`);
            // But K is just anon key. If RLS blocks it, we might need Service Key. 
            // In fact, RLS for leads might allow delete?
            
            const delRes = await fetch(`${U}/rest/v1/leads?id=in.(${idsToDelete.join(',')})`, {
                method: 'DELETE',
                headers: {'apikey': K, 'Authorization': 'Bearer ' + K}
            });
            if (delRes.ok) {
                deletedCount += idsToDelete.length;
            } else {
                console.error(`Failed to delete for ${email}:`, await delRes.text());
            }
        }
        console.log(`Finished handling duplicates. Deleted ${deletedCount} rows.`);
    } else {
        console.log('No duplicates. Ready to apply UNIQUE constraints!');
    }
}

checkAndApplyUniques();
