require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase.from('email_templates').select('*');
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}
main();
