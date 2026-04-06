const EMOJIS_CLASS = '[\\u{1F300}-\\u{1F64F}\\u{1F680}-\\u{1F6FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}\\u{1F900}-\\u{1F9FF}\\u{1FA70}-\\u{1FAFF}\\u{200D}\\u{FE0F}]';

let s = '<p>Puede reservar el tour directamente aquí<br><span style="color:red">👉</span><br>aquí Inka Jungle Premium</p>';

// Replace <br> before emoji (ignoring intervening <span> etc tags)
// We want to match: <br> then optional whitespace/tags then Emoji
// But we want to keep the tags!
const brBefore = new RegExp('<br\\s*\\/?>\\s*((?:<[^>]+>\\s*)*)(?=' + EMOJIS_CLASS + ')', 'gu');
s = s.replace(brBefore, ' $1');

const brAfter = new RegExp('(' + EMOJIS_CLASS + ')\\s*((?:<[^>]+>\\s*)*)<br\\s*\\/?>', 'gu');
s = s.replace(brAfter, '$1$2 ');

console.log(s);
