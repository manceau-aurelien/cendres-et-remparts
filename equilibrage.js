// node equilibrage.js [campagnes] [niveaux] : deux bots jouent des campagnes entières
// et on regarde combien de morts il faut pour battre chaque adversaire.
const S = require('./sim.js');
const N = +process.argv[2] || 12, NIV = +process.argv[3] || 9;
// 3e argument : réglages à essayer, ex. '{"base":1.2}'
if (process.argv[4]) Object.assign(S.R, JSON.parse(process.argv[4]));
const cles = Object.keys(S.RENFORTS);
const stats = Array.from({ length: NIV + 1 }, () => ({ morts: 0, temps: 0, parties: 0, gagne: 0, age: 0, ageIA: 0, bloque: 0 }));
for (let c = 0; c < N; c++) {
  const renforts = {}; let niveau = 1, essais = 0;
  let g = c * 7919 + 1;
  while (niveau <= NIV) {
    const p = S.creerPartie({ niveau, renforts, graine: g++, bots: [true, true] });
    while (!p.fini && p.t < 1200) { p.pas(1 / 30); p.evts.length = 0; }
    for (const u of p.unites) if (!isFinite(u.pv) || !isFinite(u.x)) throw new Error('NaN');
    const s = stats[niveau];
    s.parties++; s.temps += p.t; s.age += p.camps[0].age; s.ageIA += p.camps[1].age;
    if (!p.fini) s.bloque++;
    const nb = p.fini === 'victoire' ? 4 : 2;
    for (let k = 0; k < nb; k++) { const r = cles[(g * 31 + k * 17 + c + s.parties) % cles.length]; renforts[r] = (renforts[r] || 0) + 1; }
    if (p.fini === 'victoire') { s.gagne++; niveau++; essais = 0; }
    else { s.morts++; if (++essais > 40) break; }
  }
}
console.log('niv | morts/victoire | durée moy | âge nous/IA | campagnes passées | sans fin');
for (let n = 1; n <= NIV; n++) {
  const s = stats[n]; if (!s.parties) break;
  console.log(n, '|', (s.morts / Math.max(1, s.gagne)).toFixed(1), '|', (s.temps / s.parties / 60).toFixed(1) + ' min', '|', (s.age / s.parties).toFixed(1), '/', (s.ageIA / s.parties).toFixed(1), '|', s.gagne + '/' + N, '|', s.bloque);
}
