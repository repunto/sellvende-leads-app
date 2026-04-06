// Test real con varios casos de TipTap
import { cleanHtmlForEmail } from './src/lib/emailTemplate.js';

function fixedCleanHtml(raw) {
    if (!raw) return '';
    let s = raw.trim();

    // STEP 1: Process Empty Lines FIRST to preserve them.
    // TipTap uses <p></p> or <p><br></p> or <p>&nbsp;</p> as empty lines.
    // Convert them to a single <br> so the space isn't lost, and prevent them 
    // from being merged into other paragraphs.
    s = s.replace(/<p[^>]*>(?:<br\s*\/?>|&nbsp;|\s*)<\/p>/gi, '<br><br>');

    // STEP 2: Remove trailing <br> inside paragraphs containing text
    s = s.replace(/<br\s*\/?>\s*<\/p>/gi, '</p>');
    s = s.replace(/<br\s*\/?>\s*<\/p>/gi, '</p>'); // second pass

    // STEP 3: Merge emoji/symbol-only paragraphs
    let changed = true;
    while (changed) {
        const before = s;
        s = s.replace(/<\/p>\s*<p([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => {
            // Unescape HTML entities so &nbsp; becomes a space, &amp; becomes &, etc.
            // This prevents the 'n', 'b', 's', 'p' from being detected as letters.
            let plainText = inner.replace(/<[^>]+>/g, '').trim();
            // simple entity decode for basic ones
            plainText = plainText.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').trim();
            
            // If it's ONLY emojis/punctuation/spaces (no letters/numbers)
            if (plainText.length > 0 && !/[a-zA-ZÀ-ÿ0-9]/.test(plainText)) {
                return ' ' + plainText + '</p>';
            }
            return match;
        });
        changed = s !== before;
    }

    // STEP 4: Apply normal email margins to avoid tight text or excess gaps
    s = s.replace(/<p>/gi, '<p style="margin: 0 0 10px 0;">');
    s = s.replace(/<p ((?!style=)[^>]*)>/gi, '<p $1 style="margin: 0 0 10px 0;">');
    s = s.replace(/style="margin: 0 0 10px 0;" style="margin: 0 0 10px 0;"/gi, 'style="margin: 0 0 10px 0;"');

    // Make <br><br> blocks uniform
    s = s.replace(/(?:<br\s*\/?>){3,}/gi, '<br><br>');

    return s;
}

const cases = [
    '<p>¡Hola David!</p><p></p><p>Es una aventura...</p>',
    '<p>¡Hola David!</p><p>&nbsp;</p><p>Es una aventura...</p>',
    '<p>¡Hola David!</p><p><br></p><p>Es una aventura...</p>',
    '<p>Puede reservar el tour directamente aquí</p><p>👉</p><p>aquí <a href="#">Inka Jungle Premium</a></p>',
    '<p>Puede reservar el tour directamente aquí</p><p>👉&nbsp;<br/></p><p>aquí <a href="#">Inka Jungle Premium</a></p>',
    '<p>Hola</p><p>👉</p><p>&nbsp;👍</p><p>Adiós</p>'
];

cases.forEach((html, i) => {
    console.log(`\n--- CASO ${i+1} ---`);
    console.log('INPUT:', html);
    console.log('OUTPUT:', fixedCleanHtml(html));
});
