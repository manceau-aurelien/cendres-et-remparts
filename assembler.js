// node assembler.js : réunit tout dans un seul fichier, à envoyer à un ami.
const fs = require('fs'), path = require('path');
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const page = lire('index.html').replace(/<script src="([^"]+)"><\/script>/g, (_, f) => '<script>\n' + lire(f).replace(/<\/script/gi, '<\\/script') + '</script>');
fs.writeFileSync(path.join(__dirname, 'Cendres-et-Remparts.html'), page);
console.log('Cendres-et-Remparts.html', Math.round(page.length / 1024) + ' Ko');
