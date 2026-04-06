import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dtloiqfkeasfcxiwlvzp.supabase.co'
const supabaseKey = 'sb_publishable_TS1zqRv0HQgmrOt_GglaRQ_0gm8jp4C'
const supabase = createClient(supabaseUrl, supabaseKey)

async function diagnostico2() {
  console.log('═══════════════════════════════════════════════')
  console.log('   DIAGNÓSTICO v2 — Detectando tablas reales')
  console.log('═══════════════════════════════════════════════\n')

  // Intentar nombres alternativos de la tabla de secuencias
  const tablasCandidatas = ['secuencias_email', 'secuencias', 'drip_sequences', 'sequences']
  for (const t of tablasCandidatas) {
    const { data, error } = await supabase.from(t).select('*').limit(1)
    if (!error) {
      console.log(`✅ Tabla de secuencias encontrada: "${t}"`)
      console.log('   Primer registro:', JSON.stringify(data?.[0], null, 2))
      // Contar total
      const { count } = await supabase.from(t).select('*', { count: 'exact', head: true })
      console.log(`   Total registros: ${count}`)
    }
  }

  // leads_secuencias
  console.log('\n─── leads_secuencias ───')
  const { data: ls, error: lsE, count: lsCount } = await supabase
    .from('leads_secuencias')
    .select('*', { count: 'exact' })
    .limit(5)
  if (lsE) console.log('❌ Error:', lsE.message)
  else {
    console.log(`Total registros: ${lsCount}`)
    if (ls?.[0]) console.log('Columnas:', Object.keys(ls[0]).join(', '))
    ls?.forEach(r => console.log('  ', JSON.stringify(r)))
  }

  // email_log
  console.log('\n─── email_log ───')
  const { data: el, error: elE, count: elCount } = await supabase
    .from('email_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(5)
  if (elE) console.log('❌ Error:', elE.message)
  else {
    console.log(`Total registros: ${elCount}`)
    if (el?.[0]) console.log('Columnas:', Object.keys(el[0]).join(', '))
    el?.forEach(r => console.log('  ', JSON.stringify(r)))
  }

  // configuracion
  console.log('\n─── configuracion ───')
  const { data: cfg, error: cfgE, count: cfgCount } = await supabase
    .from('configuracion')
    .select('*', { count: 'exact' })
    .limit(20)
  if (cfgE) console.log('❌ Error:', cfgE.message)
  else {
    console.log(`Total registros: ${cfgCount}`)
    if (cfg?.[0]) console.log('Columnas:', Object.keys(cfg[0]).join(', '))
    cfg?.forEach(r => {
      const val = (r.clave?.includes('password') || r.clave?.includes('api_key'))
        ? '***' : r.valor
      console.log(`   [${r.agencia_id}] ${r.clave} = ${val}`)
    })
  }

  // plantillas_email
  console.log('\n─── plantillas_email ───')
  const { data: pl, error: plE } = await supabase
    .from('plantillas_email')
    .select('*')
    .limit(3)
  if (plE) console.log('❌ Error:', plE.message)
  else {
    console.log(`Encontradas: ${pl?.length}`)
    if (pl?.[0]) console.log('Columnas:', Object.keys(pl[0]).join(', '))
    pl?.forEach(p => console.log(`   "${p.nombre || p.name}" | Asunto: "${p.asunto || p.subject}" | ID: ${p.id}`))
  }

  // leads - verificar cuántos hay
  console.log('\n─── leads (total) ───')
  const { count: leadsCount } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
  console.log(`Total leads: ${leadsCount}`)

  // Verificar RLS: ¿Puede el anon key leer leads_secuencias?
  console.log('\n─── TEST RLS: ¿anon key puede leer leads_secuencias? ───')
  const { data: rlsTest, error: rlsErr } = await supabase
    .from('leads_secuencias')
    .select('id')
    .limit(1)
  if (rlsErr) console.log('❌ RLS BLOQUEANDO:', rlsErr.message)
  else console.log(`✅ Lectura OK. Registros visibles: ${rlsTest?.length}`)

  console.log('\n═══════════════════════════════════════════════')
}

diagnostico2().catch(console.error)
