function cleanHtmlForEmail(raw) {
    if (!raw) return '';

    let s = raw;
    s = s.replace(/<p([^>]*)>\s*<p/gi, '<p');
    s = s.replace(/<\/p>\s*<\/p>/gi, '</p>');
    s = s.replace(/(<br\s*\/?\s*>[\s\n]*){2,}/gi, '<br>');

    // Force <br> in empty paragraphs
    s = s.replace(/<p([^>]*)>\s*<\/p>/gi, '<p$1><br></p>');

    let prev = '';
    while (s !== prev) {
        prev = s;
        
        // Match 2 consecutive paragraphs
        s = s.replace(/<p([^>]*)>([\s\S]*?)<\/p>[\s\n]*(?:<br\s*\/?>)?[\s\n]*<p([^>]*)>([\s\S]*?)<\/p>/gi, (match, a1, c1, a2, c2) => {
            const strip1 = c1.replace(/<[^>]+>/g, '').replace(/&[a-zA-Z0-9#]+;/g, '').trim();
            const isEmoji1 = (strip1.length > 0 && strip1.length <= 10 && !/[a-zA-Z0-9]/.test(strip1));

            const strip2 = c2.replace(/<[^>]+>/g, '').replace(/&[a-zA-Z0-9#]+;/g, '').trim();
            const isEmoji2 = (strip2.length > 0 && strip2.length <= 10 && !/[a-zA-Z0-9]/.test(strip2));

            // Merge backwards: Para 2 is emoji -> append to Para 1
            if (isEmoji2 && !isEmoji1) {
                return `<p${a1}>${c1} ${c2}</p>`;
            }
            // Merge forwards: Para 1 is emoji -> prepend to Para 2
            if (isEmoji1 && !isEmoji2) {
                return `<p${a2}>${c1} ${c2}</p>`;
            }
            // Both emojis -> merge forward
            if (isEmoji1 && isEmoji2) {
                return `<p${a2}>${c1} ${c2}</p>`;
            }
            return match;
        });
    }

    s = s.replace(/(<[^>]*>)?(?:&nbsp;|\s)*([^\s<a-zA-Z0-9&;#>="']{1,8})(?:&nbsp;|\s)*<br\s*\/?>[\s\n]*/gi, (match, tag, chars) => {
        return (tag || '') + chars + ' ';
    });

    s = s.replace(/<p>/gi, '<p style="margin: 0 0 14px 0;">');
    s = s.replace(/style="margin: 0 0 14px 0;" style="margin: 0 0 14px 0;"/gi, 'style="margin: 0 0 14px 0;"');
    s = s.replace(/<b>/gi, '<strong>').replace(/<\/b>/gi, '</strong>');

    return s;
}

const tests = [
  "<p>Texto</p><p>👉</p>",
  "<p>👉</p><p>Texto</p>",
  "<p>Texto superior</p><p>&nbsp;👉</p><p>Enlace aquí</p>",
  "<p>Texto</p><p><span>👉</span></p>",
  "<p>Texto</p> <p> 👉  </p>"
];

console.log("=== LUEGO DE REGLAS MEJORADAS ===");
tests.forEach((t, i) => {
  console.log(`[TEST ${i+1}] Input:`, t);
  console.log(`[TEST ${i+1}] Output:`, cleanHtmlForEmail(t));
});
