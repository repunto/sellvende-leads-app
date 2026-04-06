import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://dtloiqfkeasfcxiwlvzp.supabase.co'
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'copy from .env'

import fs from 'fs'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function run() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  
  // Login first as some test user or just use service role to get a token
  // wait we don't have a user token, let's just invoke without token, we should get 401
  const res1 = await fetch('https://dtloiqfkeasfcxiwlvzp.supabase.co/functions/v1/process-drips', {
      method: 'POST'
  });
  console.log('No token:', res1.status, await res1.text());

  // Wait! Let's get service role token
  const res2 = await fetch('https://dtloiqfkeasfcxiwlvzp.supabase.co/functions/v1/process-drips', {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
  });
  console.log('Service role:', res2.status, await res2.text());
}
run();
