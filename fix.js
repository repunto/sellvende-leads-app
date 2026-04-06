const fs = require('fs');
let code = fs.readFileSync('C:/QuipuReservas/supabase/functions/process-drips/index.ts', 'utf8');
if (code.includes('</body></html>`;</html>`')) {
    code = code.replace('</body></html>`;</html>`', '</body></html>`;');
    fs.writeFileSync('C:/QuipuReservas/supabase/functions/process-drips/index.ts', code);
    console.log('Fixed syntax error in process-drips');
} else {
    console.log('Syntax error pattern not found in process-drips');
}
