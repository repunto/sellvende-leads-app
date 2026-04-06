function cleanHtmlForEmail(raw) {
    if (!raw) return '';
    let s = raw.trim();
    
    // FIX 1: Eat the surrounding newlines of the empty paragraph to prevent TipTap from parsing \n\n as a new block!
    s = s.replace(/[\n\r]*\s*<p[^>]*>(?:<br\s*\/?>|&nbsp;|\s*)<\/p>\s*[\n\r]*/gi, '');
    
    // FIX 2: Strip `<br>` if it's only followed by non-letters (like emojis) until the end of the block
    s = s.replace(/<br\s*\/?>\s*([^<a-zA-ZÀ-ÿ0-9]*)\s*<\/p>/gi, ' $1</p>');

    let changed = true;
    while (changed) {
        const before = s;
        s = s.replace(/<\/p>\s*<p([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => {
            let plainText = inner.replace(/<[^>]+>/g, '').trim();
            // simple entity decode
            plainText = plainText.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').trim();
            
            // Checks if it contains ANY letters or numbers. If none, merge.
            // Permite caracteres con tilde (À-ÿ)
            if (plainText.length > 0 && !/[a-zA-ZÀ-ÿ0-9]/.test(plainText)) {
                return ' ' + plainText + '</p>';
            }
            return match;
        });
        changed = s !== before;
    }

    s = s.replace(/<p>/gi, '<p style="margin: 0 0 14px 0;">');
    s = s.replace(/<p ((?!style=)[^>]*)>/gi, '<p $1 style="margin: 0 0 14px 0;">');
    s = s.replace(/style="margin: 0 0 14px 0;" style="margin: 0 0 14px 0;"/gi, 'style="margin: 0 0 14px 0;"');
    s = s.replace(/(?:<br\s*\/?>){3,}/gi, '<br><br>');

    return s;
}

console.log('Test 1 (Emoji after BR):', cleanHtmlForEmail('<p>Puede reservar aquí<br>👉</p>'));
console.log('Test 2 (Spaces leaving Newline):', JSON.stringify(cleanHtmlForEmail('<p>Es una aventura</p>\n\n<p><br></p>\n\n<p>Precio</p>')));
