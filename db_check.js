import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Checking database...");

    // Login with the user's credentials to see their perspective
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'inkajungletour@gmail.com',
        password: 'password123' // assuming a standard dev password, or we can just query with anon/service key if we had it
    });

    // Since we only have ANON key, let's just query agencias to see what's public
    const { data: agencias, error: errA } = await supabase.from('agencias').select('*');
    console.log("Agencias:", agencias);

    const { data: ua, error: errUa } = await supabase.from('usuarios_agencia').select('*');
    console.log("Usuarios Agencia:", ua);
}

run();
