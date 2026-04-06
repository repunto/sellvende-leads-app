const U = 'https://dtloiqfkeasfcxiwlvzp.supabase.co';
const K = 'sb_publishable_TS1zqRv0HQgmrOt_GglaRQ_0gm8jp4C';

async function fetchTemplate() {
    const url = U + `/rest/v1/plantillas_email?select=id,nombre,contenido_html`;
    const res = await fetch(url, {headers:{'apikey':K,'Authorization':'Bearer '+K}});
    const val = await res.json();
    val.forEach(t => {
        console.log(`\n\n=== ${t.nombre} ===\n`);
        console.log(t.contenido_html);
    });
}

fetchTemplate();
