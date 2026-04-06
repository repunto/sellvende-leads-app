/**
 * Script de limpieza de leads: elimina "Valle Sagrado", normaliza nombres con fecha.
 * Usa service_role para saltear RLS.
 */
const { createClient } = require('@supabase/supabase-js');

const SUPA_URL = 'https://dtloiqfkeasfcxiwlvzp.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bG9pcWZrZWFzZmN4aXdsdnpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjkyNjU4NywiZXhwIjoyMDg4NTAyNTg3fQ.IIjXlYf1DvfHmOhftrewJAOGPEdk7vMSXv0el2z6PwY';

const sb = createClient(SUPA_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function cleanName(str) {
  if (!str) return str;
  return str.includes(' - ') ? str.split(' - ')[0].trim() : str.trim();
}

async function run() {
  console.log('=== LIMPIEZA DE LEADS ===\n');

  // PASO 1: Leer todos los leads
  let from = 0, allLeads = [], done = false;
  while (!done) {
    const { data, error } = await sb
      .from('leads')
      .select('id, tour_nombre, form_name')
      .range(from, from + 99);
    if (error) { console.error('Error leyendo:', error.message); break; }
    if (!data || data.length === 0) { done = true; break; }
    allLeads.push(...data);
    from += 100;
    if (data.length < 100) done = true;
  }
  console.log(`Total leads leídos: ${allLeads.length}`);

  // PASO 2: Filtrar los que hay que borrar (Valle Sagrado)
  const toDelete = allLeads.filter(r =>
    (r.tour_nombre || '').toLowerCase().includes('valle sagrado') ||
    (r.form_name   || '').toLowerCase().includes('valle sagrado')
  );
  console.log(`Leads "Valle Sagrado" a eliminar: ${toDelete.length}`);
  for (const row of toDelete) {
    const { error } = await sb.from('leads').delete().eq('id', row.id);
    if (error) console.error('  Error borrando', row.id, error.message);
    else console.log('  Eliminado:', row.id, row.tour_nombre);
  }

  // PASO 3: Normalizar nombres con fecha
  const remaining = allLeads.filter(r =>
    !(r.tour_nombre || '').toLowerCase().includes('valle sagrado') &&
    !(r.form_name   || '').toLowerCase().includes('valle sagrado')
  );

  let fixedCount = 0;
  for (const row of remaining) {
    const n = cleanName(row.tour_nombre);
    const f = cleanName(row.form_name) || n;
    const changed = n !== row.tour_nombre || f !== row.form_name;
    if (changed) {
      const { error } = await sb.from('leads').update({ tour_nombre: n, form_name: f }).eq('id', row.id);
      if (error) console.error('  Error fix', row.id, error.message);
      else { fixedCount++; process.stdout.write('.'); }
    }
  }
  console.log(`\nNormalizados: ${fixedCount} leads`);

  // PASO 4: Verificar resultado final
  const { data: check } = await sb.from('leads').select('tour_nombre').not('tour_nombre', 'is', null);
  const unique = [...new Set((check || []).map(r => r.tour_nombre))].sort();
  console.log('\n=== FORMULARIOS EN DB DESPUÉS ===');
  unique.forEach(u => console.log(' •', u));
  console.log('\n✅ LIMPIEZA COMPLETADA');
}

run().catch(console.error);
