import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function check() {
    const { data: leads, error } = await supabase.from('leads')
        .select('id, email, form_name, tour_nombre')
        .ilike('tour_nombre', '%inka jungle%')
        .limit(20)

    console.log(leads.length, "leads found")

    if (leads.length > 0) {
        const { data: secs } = await supabase.from('leads_secuencias')
            .select('*')
            .in('lead_id', leads.map(l => l.id))
        console.log("secs found:", secs.length)
        console.log(secs)
    }
}
check()
