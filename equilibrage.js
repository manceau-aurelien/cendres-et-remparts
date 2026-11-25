// node equilibrage.js [campagnes] [niveaux] : deux bots jouent des campagnes entières, chacun dans sa voie.
// On regarde le nombre de morts par adversaire, puis par duo de voies.
const S = require('./sim.js');
const N = +process.argv[2] || 20, NIV = +process.argv[3] || 9;
// 3e argument : réglages à essayer, ex. '{"base":1.2}'
if (process.argv[4]) Object.assign(S.R, JSON.parse(process.argv[4]));
const V = Object.keys(S.VOIES), duos = [];
for (let a = 0; a < 4; a++) for (let b = a; b < 4; b++) duos.push([V[a], V[b]]);
const stats = Array.from({ length: NIV + 1 }, () => ({ morts: 0, temps: 0, parties: 0, gagne: 0, age: 0, ageIA: 0, bloque: 0 }));
const parDuo = {};
for (let c = 0; c < N; c++) {
  const duo = duos[c % duos.length], cle = duo.join('+');
  const d = parDuo[cle] = parDuo[cle] || { n: 0, morts: 0, niveaux: 0 };
  d.n++;
  const talents = [{}, {}];
  let niveau = 1, essais = 0, g = c * 7919 + 1, h = c + 1;
  const hasard = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
  while (niveau <= NIV) {
    const p = S.creerPartie({ niveau, talents, graine: g++, bots: [true, true] });
    while (!p.fini && p.t < 1200) { p.pas(1 / 30); p.evts.length = 0; }
    for (const u of p.unites) if (!isFinite(u.pv) || !isFinite(u.x)) throw new Error('NaN');
    const s = stats[niveau];
    s.parties++; s.temps += p.t; s.age += p.camps[0].age; s.ageIA += p.camps[1].age;
    if (!p.fini) s.bloque++;
    for (let k = 0; k < (p.fini === 'victoire' ? 2 : 1); k++) [0, 1].forEach(i => {
      const t = S.autoTalent(talents[i], duo[i], hasard);
      talents[i][t] = (talents[i][t] || 0) + 1;
    });
    if (p.fini === 'victoire') { s.gagne++; niveau++; essais = 0; d.niveaux++; }
    else { s.morts++; d.morts++; if (++essais > 40) break; }
  }
}
console.log('niv | morts/victoire | durée moy | âge nous/IA | campagnes passées | sans fin');
for (let n = 1; n <= NIV; n++) {
  const s = stats[n]; if (!s.parties) break;
  console.log(n, '|', (s.morts / Math.max(1, s.gagne)).toFixed(1), '|', (s.temps / s.parties / 60).toFixed(1) + ' min', '|', (s.age / s.parties).toFixed(1), '/', (s.ageIA / s.parties).toFixed(1), '|', s.gagne + '/' + N, '|', s.bloque);
}
console.log('duo : morts par adversaire battu');
for (const k in parDuo) console.log(' ', k.padEnd(18), (parDuo[k].morts / Math.max(1, parDuo[k].niveaux)).toFixed(2), parDuo[k].niveaux < parDuo[k].n * NIV ? '(bloqué)' : '');
