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
  const R = { croissance: 1.19, revCroissance: 1.07, base: 1.13, revBase: 10.5, chateau: 1600, crepuscule: 210, palier: 60, rageIA: 0.2, siege: 1.5, usure: 0.8, cendres: 0.0012,
    niveauSpe: 4, exp: 0.04,
    force: { agressif: 1.22, defensif: 0.85, ruse: 1 } };

  const UNITES = {
    lancier:  { nom: 'Lancier',  cout: 30,  pv: 100, deg: 12, cd: 0.9, portee: 36,  vit: 55,  fort: 'cavalier', bonus: 1.8, chateau: 1 },
    archer:   { nom: 'Archer',   cout: 45,  pv: 55,  deg: 11, cd: 1.1, portee: 210, vit: 50,  fort: 'lancier',  bonus: 1.5, chateau: 0.6 },
    cavalier: { nom: 'Cavalier', cout: 70,  pv: 130, deg: 16, cd: 0.8, portee: 38,  vit: 110, fort: 'archer',   bonus: 2,   chateau: 1 },
    colosse:  { nom: 'Colosse',  cout: 140, pv: 420, deg: 26, cd: 1.6, portee: 44,  vit: 36,  fort: null,       bonus: 1,   chateau: 3 },
    // unités de spécialité
    etendard:   { nom: 'Étendard',   cout: 90,  pv: 170, deg: 9,  cd: 1.0, portee: 38,  vit: 52, fort: null, bonus: 1, chateau: 1, spe: 'guerre' },
    garde:      { nom: 'Garde-mur',  cout: 80,  pv: 340, deg: 12, cd: 1.0, portee: 36,  vit: 46, fort: null, bonus: 1, chateau: 1.5, spe: 'rempart' },
    mercenaire: { nom: 'Mercenaire', cout: 130, pv: 210, deg: 27, cd: 0.9, portee: 38,  vit: 72, fort: null, bonus: 1, chateau: 1.2, spe: 'or' },
    alchimiste: { nom: 'Alchimiste', cout: 100, pv: 70,  deg: 13, cd: 1.6, portee: 190, vit: 48, fort: null, bonus: 1, chateau: 1, spe: 'ruse', zone: 60 },
    champion:   { nom: 'Champion',   cout: 150, pv: 850, deg: 38, cd: 1.0, portee: 46,  vit: 50, fort: null, bonus: 1, chateau: 1.5, spe: 'guerre' },
  };
  const DEFENSES = {
    baliste: { nom: 'Baliste', cout: 110, deg: 18, cd: 1.0, portee: 430, zone: 0,  max: 3 },
    mortier: { nom: 'Mortier', cout: 180, deg: 24, cd: 2.4, portee: 520, zone: 75, max: 3 },
  };
  const ACTIONS = ['lancier', 'archer', 'cavalier', 'colosse', 'special', 'assaut', 'baliste', 'mortier', 'barricade', 'mine', 'age', 'pouvoir'];

  // Talents permanents, propres à chaque joueur. Le rang 3 est la spécialité : une seule par joueur.
  const VOIES = {
    guerre:  { nom: 'Guerre',  titre: 'Chef de guerre', unite: 'etendard',   pouvoir: 'Champion',  cd: 80 },
    rempart: { nom: 'Rempart', titre: 'Bâtisseur',      unite: 'garde',      pouvoir: 'Dôme',      cd: 60 },
    or:      { nom: 'Or',      titre: 'Intendant',      unite: 'mercenaire', pouvoir: 'Manne',     cd: 55 },
    ruse:    { nom: 'Ruse',    titre: 'Stratège',       unite: 'alchimiste', pouvoir: 'Brume',     cd: 60 },
  };
  const SEUILS = [0, 0, 2, 4, 7]; // points à avoir dans la voie, par rang
  const TALENTS = {
    lames:      { voie: 'guerre',  rang: 1, pas: 0.10, nom: 'Lames',       texte: 'Dégâts de vos soldats' },
    pierre:     { voie: 'rempart', rang: 1, pas: 0.2, nom: 'Pierre',      texte: 'Vie du château commun ; vos soldats : vie +6 %' },
    filons:     { voie: 'or',      rang: 1, pas: 0.18, nom: 'Filons',      texte: 'Votre revenu en or' },
    butin:      { voie: 'ruse',    rang: 1, pas: 0.75, nom: 'Butin',       texte: 'Votre or par ennemi vaincu' },
    armures:    { voie: 'guerre',  rang: 1, pas: 0.10, nom: 'Armures',     texte: 'Vie de vos soldats' },
    artillerie: { voie: 'rempart', rang: 1, pas: 0.45, nom: 'Artillerie',  texte: 'Dégâts de vos balistes et mortiers' },
    coffres:    { voie: 'or',      rang: 1, pas: 0.8, nom: 'Coffres',     texte: 'Votre or de départ' },
    ferveur:    { voie: 'ruse',    rang: 1, pas: 0.35, nom: 'Ferveur',     texte: 'Remplissage de la jauge d\'assaut' },
    elan:       { voie: 'guerre',  rang: 2, pas: 0.07, max: 3, nom: 'Élan',        texte: 'Vitesse et cadence de vos soldats' },
    contreforts:{ voie: 'rempart', rang: 2, pas: 1,    max: 3, nom: 'Contreforts', texte: 'Balistes et mortiers en plus au maximum', brut: true },
    mecene:     { voie: 'or',      rang: 2, pas: 0.22, max: 3, nom: 'Mécène',      texte: 'Valeur de vos versements pour l\'âge' },
    piege:      { voie: 'ruse',    rang: 2, pas: 0.4, max: 3, nom: 'Contre-pied', texte: 'Bonus contre les troupes que vous contrez' },
    speGuerre:  { voie: 'guerre',  rang: 3, max: 1, nom: 'Chef de guerre', texte: 'Étendard (soldats proches +20 %) et Champion' },
    speRempart: { voie: 'rempart', rang: 3, max: 1, nom: 'Bâtisseur',      texte: 'Garde-mur (résiste aux tirs) et Dôme protecteur' },
    speOr:      { voie: 'or',      rang: 3, max: 1, nom: 'Intendant',      texte: 'Mercenaire (or par victime) et Manne pour deux' },
    speRuse:    { voie: 'ruse',    rang: 3, max: 1, nom: 'Stratège',       texte: 'Alchimiste (zone, ralentit) et Brume' },
    legende:    { voie: 'guerre',  rang: 4, pas: 0.2, nom: 'Légende',       texte: 'Force du Champion, vos soldats +6 %' },
    bastion:    { voie: 'rempart', rang: 4, pas: 0.15, nom: 'Bastion',       texte: 'Durée du Dôme ; défenses, château, soldats +6 %' },
    empire:     { voie: 'or',      rang: 4, pas: 0.25, nom: 'Empire',        texte: 'Or de la Manne, revenu +6 %' },
    tempete:    { voie: 'ruse',    rang: 4, pas: 0.12, nom: 'Tempête',       texte: 'Durée de la Brume, vos soldats +6 % de dégâts' },
  };
  const CLES = Object.keys(TALENTS); // rangées de 4 : une colonne par voie
  const SPE = { guerre: 'speGuerre', rempart: 'speRempart', or: 'speOr', ruse: 'speRuse' };
  const ALLIANCES = {
    'guerre+rempart': { nom: 'Marteau et enclume', texte: 'soldats : vie +15 %' },
    'guerre+or':      { nom: 'Solde de guerre',    texte: 'soldats 10 % moins chers' },
    'guerre+ruse':    { nom: 'Charge surprise',    texte: 'assaut commun : +4 secondes' },
    'or+rempart':     { nom: 'Grand chantier',     texte: 'défenses 35 % moins chères' },
    'rempart+ruse':   { nom: 'Meurtrières',        texte: 'défenses : dégâts +40 %' },
    'or+ruse':        { nom: 'Contrebande',        texte: 'âges 12 % moins chers' },
    meme:             { nom: 'Même vocation',      texte: 'pouvoirs rechargés 25 % plus vite' },
  };
  const points = (tal, voie) => CLES.reduce((n, k) => n + (TALENTS[k].voie === voie || !voie ? tal[k] || 0 : 0), 0);
  const specialite = tal => Object.keys(SPE).find(v => tal[SPE[v]]) || null;
  function voieDominante(tal) {
    let m = null, mp = 0;
    for (const v in VOIES) { const n = points(tal, v); if (n > mp) { mp = n; m = v; } }
    return m;
  }
  // '' si le joueur peut prendre ce talent, sinon la raison
  function blocageTalent(tal, cle) {
    const T = TALENTS[cle];
    if (T.max && (tal[cle] || 0) >= T.max) return 'Maximum';
    const manque = SEUILS[T.rang] - points(tal, T.voie);
    if (manque > 0) return 'Encore ' + manque + ' point' + (manque > 1 ? 's' : '') + ' en ' + VOIES[T.voie].nom;
    const sp = specialite(tal);
    if (T.rang === 3 && sp) return 'Déjà ' + VOIES[sp].titre;
    if (T.rang === 4 && sp !== T.voie) return 'Réservé : ' + VOIES[T.voie].titre;
    return '';
  }
  function alliance(a, b) {
    const x = specialite(a), y = specialite(b);
    if (!x || !y) return null;
    return x === y ? 'meme' : [x, y].sort().join('+');
  }
  // choix automatique (allié IA et essais d'équilibre)
  function autoTalent(tal, voie, hasard) {
    const ok = CLES.filter(k => !blocageTalent(tal, k));
    const dedans = ok.filter(k => TALENTS[k].voie === voie);
    const sp = dedans.find(k => TALENTS[k].rang === 3);
    if (sp) return sp;
    const liste = hasard() < 0.8 && dedans.length ? dedans : ok.filter(k => TALENTS[k].rang === 1);
    return liste[Math.floor(hasard() * liste.length)];
  }
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
  const CONTRE = { lancier: 'archer', archer: 'cavalier', cavalier: 'lancier', colosse: 'lancier', etendard: 'archer', garde: 'lancier', mercenaire: 'lancier', alchimiste: 'cavalier', champion: 'lancier' };
  const VOIE_IA = { agressif: 'guerre', defensif: 'rempart', ruse: 'ruse' };

  function adversaire(niveau) {
    const a = ADVERSAIRES[(niveau - 1) % ADVERSAIRES.length];
    const tour = Math.floor((niveau - 1) / ADVERSAIRES.length);
    return Object.assign({}, a, { nom: a.nom + (tour ? ' ' + 'I'.repeat(Math.min(tour + 1, 3)) + (tour > 2 ? '+' + (tour - 2) : '') : '') });
  }

  function creerPartie(opt) {
    const niveau = opt.niveau || 1;
    const talents = [0, 1].map(i => Object.assign({}, (opt.talents || [])[i]));
    // à partir d'un certain rang, l'adversaire a lui aussi sa spécialité
    talents.push(niveau >= R.niveauSpe ? { [SPE[VOIE_IA[adversaire(niveau).style]]]: 1 } : {});
    const tal = (i, k) => (talents[i][k] || 0) * (TALENTS[k].pas || 1);
    const spes = talents.map(specialite), allie = alliance(talents[0], talents[1]);
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
      niveau, adv, talents, spes, allie, t: 0, fini: null, id: 1,
      unites: [], tirs: [], evts: [],
      joueurs: [0, 1, 2].map(i => ({
        i, equipe: i === 2 ? 1 : 0, or: i === 2 ? 130 : Math.round(80 * (1 + tal(i, 'coffres'))),
        mines: 0, def: { baliste: 0, mortier: 0 }, recharge: 0, appel: 0, tues: 0, cdPouv: 20,
        ia: i === 2 ? adv.style : (opt.bots && opt.bots[i] ? 'allie' : null),
        pense: 0.5 + i * 0.2, but: null, file: [], attente: 0,
      })),
      camps: [0, 1].map(e => ({
        age: 0, fonds: 0, pv: 0, max: 0, cdTir: 0, cdDef: {}, assaut: 0, jauge: 0, touche: 0, dome: 0, brume: 0,
      })),
    };
    const baseChateau = e => R.chateau * (e === 0 ? 1 + tal(0, 'pierre') + tal(1, 'pierre') + 0.06 * ((talents[0].bastion || 0) + (talents[1].bastion || 0)) : forceAdv);
    for (const e of [0, 1]) p.camps[e].pv = p.camps[e].max = baseChateau(e);

    // --- Forces -----------------------------------------------------------
    const ageMul = e => Math.pow(FORCE_AGE, p.camps[e].age);
    // Crépuscule : passé ce délai, les murs s'effritent et l'IA s'emballe ; aucune partie ne s'éternise.
    const nuit = () => Math.max(0, p.t - R.crepuscule) / R.palier;
    const rage = () => 1 + nuit() * R.rageIA;
    const siege = () => 1 + nuit() * R.siege;
    const usure = () => 1 / (1 + nuit() * R.usure);
    // expérience : chaque point, dans n'importe quelle voie, endurcit un peu les soldats du joueur
    const exp = talents.map(t => R.exp * points(t));
    const six = (i, k) => 0.06 * (talents[i][k] || 0);
    function multPv(i) {
      const e = i === 2 ? 1 : 0;
      return ageMul(e) * (e ? forceAdv : (1 + exp[i] + tal(i, 'armures') + 0.06 * (talents[i].pierre || 0) + six(i, 'bastion') + six(i, 'legende')) * (allie === 'guerre+rempart' ? 1.15 : 1));
    }
    function multDeg(i) {
      const e = i === 2 ? 1 : 0;
      return ageMul(e) * (e ? forceAdv * rage() : 1 + exp[i] + tal(i, 'lames') + six(i, 'legende') + six(i, 'tempete')) * (p.camps[e].assaut > 0 ? 1.5 : 1);
    }
    function multDef(i, e) { // i = -1 : archers du château
      const art = k => tal(k, 'artillerie') + six(k, 'bastion');
      const n = e ? forceAdv : (1 + (i < 0 ? (art(0) + art(1)) / 2 : art(i))) * (allie === 'rempart+ruse' ? 1.4 : 1);
      return usure() * ageMul(e) * n;
    }
    const pvBarricade = i => 480 * ageMul(i === 2 ? 1 : 0) * (i === 2 ? forceAdv : 1 + 2 * tal(i, 'pierre'));
    const cadence = i => 1 + tal(i, 'elan');
    const maxDef = (i, d) => DEFENSES[d].max + (i === 2 ? 1 : tal(i, 'contreforts'));
    const revenu = j => j.equipe === 0
      ? (5 + 1.6 * j.mines) * (1 + tal(j.i, 'filons') + six(j.i, 'empire'))
      : (R.revBase + 2.2 * j.mines) * revAdv * (1 + p.t / 60 * 0.05);

    const compte = (i, type) => p.unites.filter(u => u.prop === i && (!type ? u.type !== 'barricade' : u.type === type)).length;
    const barricade = i => p.unites.find(u => u.prop === i && u.type === 'barricade');
    function coutAge(e) {
      const c = COUT_AGE[p.camps[e].age];
      if (c === undefined) return null;
      return Math.round(e === 0 && allie === 'or+ruse' ? c * 0.88 : c);
    }
    function cout(i, a) {
      const j = p.joueurs[i];
      if (a === 'special') a = spes[i] ? VOIES[spes[i]].unite : a;
      if (UNITES[a]) return Math.round(UNITES[a].cout * (i < 2 && allie === 'guerre+or' ? 0.9 : 1));
      if (DEFENSES[a]) return Math.round(DEFENSES[a].cout * Math.pow(1.6, j.def[a]) * (i < 2 && allie === 'or+rempart' ? 0.65 : 1));
      if (a === 'barricade') return 80;
      if (a === 'mine') return Math.round(90 * Math.pow(1.45, j.mines));
      if (a === 'age') {
        const c = coutAge(j.equipe);
        return c === null ? 0 : Math.max(1, Math.min(50, Math.ceil((c - p.camps[j.equipe].fonds) / (1 + tal(i, 'mecene')))));
      }
      return 0;
    }
    // '' si possible, sinon la raison
    function blocage(i, a) {
      const j = p.joueurs[i], c = p.camps[j.equipe];
      if (p.fini) return 'Terminé';
      if ((a === 'special' || a === 'pouvoir') && !spes[i]) return 'Spécialité';
      if (a === 'special') a = VOIES[spes[i]].unite;
      if (a === 'pouvoir') {
        if (j.cdPouv > 0) return Math.ceil(j.cdPouv) + ' s';
        if (spes[i] === 'guerre' && compte(i, 'champion')) return 'Déjà là';
      }
      if (UNITES[a]) {
        if (UNITES[a].spe && UNITES[a].spe !== spes[i]) return 'Spécialité';
        if (compte(i) >= MAX_UNITES[i]) return 'Armée pleine';
        if (j.recharge > 0) return '…';
      } else if (DEFENSES[a]) {
        if (j.def[a] >= maxDef(i, a)) return 'Maximum';
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
      const pv = b.pv * multPv(i) * (type === 'champion' ? 1 + tal(i, 'legende') : 1);
      p.unites.push({ id: p.id++, prop: i, equipe: e, type, x: PORTE[e], voie: hasard(), pv, max: pv, cd: 0.2 + hasard() * 0.3, frappe: 0, touche: 0, lent: 0 });
    }
    function lancerPouvoir(i) {
      const j = p.joueurs[i], e = j.equipe, c = p.camps[e], v = spes[i];
      j.cdPouv = VOIES[v].cd * (i < 2 && allie === 'meme' ? 0.75 : 1);
      if (v === 'guerre') creerUnite(i, 'champion');
      else if (v === 'rempart') { c.dome = 8 * (1 + tal(i, 'bastion')); c.pv = Math.min(c.max, c.pv + c.max * 0.12); }
      else if (v === 'or') {
        const don = (60 + 14 * revenu(j)) * (1 + tal(i, 'empire'));
        for (const k of p.joueurs) if (k.equipe === e) k.or += don;
      } else p.camps[1 - e].brume = 8 * (1 + tal(i, 'tempete'));
      p.evts.push({ t: 'pouvoir', i, v });
    }
    function ordre(i, a) {
      if (!ACTIONS.includes(a) && !UNITES[a]) return false;
      if (a === 'champion' || blocage(i, a)) { p.evts.push({ t: 'refus', i }); return false; }
      const j = p.joueurs[i], e = j.equipe, c = p.camps[e], prix = cout(i, a);
      j.or -= prix;
      if (a === 'special') a = VOIES[spes[i]].unite;
      if (a === 'pouvoir') lancerPouvoir(i);
      else if (UNITES[a]) { creerUnite(i, a); j.recharge = i === 2 ? 0.25 : 0.45; p.evts.push({ t: 'recrue', i }); }
      else if (DEFENSES[a]) { j.def[a]++; p.evts.push({ t: 'construit', i, x: PORTE[e] }); }
      else if (a === 'barricade') {
        const b = barricade(i), max = pvBarricade(i);
        if (b) { b.max = max; b.pv = max; }
        else {
          const d = i === 1 ? 290 : 220;
          p.unites.push({ id: p.id++, prop: i, equipe: e, type: 'barricade', x: e === 0 ? d : L - d, voie: 0.5, pv: max, max, cd: 9, frappe: 0, touche: 0 });
        }
        p.evts.push({ t: 'construit', i });
      } else if (a === 'mine') { j.mines++; p.evts.push({ t: 'construit', i }); }
      else if (a === 'age') {
        c.fonds += prix * (1 + tal(i, 'mecene'));
        p.evts.push({ t: 'verse', i });
        const but = coutAge(e);
        if (c.fonds >= but) monterAge(e);
      } else if (a === 'assaut') {
        j.appel = 5;
        p.evts.push({ t: 'appel', i });
        if (p.joueurs.filter(k => k.equipe === e).every(k => k.appel > 0)) {
          c.assaut = e === 0 && allie === 'guerre+ruse' ? 14 : 10; c.jauge = 0;
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
    const abrite = (e, x) => p.camps[e].dome > 0 && Math.abs(x - PORTE[e]) < 350;
    function blesser(u, deg, par, tir) {
      if (u.pv <= 0 || abrite(u.equipe, u.x)) return;
      if (tir && u.type === 'garde') deg *= 0.4;
      u.pv -= deg; u.touche = 0.15;
      if (u.pv > 0) return;
      p.evts.push({ t: 'mort', x: u.x, voie: u.voie, type: u.type, e: u.equipe });
      if (u.type === 'barricade') return;
      const prix = UNITES[u.type].cout, vainq = 1 - u.equipe;
      p.camps[vainq].jauge = Math.min(100, p.camps[vainq].jauge + prix / 12 * (vainq === 0 ? 1 + tal(0, 'ferveur') + tal(1, 'ferveur') : 1));
      if (par !== undefined && par >= 0) p.joueurs[par].tues++;
      if (tir === 'merc') for (const k of p.joueurs) if (k.equipe === vainq) k.or += 8;
      if (vainq === 0) { // butin partagé entre les deux joueurs
        for (const k of [0, 1]) p.joueurs[k].or += prix * 0.22 * (1 + tal(k, 'butin'));
      } else p.joueurs[2].or += prix * 0.30;
    }
    function blesserChateau(e, deg) {
      const c = p.camps[e];
      if (c.dome > 0) return;
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
        for (const u of p.unites) if (u.equipe !== s.e && Math.abs(u.x - s.x1) < s.zone) {
          blesser(u, s.deg, s.prop, 'tir');
          if (s.genre === 'fiole') u.lent = 2;
        }
        if (!s.cible) blesserChateau(1 - s.e, s.deg);
        p.evts.push({ t: s.genre === 'fiole' ? 'fiole' : 'explosion', x: s.x1 });
      } else if (s.cible) {
        const u = p.unites.find(v => v.id === s.cible);
        if (u) blesser(u, s.deg, s.prop, 'tir');
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
      u.frappe = Math.max(0, u.frappe - dt); u.touche = Math.max(0, u.touche - dt); u.lent = Math.max(0, (u.lent || 0) - dt);
      if (u.type === 'barricade' || u.pv <= 0) return;
      const b = UNITES[u.type], e = u.equipe, sens = e === 0 ? 1 : -1;
      const furie = p.camps[e].assaut > 0, brume = p.camps[e].brume > 0;
      const gene = (brume ? 0.5 : 1) * (u.lent > 0 ? 0.65 : 1);
      u.cd -= dt * (furie ? 1.25 : 1) * cadence(u.prop) * (u.lent > 0 ? 0.8 : 1);
      const cible = plusProche(e, u.x, b.portee);
      const dChateau = Math.abs(PORTE[1 - e] - u.x);
      if (cible || dChateau <= b.portee) {
        if (u.cd <= 0) {
          u.cd = b.cd; u.frappe = 0.25;
          let deg = b.deg * multDeg(u.prop) * (brume ? 0.65 : 1);
          if (u.type === 'champion') deg *= 1 + tal(u.prop, 'legende');
          if (u.type !== 'etendard' && p.unites.some(v => v.type === 'etendard' && v.equipe === e && v.pv > 0 && Math.abs(v.x - u.x) < 150)) deg *= 1.2;
          if (cible) {
            if (cible.type === b.fort) deg *= b.bonus + tal(u.prop, 'piege');
            if (cible.type === 'barricade' && u.type === 'colosse') deg *= 2;
            if (u.type === 'alchimiste') tirer('fiole', e, u.prop, u.x, cible, deg, b.zone);
            else if (u.type === 'archer') tirer('fleche', e, u.prop, u.x, cible, deg, 0);
            else { blesser(cible, deg, u.prop, u.type === 'mercenaire' ? 'merc' : ''); p.evts.push({ t: 'coup', x: u.x }); }
          } else if (u.type === 'alchimiste') tirer('fiole', e, u.prop, u.x, null, deg * b.chateau, b.zone);
          else if (u.type === 'archer') tirer('fleche', e, u.prop, u.x, null, deg * b.chateau, 0);
          else { blesserChateau(1 - e, deg * b.chateau); p.evts.push({ t: 'coup', x: u.x }); }
        }
      } else u.x += sens * b.vit * (furie ? 1.3 : 1) * cadence(u.prop) * gene * dt;
    }
    function defendre(e, dt) {
      const c = p.camps[e];
      c.cdTir -= dt;
      if (c.cdTir <= 0) { // les archers du château tirent toujours un peu
        const u = plusProche(e, PORTE[e], 280);
        if (u) { c.cdTir = 1.2; tirer('fleche', e, -1, PORTE[e], u, 9 * multDef(-1, e), 0); }
      }
      for (const j of p.joueurs) if (j.equipe === e) for (const d in DEFENSES) for (let n = 0; n < j.def[d]; n++) {
        const k = j.i + d + n, D = DEFENSES[d];
        c.cdDef[k] = (c.cdDef[k] === undefined ? n * 0.3 : c.cdDef[k]) - dt;
        if (c.cdDef[k] > 0) continue;
        const u = plusProche(e, PORTE[e], D.portee);
        if (u) { c.cdDef[k] = D.cd; tirer(d, e, j.i, PORTE[e], u, D.deg * multDef(j.i, e), D.zone); }
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
      if (spes[j.i] && hasard() < 0.2) return VOIES[spes[j.i]].unite;
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
      if (spes[j.i] && !blocage(j.i, 'pouvoir')) {
        const v = spes[j.i], ennemis = p.unites.filter(u => u.equipe !== e && u.type !== 'barricade').length;
        if (v === 'guerre' || v === 'or' || (v === 'rempart' && p.camps[e].touche > 0) || (v === 'ruse' && ennemis >= 5)) ordre(j.i, 'pouvoir');
      }
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
        j.cdPouv = Math.max(0, j.cdPouv - dt);
        if (j.ia) reflechir(j, dt);
      }
      for (const c of p.camps) { c.assaut = Math.max(0, c.assaut - dt); c.touche = Math.max(0, c.touche - dt); c.dome = Math.max(0, c.dome - dt); c.brume = Math.max(0, c.brume - dt); }
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
    const TYPES = ['lancier', 'archer', 'cavalier', 'colosse', 'barricade', 'etendard', 'garde', 'mercenaire', 'alchimiste', 'champion'], GENRES = ['fleche', 'baliste', 'mortier', 'fiole'];
    const ar = v => Math.round(v * 100) / 100;
    function photo() {
      return {
        t: ar(p.t), f: p.fini,
        c: p.camps.map(c => [c.age, c.fonds, c.pv, c.max, c.assaut, c.jauge, c.touche, c.dome, c.brume].map(ar)),
        j: p.joueurs.map(j => [j.or, j.mines, j.def.baliste, j.def.mortier, j.recharge, j.appel, j.cdPouv].map(ar)),
        u: p.unites.map(u => [u.id, u.prop, TYPES.indexOf(u.type), ar(u.x), ar(u.voie), ar(u.pv), ar(u.max), ar(u.frappe), ar(u.touche)]),
        s: p.tirs.map(s => [GENRES.indexOf(s.genre), s.e, ar(s.x0), ar(s.x1), ar(s.t), s.dur, ar(s.voie)]),
      };
    }
    function charger(f) {
      const nb = l => { if (!l.every(v => typeof v === 'number' && isFinite(v))) throw new Error('photo illisible'); return l; };
      p.t = nb([f.t])[0]; p.fini = f.f === 'victoire' || f.f === 'defaite' ? f.f : null;
      p.camps.forEach((c, i) => { const l = nb(f.c[i]); [c.age, c.fonds, c.pv, c.max, c.assaut, c.jauge, c.touche, c.dome, c.brume] = l; c.age = Math.max(0, Math.min(AGES.length - 1, c.age | 0)); });
      p.joueurs.forEach((j, i) => { [j.or, j.mines, j.def.baliste, j.def.mortier, j.recharge, j.appel, j.cdPouv] = nb(f.j[i]); });
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
    return Object.assign(p, { photo, charger, lisser, confier, pas, ordre, cout, blocage, coutAge, revenu, compte, nuit, maxDef });
  }

  const api = { L, PORTE, AGES, UNITES, DEFENSES, ACTIONS, VOIES, TALENTS, CLES, SEUILS, ALLIANCES, MAX_UNITES, points, specialite, voieDominante, blocageTalent, alliance, autoTalent, adversaire, creerPartie, R };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Sim = api;
})(typeof window !== 'undefined' ? window : globalThis);
