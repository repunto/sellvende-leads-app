import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
let envFile = '';
try {
    envFile = fs.readFileSync(envPath, 'utf8');
} catch (e) {
    console.error('Could not read .env file');
    process.exit(1);
}

const envVars = {};
envFile.split('\n').forEach(line => {
    line = line.replace(/\r/g, '').trim();
    if (!line || line.startsWith('#')) return;
    const eqIdx = line.indexOf('=');
    if (eqIdx !== -1) {
        const key = line.substring(0, eqIdx).trim();
        let val = line.substring(eqIdx + 1).trim();
        val = val.replace(/^"|"$/g, '');
        envVars[key] = val;
    }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function patchTours() {
    console.log('Fetching active agency...');
    const { data: agencias, error: agErr } = await supabase.from('agencias').select('id').order('created_at', { ascending: true }).limit(1);

    let agenciaId;
    if (agErr) {
        console.error('Could not fetch agency:', agErr);
        return;
    }

    if (!agencias || agencias.length === 0) {
        console.log('No agency found. Creating default agency...');
        const { data: newAg, error: newErr } = await supabase.from('agencias').insert([{ nombre: 'Quipu Reservas (Demo)', plan: 'free' }]).select('id');
        if (newErr) {
            console.error('Failed to create agency:', newErr);
            return;
        }
        agenciaId = newAg[0].id;
    } else {
        agenciaId = agencias[0].id;
    }

    console.log('Agency ID:', agenciaId);

    console.log('Deleting existing tours...');
    const { error: delErr } = await supabase.from('tours').delete().eq('agencia_id', agenciaId);
    if (delErr) {
        console.error('Delete error:', delErr);
        return;
    }
    console.log('Existing tours deleted.');

    const tours = [
        { agencia_id: agenciaId, nombre: 'Inka Jungle Backpacker', precio_usd: 430, costo_operador: 290, duracion_dias: 4 },
        { agencia_id: agenciaId, nombre: 'Inka Jungle Premium', precio_usd: 450, costo_operador: 300, duracion_dias: 4 },
        { agencia_id: agenciaId, nombre: 'Inka Jungle Privado', precio_usd: 600, costo_operador: 400, duracion_dias: 4 },
        { agencia_id: agenciaId, nombre: 'Inka Trail', precio_usd: 680, costo_operador: 280, duracion_dias: 4 },
        { agencia_id: agenciaId, nombre: 'Valle Sagrado', precio_usd: 50, costo_operador: 40, duracion_dias: 1 },
        { agencia_id: agenciaId, nombre: 'Valle Sagrado Conexion', precio_usd: 500, costo_operador: 210, duracion_dias: 1 },
        { agencia_id: agenciaId, nombre: 'Valle Sagrado Conexion Premium', precio_usd: 600, costo_operador: 257, duracion_dias: 1 },
        { agencia_id: agenciaId, nombre: 'Lares Trek 3 dias', precio_usd: 650, costo_operador: 600, duracion_dias: 3 },
        { agencia_id: agenciaId, nombre: 'Lares Trek 4 dias', precio_usd: 350, costo_operador: 320, duracion_dias: 4 },
        { agencia_id: agenciaId, nombre: 'Uchuycusco 1 dia', precio_usd: 350, costo_operador: 330, duracion_dias: 1 },
        { agencia_id: agenciaId, nombre: 'Uchuycusco 2 dias', precio_usd: 480, costo_operador: 450, duracion_dias: 2 },
        { agencia_id: agenciaId, nombre: 'Uchuycusco 3 dias', precio_usd: 720, costo_operador: 650, duracion_dias: 3 },
        { agencia_id: agenciaId, nombre: 'Maras Moray (Grupal)', precio_usd: 20, costo_operador: 15, duracion_dias: 1 },
        { agencia_id: agenciaId, nombre: 'CHIMOMA', precio_usd: 140, costo_operador: 120, duracion_dias: 1 },
        { agencia_id: agenciaId, nombre: 'CHIMOMA Conexion', precio_usd: 450, costo_operador: 400, duracion_dias: 1 },
        { agencia_id: agenciaId, nombre: 'Rainbow Mountain', precio_usd: 50, costo_operador: 40, duracion_dias: 1 },
        { agencia_id: agenciaId, nombre: 'Machupicchu 1 dia', precio_usd: 290, costo_operador: 270, duracion_dias: 1 },
        { agencia_id: agenciaId, nombre: 'Machupicchu 2 dias', precio_usd: 300, costo_operador: 275, duracion_dias: 2 },
        { agencia_id: agenciaId, nombre: 'City Tour Cusco (Grupal)', precio_usd: 15, costo_operador: 12, duracion_dias: 1 },
        { agencia_id: agenciaId, nombre: 'City Tour Cusco (Privado)', precio_usd: 150, costo_operador: 120, duracion_dias: 1 },
        { agencia_id: agenciaId, nombre: 'Ausangate Trek 1 dia', precio_usd: 480, costo_operador: 450, duracion_dias: 1 },
        { agencia_id: agenciaId, nombre: 'Ausangate Trek 2 dias', precio_usd: 580, costo_operador: 550, duracion_dias: 2 },
        { agencia_id: agenciaId, nombre: 'Ausangate Trek 5 dias', precio_usd: 650, costo_operador: 600, duracion_dias: 5 },
        { agencia_id: agenciaId, nombre: 'Salkantay Trek 4 dias', precio_usd: 400, costo_operador: 250, duracion_dias: 4 },
        { agencia_id: agenciaId, nombre: 'Salkantay Trek 5 dias', precio_usd: 450, costo_operador: 250, duracion_dias: 5 },
        { agencia_id: agenciaId, nombre: 'Choquequirao 4 dias', precio_usd: 550, costo_operador: 500, duracion_dias: 4 },
        { agencia_id: agenciaId, nombre: 'Choquequirao 5 dias', precio_usd: 650, costo_operador: 600, duracion_dias: 5 },
        { agencia_id: agenciaId, nombre: 'Choquequirao 8 dias', precio_usd: 850, costo_operador: 800, duracion_dias: 8 },
        { agencia_id: agenciaId, nombre: 'Cusco 7x7', precio_usd: 820, costo_operador: 750, duracion_dias: 7 },
        { agencia_id: agenciaId, nombre: 'Cusco 5 dias', precio_usd: 720, costo_operador: 680, duracion_dias: 5 },
        { agencia_id: agenciaId, nombre: 'Cusco y Puno 7 dias', precio_usd: 950, costo_operador: 900, duracion_dias: 7 },
        { agencia_id: agenciaId, nombre: 'Huacachina y Cusco 7 dias', precio_usd: 1800, costo_operador: 1700, duracion_dias: 7 },
        { agencia_id: agenciaId, nombre: 'IJT Confidencial "sin MAPI y sin Tren"', precio_usd: 130, costo_operador: 120, duracion_dias: 4 },
        { agencia_id: agenciaId, nombre: 'Alquiler de bicicletas', precio_usd: 10, costo_operador: 10, duracion_dias: 1 }
    ];

    console.log('Inserting', tours.length, 'tours...');
    const { error: insertErr } = await supabase.from('tours').insert(tours);
    if (insertErr) {
        console.error('Insert error:', insertErr);
    } else {
        console.log('Done! All tours inserted.');
    }
    process.exit(0);
}

patchTours().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
