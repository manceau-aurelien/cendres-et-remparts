// Moteur de « Cendres et Remparts » : aucune dépendance à l'affichage.
// Tout passe par partie.ordre(joueur, action) : c'est ce qui permettra le jeu en ligne.
(function (racine) {
  'use strict';

  const L = 1600;                 // largeur du champ de bataille
  const PORTE = [150, L - 150];   // x de la porte de chaque château
  const AGES = ['Bois', 'Fer', 'Vapeur', 'Éclair', 'Astres'];
  const COUT_AGE = [450, 900, 1600, 2600];
  const FORCE_AGE = 1.4;          // chaque âge multiplie PV et dégâts, y compris de l'existant
  const MAX_UNITES = [14, 14, 26];
  // Réglages d'équilibre (voir equilibrage.js)
  const R = { croissance: 1.13, revCroissance: 1.07, base: 1.15, revBase: 10.5, chateau: 1600, crepuscule: 210, palier: 60, rageIA: 0.2, siege: 1.5, usure: 0.8, cendres: 0.0012,
    force: { agressif: 1.22, defensif: 0.85, ruse: 1 } };

  const UNITES = {
    lancier:  { nom: 'Lancier',  cout: 30,  pv: 100, deg: 12, cd: 0.9, portee: 36,  vit: 55,  fort: 'cavalier', bonus: 1.8, chateau: 1 },
    archer:   { nom: 'Archer',   cout: 45,  pv: 55,  deg: 11, cd: 1.1, portee: 210, vit: 50,  fort: 'lancier',  bonus: 1.5, chateau: 0.6 },
    cavalier: { nom: 'Cavalier', cout: 70,  pv: 130, deg: 16, cd: 0.8, portee: 38,  vit: 110, fort: 'archer',   bonus: 2,   chateau: 1 },
    colosse:  { nom: 'Colosse',  cout: 140, pv: 420, deg: 26, cd: 1.6, portee: 44,  vit: 36,  fort: null,       bonus: 1,   chateau: 3 },
  };
  const DEFENSES = {
    baliste: { nom: 'Baliste', cout: 110, deg: 18, cd: 1.0, portee: 430, zone: 0,  max: 3 },
    mortier: { nom: 'Mortier', cout: 180, deg: 24, cd: 2.4, portee: 520, zone: 75, max: 3 },
  };
  const ACTIONS = ['lancier', 'archer', 'cavalier', 'colosse', 'assaut', 'baliste', 'mortier', 'barricade', 'mine', 'age'];

  // Renforts permanents : un niveau par choix ; chaque 5e niveau compte double.
  const RENFORTS = {
    lames:     { nom: 'Lames',      pas: 0.10, texte: 'Dégâts des soldats' },
    armures:   { nom: 'Armures',    pas: 0.10, texte: 'Vie des soldats' },
    remparts:  { nom: 'Remparts',   pas: 0.15, texte: 'Vie du château et des barricades' },
    artillerie:{ nom: 'Artillerie', pas: 0.15, texte: 'Dégâts des défenses' },
    filons:    { nom: 'Filons',     pas: 0.08, texte: 'Revenu en or' },
    coffres:   { nom: 'Coffres',    pas: 0.40, texte: 'Or de départ' },
    savoir:    { nom: 'Savoir',     pas: 0.08, texte: 'Âges moins chers' },
    butin:     { nom: 'Butin',      pas: 0.25, texte: 'Or gagné par ennemi vaincu' },
  };
  const ADVERSAIRES = [
    { nom: 'Ronce',    titre: 'la Meute',   style: 'agressif',  desc: 'Attaque sans relâche avec des troupes rapides.' },
    { nom: 'Granit',   titre: 'le Bastion', style: 'defensif',  desc: 'Se couvre de défenses, puis envoie des colosses.' },
    { nom: 'Vespérine',titre: 'l\'Énigme',  style: 'ruse',      desc: 'Recrute toujours ce qui contre vos troupes.' },
  ];
  const STYLES = {
    agressif: { partAge: 0.16, vague: 0.82, def: 0.08, mine: 0.10, poids: { lancier: 4, archer: 2, cavalier: 4, colosse: 1 }, taille: [2, 4], contre: 0.1 },
    defensif: { partAge: 0.26, vague: 0.55, def: 0.30, mine: 0.15, poids: { lancier: 2, archer: 4, cavalier: 1, colosse: 3 }, taille: [3, 6], contre: 0.1 },
    ruse:     { partAge: 0.22, vague: 0.68, def: 0.16, mine: 0.16, poids: { lancier: 3, archer: 3, cavalier: 3, colosse: 2 }, taille: [2, 5], contre: 0.75 },
    allie:    { partAge: 0.24, vague: 0.64, def: 0.18, mine: 0.18, poids: { lancier: 3, archer: 3, cavalier: 2, colosse: 2 }, taille: [2, 4], contre: 0.5 },
  };
  const CONTRE = { lancier: 'archer', archer: 'cavalier', cavalier: 'lancier', colosse: 'lancier' };

  function adversaire(niveau) {
    const a = ADVERSAIRES[(niveau - 1) % ADVERSAIRES.length];
    const tour = Math.floor((niveau - 1) / ADVERSAIRES.length);
    return Object.assign({}, a, { nom: a.nom + (tour ? ' ' + 'I'.repeat(Math.min(tour + 1, 3)) + (tour > 2 ? '+' + (tour - 2) : '') : '') });
  }
  const valeurRenfort = (cle, niv) => RENFORTS[cle].pas * (niv + Math.floor(niv / 5));

  function creerPartie(opt) {
    const niveau = opt.niveau || 1;
    const perm = {};
    for (const k in RENFORTS) perm[k] = valeurRenfort(k, (opt.renforts || {})[k] || 0);
    let graine = (opt.graine || 1) >>> 0;
    const hasard = () => { // mulberry32 : reproductible
      graine = (graine + 0x6D2B79F5) >>> 0;
      let t = graine;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const adv = adversaire(niveau);
    // au-delà du 11e adversaire la montée ralentit, pour que les renforts continuent de compter
    const rang = Math.min(niveau - 1, 10) + Math.max(0, niveau - 11) * 0.5;
    const forceAdv = R.base * R.force[adv.style] * Math.pow(R.croissance, rang);
    const revAdv = Math.pow(R.revCroissance, rang);

    const p = {
      niveau, adv, perm, t: 0, fini: null, id: 1,
      unites: [], tirs: [], evts: [],
      joueurs: [0, 1, 2].map(i => ({
        i, equipe: i === 2 ? 1 : 0, or: i === 2 ? 130 : Math.round(80 * (1 + perm.coffres)),
        mines: 0, def: { baliste: 0, mortier: 0 }, recharge: 0, appel: 0, tues: 0,
        ia: i === 2 ? adv.style : (opt.bots && opt.bots[i] ? 'allie' : null),
        pense: 0.5 + i * 0.2, but: null, file: [], attente: 0,
      })),
      camps: [0, 1].map(e => ({
        age: 0, fonds: 0, pv: 0, max: 0, cdTir: 0, cdDef: {}, assaut: 0, jauge: 0, touche: 0,
      })),
    };
    const baseChateau = e => R.chateau * (e === 0 ? 1 + perm.remparts : forceAdv);
    for (const e of [0, 1]) p.camps[e].pv = p.camps[e].max = baseChateau(e);

    // --- Forces -----------------------------------------------------------
    const ageMul = e => Math.pow(FORCE_AGE, p.camps[e].age);
    // Crépuscule : passé ce délai, les murs s'effritent et l'IA s'emballe ; aucune partie ne s'éternise.
    const nuit = () => Math.max(0, p.t - R.crepuscule) / R.palier;
    const rage = () => 1 + nuit() * R.rageIA;
    const siege = () => 1 + nuit() * R.siege;
    const usure = () => 1 / (1 + nuit() * R.usure);
    function multPv(e) { return ageMul(e) * (e === 0 ? 1 + perm.armures : forceAdv); }
    function multDeg(e) {
      return ageMul(e) * (e === 0 ? 1 + perm.lames : forceAdv * rage()) * (p.camps[e].assaut > 0 ? 1.5 : 1);
    }
    function multDef(e) { return usure() * ageMul(e) * (e === 0 ? 1 + perm.artillerie : forceAdv); }
    function pvBarricade(e) { return 480 * ageMul(e) * (e === 0 ? 1 + perm.remparts : forceAdv); }
    const revenu = j => j.equipe === 0
      ? (5 + 1.6 * j.mines) * (1 + perm.filons)
      : (R.revBase + 2.2 * j.mines) * revAdv * (1 + p.t / 60 * 0.05);

    const compte = (i, type) => p.unites.filter(u => u.prop === i && (!type ? u.type !== 'barricade' : u.type === type)).length;
    const barricade = i => p.unites.find(u => u.prop === i && u.type === 'barricade');
    function coutAge(e) {
      const c = COUT_AGE[p.camps[e].age];
      if (c === undefined) return null;
      return Math.round(e === 0 ? c / (1 + perm.savoir) : c);
    }
    function cout(i, a) {
      const j = p.joueurs[i];
      if (UNITES[a]) return UNITES[a].cout;
      if (DEFENSES[a]) return Math.round(DEFENSES[a].cout * Math.pow(1.6, j.def[a]));
      if (a === 'barricade') return 80;
      if (a === 'mine') return Math.round(90 * Math.pow(1.45, j.mines));
      if (a === 'age') {
        const c = coutAge(j.equipe);
        return c === null ? 0 : Math.min(50, c - p.camps[j.equipe].fonds);
      }
      return 0;
    }
    // '' si possible, sinon la raison
    function blocage(i, a) {
      const j = p.joueurs[i], c = p.camps[j.equipe];
      if (p.fini) return 'Terminé';
      if (UNITES[a]) {
        if (compte(i) >= MAX_UNITES[i]) return 'Armée pleine';
        if (j.recharge > 0) return '…';
      } else if (DEFENSES[a]) {
        if (j.def[a] >= DEFENSES[a].max * (i === 2 ? 1.34 : 1)) return 'Maximum';
      } else if (a === 'barricade') {
        const b = barricade(i);
        if (b && b.pv >= b.max * 0.98) return 'Intacte';
      } else if (a === 'mine') {
        if (j.mines >= 6) return 'Maximum';
      } else if (a === 'age') {
        if (coutAge(j.equipe) === null) return 'Âge final';
      } else if (a === 'assaut') {
        if (c.assaut > 0) return 'En cours';
        if (c.jauge < 100) return 'Jauge ' + Math.floor(c.jauge) + ' %';
        if (j.appel > 0) return 'Appel lancé !';
      }
      if (j.or < cout(i, a)) return 'Pas assez d\'or';
      return '';
    }
    function creerUnite(i, type) {
      const j = p.joueurs[i], e = j.equipe, b = UNITES[type];
      const pv = b.pv * multPv(e);
      p.unites.push({ id: p.id++, prop: i, equipe: e, type, x: PORTE[e], voie: hasard(), pv, max: pv, cd: 0.2 + hasard() * 0.3, frappe: 0, touche: 0 });
    }
    function ordre(i, a) {
      if (blocage(i, a)) { p.evts.push({ t: 'refus', i }); return false; }
      const j = p.joueurs[i], e = j.equipe, c = p.camps[e], prix = cout(i, a);
      j.or -= prix;
      if (UNITES[a]) { creerUnite(i, a); j.recharge = i === 2 ? 0.25 : 0.45; p.evts.push({ t: 'recrue', i }); }
      else if (DEFENSES[a]) { j.def[a]++; p.evts.push({ t: 'construit', i, x: PORTE[e] }); }
      else if (a === 'barricade') {
        const b = barricade(i), max = pvBarricade(e);
        if (b) { b.max = max; b.pv = max; }
        else {
          const d = i === 1 ? 290 : 220;
          p.unites.push({ id: p.id++, prop: i, equipe: e, type: 'barricade', x: e === 0 ? d : L - d, voie: 0.5, pv: max, max, cd: 9, frappe: 0, touche: 0 });
        }
        p.evts.push({ t: 'construit', i });
      } else if (a === 'mine') { j.mines++; p.evts.push({ t: 'construit', i }); }
      else if (a === 'age') {
        c.fonds += prix;
        p.evts.push({ t: 'verse', i });
        const but = coutAge(e);
        if (c.fonds >= but) monterAge(e);
      } else if (a === 'assaut') {
        j.appel = 5;
        p.evts.push({ t: 'appel', i });
        if (p.joueurs.filter(k => k.equipe === e).every(k => k.appel > 0)) {
          c.assaut = 10; c.jauge = 0;
          p.joueurs.forEach(k => { if (k.equipe === e) k.appel = 0; });
          p.evts.push({ t: 'assaut', e });
        }
      }
      return true;
    }
    function monterAge(e) {
      const c = p.camps[e];
      c.age++; c.fonds = 0;
      for (const u of p.unites) if (u.equipe === e) { u.pv *= FORCE_AGE; u.max *= FORCE_AGE; }
      const gain = c.max * 0.2;
      c.max += gain; c.pv = Math.min(c.max, c.pv + gain);
      p.evts.push({ t: 'age', e, age: c.age });
    }

    // --- Combat -----------------------------------------------------------
    function blesser(u, deg, par) {
      if (u.pv <= 0) return;
      u.pv -= deg; u.touche = 0.15;
      if (u.pv > 0) return;
      p.evts.push({ t: 'mort', x: u.x, voie: u.voie, type: u.type, e: u.equipe });
      if (u.type === 'barricade') return;
      const prix = UNITES[u.type].cout, vainq = 1 - u.equipe;
      p.camps[vainq].jauge = Math.min(100, p.camps[vainq].jauge + prix / 12);
      if (par !== undefined && par >= 0) p.joueurs[par].tues++;
      if (vainq === 0) { // butin partagé entre les deux joueurs
        const part = prix * 0.22 * (1 + perm.butin);
        p.joueurs[0].or += part; p.joueurs[1].or += part;
      } else p.joueurs[2].or += prix * 0.30;
    }
    function blesserChateau(e, deg) {
      const c = p.camps[e];
      c.pv -= deg * siege(); c.touche = 0.2;
      if (c.pv <= 0 && !p.fini) {
        c.pv = 0;
        p.fini = e === 1 ? 'victoire' : 'defaite';
        p.evts.push({ t: 'fin', r: p.fini });
      }
    }
    function tirer(genre, e, prop, x0, cible, deg, zone) {
      const dur = genre === 'mortier' ? 0.9 : 0.35;
      p.tirs.push({ genre, e, prop, x0, x1: cible ? cible.x : PORTE[1 - e], cible: cible ? cible.id : 0, deg, zone, t: 0, dur, voie: cible ? cible.voie : 0.5 });
    }
    function impact(s) {
      if (s.zone) {
        for (const u of p.unites) if (u.equipe !== s.e && Math.abs(u.x - s.x1) < s.zone) blesser(u, s.deg, s.prop);
        p.evts.push({ t: 'explosion', x: s.x1 });
      } else if (s.cible) {
        const u = p.unites.find(v => v.id === s.cible);
        if (u) blesser(u, s.deg, s.prop);
      } else blesserChateau(1 - s.e, s.deg);
    }
    function plusProche(e, x, portee) {
      let m = null, md = portee;
      for (const u of p.unites) {
        if (u.equipe === e || u.pv <= 0) continue;
        const d = Math.abs(u.x - x);
        if (d <= md) { md = d; m = u; }
      }
      return m;
    }
    function bougerUnite(u, dt) {
      u.frappe = Math.max(0, u.frappe - dt); u.touche = Math.max(0, u.touche - dt);
      if (u.type === 'barricade' || u.pv <= 0) return;
      const b = UNITES[u.type], e = u.equipe, sens = e === 0 ? 1 : -1;
      const furie = p.camps[e].assaut > 0;
      u.cd -= dt * (furie ? 1.25 : 1);
      const cible = plusProche(e, u.x, b.portee);
      const dChateau = Math.abs(PORTE[1 - e] - u.x);
      if (cible || dChateau <= b.portee) {
        if (u.cd <= 0) {
          u.cd = b.cd; u.frappe = 0.25;
          let deg = b.deg * multDeg(e);
          if (cible) {
            if (cible.type === b.fort) deg *= b.bonus;
            if (cible.type === 'barricade' && u.type === 'colosse') deg *= 2;
            if (u.type === 'archer') tirer('fleche', e, u.prop, u.x, cible, deg, 0);
            else { blesser(cible, deg, u.prop); p.evts.push({ t: 'coup', x: u.x }); }
          } else if (u.type === 'archer') tirer('fleche', e, u.prop, u.x, null, deg * b.chateau, 0);
          else { blesserChateau(1 - e, deg * b.chateau); p.evts.push({ t: 'coup', x: u.x }); }
        }
      } else u.x += sens * b.vit * (furie ? 1.3 : 1) * dt;
    }
    function defendre(e, dt) {
      const c = p.camps[e];
      c.cdTir -= dt;
      if (c.cdTir <= 0) { // les archers du château tirent toujours un peu
        const u = plusProche(e, PORTE[e], 280);
        if (u) { c.cdTir = 1.2; tirer('fleche', e, -1, PORTE[e], u, 9 * multDef(e), 0); }
      }
      for (const j of p.joueurs) if (j.equipe === e) for (const d in DEFENSES) for (let n = 0; n < j.def[d]; n++) {
        const k = j.i + d + n, D = DEFENSES[d];
        c.cdDef[k] = (c.cdDef[k] === undefined ? n * 0.3 : c.cdDef[k]) - dt;
        if (c.cdDef[k] > 0) continue;
        const u = plusProche(e, PORTE[e], D.portee);
        if (u) { c.cdDef[k] = D.cd; tirer(d, e, j.i, PORTE[e], u, D.deg * multDef(e), D.zone); }
      }
    }

    // --- Intelligence artificielle ----------------------------------------
    function tirage(poids) {
      let s = 0; for (const k in poids) s += poids[k];
      let r = hasard() * s;
      for (const k in poids) { r -= poids[k]; if (r <= 0) return k; }
      return Object.keys(poids)[0];
    }
    function choisirUnite(j, S) {
      if (hasard() < S.contre) {
        const n = {}; let m = null;
        for (const u of p.unites) if (u.equipe !== j.equipe && UNITES[u.type]) {
          n[u.type] = (n[u.type] || 0) + UNITES[u.type].cout;
          if (!m || n[u.type] > n[m]) m = u.type;
        }
        if (m) return CONTRE[m];
      }
      return tirage(S.poids);
    }
    function nouveauBut(j, S) {
      const c = { vague: S.vague, def: S.def, mine: S.mine * (j.mines < 2 ? 2 : j.mines < 5 ? 0.8 : 0) };
      const g = tirage(c);
      if (g === 'mine') return { a: 'mine' };
      if (g === 'def') {
        const a = tirage({ baliste: 4, mortier: 3, barricade: 2 });
        if (!['Maximum', 'Intacte'].includes(blocage(j.i, a))) return { a };
      }
      const n = S.taille[0] + Math.floor(hasard() * (S.taille[1] - S.taille[0] + 1)), liste = [];
      for (let k = 0; k < n; k++) liste.push(choisirUnite(j, S));
      // les troupes solides partent devant
      liste.sort((a, b) => UNITES[b].pv - UNITES[a].pv);
      return { vague: liste, prix: liste.reduce((s, t) => s + UNITES[t].cout, 0) };
    }
    function reflechir(j, dt) {
      const S = STYLES[j.ia], e = j.equipe;
      j.pense -= dt; j.attente += dt;
      if (j.ia === 'allie' && j.appel <= 0 && !blocage(j.i, 'assaut')) {
        const autre = p.joueurs[1 - j.i];
        if (autre.appel > 0 || autre.ia) ordre(j.i, 'assaut');
      }
      if (j.file.length) {
        if (j.recharge <= 0 && !blocage(j.i, j.file[0])) ordre(j.i, j.file.shift());
        else if (j.or < 30) j.file = [];
      }
      if (j.pense > 0) return;
      j.pense = 0.5;
      if (j.ia !== 'allie' && !blocage(j.i, 'assaut') && compte(j.i) > 6) ordre(j.i, 'assaut');
      // part de revenu mise de côté pour l'âge
      if (coutAge(e) !== null) {
        j.epargne = (j.epargne || 0) + revenu(j) * 0.5 * S.partAge;
        if (j.epargne >= 50 && j.or >= 50) { if (ordre(j.i, 'age')) j.epargne -= 50; }
      }
      // danger : réagir tout de suite
      let danger = 0, nous = 0;
      for (const u of p.unites) {
        const d = Math.abs(u.x - PORTE[e]);
        if (d < 420) { if (u.equipe === e) nous++; else danger++; }
      }
      if (danger > nous && !j.file.length) {
        if (!blocage(j.i, 'barricade') && hasard() < 0.25) ordre(j.i, 'barricade');
        else { const t = choisirUnite(j, S); if (!blocage(j.i, t)) ordre(j.i, t); else if (!blocage(j.i, 'lancier')) ordre(j.i, 'lancier'); }
        return;
      }
      if (j.file.length) return;
      if (!j.but || j.attente > 25) { j.but = nouveauBut(j, S); j.attente = 0; }
      if (j.but.vague) {
        if (compte(j.i) + j.but.vague.length > MAX_UNITES[j.i]) { j.but = null; return; }
        if (j.or >= j.but.prix) { j.file = j.but.vague; j.but = null; }
      } else if (!blocage(j.i, j.but.a)) { ordre(j.i, j.but.a); j.but = null; }
      else if (['Maximum', 'Intacte'].includes(blocage(j.i, j.but.a))) j.but = null;
    }

    // --- Pas de temps -----------------------------------------------------
    function pas(dt) {
      if (p.fini) return;
      p.t += dt;
      for (const j of p.joueurs) {
        j.or += revenu(j) * dt;
        j.recharge = Math.max(0, j.recharge - dt);
        j.appel = Math.max(0, j.appel - dt);
        if (j.ia) reflechir(j, dt);
      }
      for (const c of p.camps) { c.assaut = Math.max(0, c.assaut - dt); c.touche = Math.max(0, c.touche - dt); }
      for (const u of p.unites) bougerUnite(u, dt);
      defendre(0, dt); defendre(1, dt);
      // la pluie de cendres ronge les deux châteaux : le plus abîmé tombe le premier
      if (nuit() > 0 && !p.fini) {
        const [a, b] = p.camps;
        for (const c of p.camps) c.pv -= c.max * nuit() * R.cendres * dt;
        if (a.pv <= 0 || b.pv <= 0) {
          p.fini = a.pv / a.max > b.pv / b.max ? 'victoire' : 'defaite';
          p.evts.push({ t: 'fin', r: p.fini });
        }
      }
      for (const s of p.tirs) { s.t += dt; if (s.t >= s.dur) impact(s); }
      p.tirs = p.tirs.filter(s => s.t < s.dur);
      p.unites = p.unites.filter(u => u.pv > 0);
    }
    // --- Jeu en ligne : photo compacte envoyée par l'hôte, relue par l'invité ---
    const TYPES = ['lancier', 'archer', 'cavalier', 'colosse', 'barricade'], GENRES = ['fleche', 'baliste', 'mortier'];
    const ar = v => Math.round(v * 100) / 100;
    function photo() {
      return {
        t: ar(p.t), f: p.fini,
        c: p.camps.map(c => [c.age, c.fonds, c.pv, c.max, c.assaut, c.jauge, c.touche].map(ar)),
        j: p.joueurs.map(j => [j.or, j.mines, j.def.baliste, j.def.mortier, j.recharge, j.appel].map(ar)),
        u: p.unites.map(u => [u.id, u.prop, TYPES.indexOf(u.type), ar(u.x), ar(u.voie), ar(u.pv), ar(u.max), ar(u.frappe), ar(u.touche)]),
        s: p.tirs.map(s => [GENRES.indexOf(s.genre), s.e, ar(s.x0), ar(s.x1), ar(s.t), s.dur, ar(s.voie)]),
      };
    }
    function charger(f) {
      const nb = l => { if (!l.every(v => typeof v === 'number' && isFinite(v))) throw new Error('photo illisible'); return l; };
      p.t = nb([f.t])[0]; p.fini = f.f === 'victoire' || f.f === 'defaite' ? f.f : null;
      p.camps.forEach((c, i) => { const l = nb(f.c[i]); [c.age, c.fonds, c.pv, c.max, c.assaut, c.jauge, c.touche] = l; c.age = Math.max(0, Math.min(AGES.length - 1, c.age | 0)); });
      p.joueurs.forEach((j, i) => { [j.or, j.mines, j.def.baliste, j.def.mortier, j.recharge, j.appel] = nb(f.j[i]); });
      const avant = new Map(p.unites.map(u => [u.id, u]));
      p.unites = f.u.filter(l => nb(l) && TYPES[l[2]] && p.joueurs[l[1]]).map(l => {
        const v = avant.get(l[0]), x = v && Math.abs(v.x - l[3]) < 120 ? v.x : l[3];
        return { id: l[0], prop: l[1], equipe: p.joueurs[l[1]].equipe, type: TYPES[l[2]], x, vise: l[3], voie: l[4], pv: l[5], max: l[6], frappe: l[7], touche: l[8], cd: 9 };
      });
      p.tirs = f.s.filter(l => nb(l) && GENRES[l[0]]).map(l => ({ genre: GENRES[l[0]], e: l[1] ? 1 : 0, x0: l[2], x1: l[3], t: l[4], dur: l[5], voie: l[6] }));
    }
    function lisser(dt) { // entre deux photos, l'invité fait glisser les soldats et voler les flèches
      for (const u of p.unites) {
        u.x += (u.vise - u.x) * Math.min(1, dt * 12);
        u.frappe = Math.max(0, u.frappe - dt); u.touche = Math.max(0, u.touche - dt);
      }
      for (const s of p.tirs) s.t += dt;
      p.tirs = p.tirs.filter(s => s.t < s.dur);
    }
    function confier(i, ia) { p.joueurs[i].ia = ia ? 'allie' : null; p.joueurs[i].file = []; p.joueurs[i].but = null; }
    return Object.assign(p, { photo, charger, lisser, confier, pas, ordre, cout, blocage, coutAge, revenu, compte, nuit });
  }

  const api = { L, PORTE, AGES, UNITES, DEFENSES, ACTIONS, RENFORTS, MAX_UNITES, adversaire, valeurRenfort, creerPartie, R };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Sim = api;
})(typeof window !== 'undefined' ? window : globalThis);
