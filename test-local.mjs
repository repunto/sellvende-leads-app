function cleanHtmlForEmail(raw) {
    if (!raw) return '';
    let s = raw.trim();
    s = s.replace(/<p[^>]*>(?:<br\s*\/?>|&nbsp;|\s*)<\/p>/gi, '');
    s = s.replace(/<br\s*\/?>\s*<\/p>/gi, '</p>');
    s = s.replace(/<br\s*\/?>\s*<\/p>/gi, '</p>');
    let changed = true;
    while (changed) {
        const before = s;
        s = s.replace(/<\/p>\s*<p([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => {
            let plainText = inner.replace(/<[^>]+>/g, '').trim();
            plainText = plainText.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').trim();
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
    return s.replace(/(?:<br\s*\/?>){3,}/gi, '<br><br>');
}
console.log('Test 1:', cleanHtmlForEmail('<p>Puede reservar aquí<br>👉</p>'));
console.log('Test 2:', cleanHtmlForEmail('<p>Puede reservar aquí<br>&nbsp;👉</p>'));
console.log('Test 3 (Spaces):', cleanHtmlForEmail('<p>Es una aventura</p><p><br></p><p>Precio</p>'));
console.log('Test 4 (Newlines):', cleanHtmlForEmail('<p>Es una aventura</p>\n<p><br></p>\n<p>Precio</p>'));
