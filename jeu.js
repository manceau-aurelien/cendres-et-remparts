// Affichage, commandes, sons et sauvegarde. Les règles sont dans sim.js.
(function () {
  'use strict';
  const S = window.Sim, cv = document.getElementById('c'), g = cv.getContext('2d');
  const W = 1600, H = 900, SOL = 505, POLICE = '"Trebuchet MS", "Segoe UI", sans-serif';
  const COUL = { j: ['#3fb6a8', '#f0a63c', '#c8434f'], nom: ['Joueur 1', 'Joueur 2'] };
  const PAL = [ // une ambiance par âge
    { haut: '#37506b', bas: '#e8b98a', pierre: '#8a6a47', toit: '#5f7a3c', metal: '#a58a62', accent: '#9fd16b' },
    { haut: '#3a4a66', bas: '#c9c3b8', pierre: '#8b8f96', toit: '#4b5a75', metal: '#c9d2da', accent: '#dfe8f0' },
    { haut: '#4b3a44', bas: '#e0a06a', pierre: '#9a6b4f', toit: '#6e3f2e', metal: '#d9a648', accent: '#ffce6b' },
    { haut: '#1f2550', bas: '#7f6bc0', pierre: '#5d6488', toit: '#3a3f7a', metal: '#8fe3ff', accent: '#6ff0ff' },
    { haut: '#0c0f2a', bas: '#4a3a7d', pierre: '#39406b', toit: '#1c2350', metal: '#ffe9a8', accent: '#ffd76a' },
  ];
  const AGE_DE = ['du Bois', 'du Fer', 'de la Vapeur', 'de l\'Éclair', 'des Astres'];
  const TXT = {
    lancier: 'Solide et bon marché. Fort contre les cavaliers.',
    archer: 'Tire de loin. Fort contre les lanciers.',
    cavalier: 'Très rapide. Fort contre les archers.',
    colosse: 'Lent et énorme. Triple dégâts sur le château.',
    assaut: 'Appuyez tous les deux en moins de 5 s : soldats déchaînés.',
    baliste: 'Tire vite, une seule cible.',
    mortier: 'Tir lent, dégâts de zone.',
    barricade: 'Bloque l\'ennemi devant le château. Réparable.',
    mine: 'Augmente votre revenu en or. 6 au maximum.',
    age: 'Verse 50 or au pot commun. Nouvel âge = soldats et défenses ×1,4.',
  };
  const TXTS = {
    guerre:  { special: 'Étendard : les soldats proches frappent 20 % plus fort.', pouvoir: 'Champion : un héros rejoint le combat.' },
    rempart: { special: 'Garde-mur : encaisse beaucoup, les tirs lui font 60 % de dégâts en moins.', pouvoir: 'Dôme : répare le château et protège ses abords quelques secondes.' },
    or:      { special: 'Mercenaire : chaque ennemi qu\'il abat vous rapporte 8 or à tous les deux.', pouvoir: 'Manne : de l\'or pour vous et pour votre allié.' },
    ruse:    { special: 'Alchimiste : ses fioles frappent en zone et ralentissent.', pouvoir: 'Brume : les ennemis avancent moitié moins vite et frappent moins fort.' },
  };
  const COULV = { guerre: '#ff8a6b', rempart: '#8fb8e8', or: '#f2cf5b', ruse: '#c59bf0' };
  const NOMS = { assaut: 'Assaut', barricade: 'Barricade', mine: 'Mine', age: 'Âge', special: 'Spéciale', pouvoir: 'Pouvoir' };
  const nomAction = (a, i) => {
    const v = partie.spes[i];
    if (v && a === 'special') return S.UNITES[S.VOIES[v].unite].nom;
    if (v && a === 'pouvoir') return S.VOIES[v].pouvoir;
    return (S.UNITES[a] || S.DEFENSES[a] || {}).nom || NOMS[a];
  };
  const texteAction = (a, i) => a === 'special' || a === 'pouvoir'
    ? (partie.spes[i] ? TXTS[partie.spes[i]][a] : 'Se débloque en choisissant une spécialité : 4 points dans une voie.') : TXT[a];
  function titre(tal) {
    const v = S.specialite(tal), d = S.voieDominante(tal);
    return v ? S.VOIES[v].titre : d ? 'Voie ' + S.VOIES[d].nom : 'Recrue';
  }

  // --- Sauvegarde ---------------------------------------------------------
  const CLE = 'cendres-et-remparts';
  const neuf = () => ({ niveau: 1, morts: 0, talents: [{}, {}], choix: [0, 0], resultat: null, solo: false, muet: false });
  let sauve = neuf();
  try { sauve = Object.assign(sauve, JSON.parse(localStorage.getItem(CLE) || '{}')); } catch (e) { /* sauvegarde illisible : on repart à neuf */ }
  if (sauve.renforts) { // ancienne sauvegarde : les renforts communs redeviennent des points à répartir
    const n = Object.values(sauve.renforts).reduce((a, b) => a + (b | 0), 0) + (sauve.choix[0] | 0) + (sauve.choix[1] | 0);
    sauve.choix = [Math.ceil(n / 2), Math.floor(n / 2)];
    sauve.talents = [{}, {}]; sauve.resultat = null;
    delete sauve.renforts;
    try { localStorage.setItem(CLE, JSON.stringify(sauve)); } catch (e) { /* stockage bloqué */ }
  }
  let mode = 'duo'; // duo | solo | hote | invite
  const garder = () => {
    try {
      let o = sauve;
      if (mode === 'invite') { // la campagne appartient à l'hôte : l'invité ne garde que son réglage de son
        o = Object.assign(neuf(), JSON.parse(localStorage.getItem(CLE) || '{}'), { muet: sauve.muet });
      }
      localStorage.setItem(CLE, JSON.stringify(o));
    } catch (e) { /* stockage bloqué */ }
  };

  // --- Son ----------------------------------------------------------------
  let ac = null;
  const dernier = {};
  function son(f, f2, dur, type, vol) {
    if (sauve.muet) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime, o = ac.createOscillator(), v = ac.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
      v.gain.setValueAtTime(vol || 0.04, t);
      v.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      o.connect(v).connect(ac.destination);
      o.start(t); o.stop(t + dur);
    } catch (e) { /* pas de son disponible */ }
  }
  function sonRare(cle, delai, ...a) {
    const n = performance.now();
    if (n - (dernier[cle] || 0) > delai) { dernier[cle] = n; son(...a); }
  }

  // --- État ---------------------------------------------------------------
  let ecran = 'titre', partie = null, pause = false, vitesse = 1, depuis = 0, part = [], annonce = null, secousse = 0, refus = [0, 0];
  let confirmer = 0, sansRenfort = false;
  const curseur = [0, 0], curChoix = [0, 3];
  let zones = [], souris = { x: -1, y: -1 };
  let net = null, ami = false, evtsNet = [], chrono = 0, codeNet = '';
  const enLigne = () => mode === 'hote' || mode === 'invite';
  const moi = () => mode === 'invite' ? 1 : 0;
  const seul = () => mode === 'solo' || (mode === 'hote' && !ami);   // l'allié est joué par l'IA
  const humain = i => enLigne() ? i === moi() : !(mode === 'solo' && i === 1); // joué sur ce clavier
  const present = i => humain(i) || (enLigne() && (mode === 'invite' || ami));
  const nomJoueur = i => !enLigne() || !present(i) ? COUL.nom[i] : humain(i) ? 'Vous' : 'Votre ami';
  const choixFini = () => sauve.choix[0] + (seul() ? 0 : sauve.choix[1]) === 0;
  let confR = [0, 0];

  function lancer() {
    if (mode === 'invite') { net.poster({ t: 'go' }); return; }
    autoAllie();
    partie = S.creerPartie({ niveau: sauve.niveau, talents: sauve.talents, graine: Date.now() % 1e9, bots: [false, seul()] });
    evtsNet = []; vitesse = enLigne() ? 1 : vitesse;
    ouvrirPartie();
    diffuser();
  }
  function ouvrirPartie() {
    ecran = 'jeu'; pause = false; part = []; depuis = 0; sansRenfort = false;
    const al = S.ALLIANCES[partie.allie];
    dire(partie.adv.nom + ', ' + partie.adv.titre, partie.adv.desc + (al ? '  Votre alliance, ' + al.nom + ' : ' + al.texte + '.' : ''), 5);
  }
  function dire(a, b, t) { annonce = { a, b, t }; }
  function finir() {
    const v = partie.fini === 'victoire';
    sauve.resultat = partie.fini;
    if (!sansRenfort) sauve.choix = sauve.choix.map(n => n + (v ? 2 : 1));
    if (v) sauve.niveau++; else sauve.morts++;
    garder(); depuis = 0; ecran = 'choix';
    diffuser();
  }
  function choisir(i, k) {
    if (depuis < 1.2 || sauve.choix[i] <= 0) return;
    if (S.blocageTalent(sauve.talents[i], S.CLES[k])) { sonRare('refus', 120, 130, 100, 0.1, 'square', 0.03); return; }
    if (mode === 'invite') { net.poster({ t: 'choix', k }); return; }
    appliquerChoix(i, k);
  }
  function appliquerChoix(i, k) {
    const cle = S.CLES[k], t = sauve.talents[i];
    t[cle] = (t[cle] || 0) + 1;
    sauve.choix[i]--;
    son(500, 1100, 0.25, 'triangle', 0.08);
    garder();
    if (choixFini()) depuis = 0;
    diffuser();
  }
  function agir(i, a) {
    if (!humain(i) || pause) return;
    if (mode === 'invite') {
      if (partie.blocage(i, a)) { refus[i] = 0.25; partie.evts.push({ t: 'refus', i }); } else net.poster({ t: 'ordre', a });
    } else if (!partie.ordre(i, a)) refus[i] = 0.25;
  }
  function basculerPause() { if (mode === 'invite') net.poster({ t: 'pause', v: !pause }); else pause = !pause; }
  function basculerVitesse() { if (mode === 'invite') net.poster({ t: 'vitesse' }); else vitesse = vitesse === 1 ? 2 : 1; }
  function lancerSelon(solo) {
    sauve.solo = solo; mode = solo ? 'solo' : 'duo';
    demarrer();
  }
  function autoAllie() { // l'IA dépense les points du joueur absent, dans une voie qui complète la vôtre
    if (!seul()) return;
    const t = sauve.talents[1], d = S.voieDominante(sauve.talents[0]);
    const v = S.specialite(t) || S.voieDominante(t) || (d === 'guerre' ? 'or' : 'guerre');
    for (; sauve.choix[1] > 0; sauve.choix[1]--) { const k = S.autoTalent(t, v, Math.random); t[k] = (t[k] || 0) + 1; }
    garder();
  }
  function reorienter(i) {
    if (confR[i] <= 0) { confR[i] = 3; return; }
    confR[i] = 0;
    if (mode === 'invite') net.poster({ t: 'reset' }); else toutReprendre(i);
  }
  function toutReprendre(i) {
    sauve.choix[i] += S.points(sauve.talents[i]);
    sauve.talents[i] = {};
    son(700, 200, 0.4, 'triangle', 0.07);
    garder(); diffuser();
  }
  function demarrer() {
    if (!choixFini()) { depuis = 0; ecran = 'choix'; diffuser(); } // points en attente d'une partie précédente
    else lancer();
    garder();
  }

  // --- Jeu en ligne -----------------------------------------------------------
  // L'hôte calcule tout ; l'invité envoie ses ordres et affiche les photos reçues.
  const VERSION = 2;
  function diffuser() { // ce que l'invité doit savoir, en dehors du combat lui-même
    if (mode !== 'hote' || !ami) return;
    net.poster({ t: 'etat', ecran, niveau: sauve.niveau, morts: sauve.morts, talents: sauve.talents, choix: sauve.choix, resultat: sauve.resultat, partie: partie && ecran === 'jeu' ? partie.niveau : 0 });
  }
  function photographier(dt) {
    chrono += dt;
    if (mode !== 'hote' || !ami || ecran !== 'jeu' || chrono < 1 / 15) return;
    chrono = 0;
    if (net.poster({ t: 'photo', p: partie.photo(), z: pause, v: vitesse, e: evtsNet.slice(-60) })) evtsNet = [];
  }
  function messageHote(m) {
    if (m.t === 'salut') {
      if (m.v !== VERSION) { net.poster({ t: 'version' }); return; }
      ami = true;
      if (ecran === 'reseau') { info('Votre ami est connecté !'); el('s-go').hidden = false; el('s-choix').hidden = true; }
      else {
        if (ecran === 'jeu') { partie.confier(1, false); dire('Votre ami est de retour', '', 2.5); }
      }
      diffuser();
    } else if (!ami) return;
    else if (m.t === 'ordre') { if (ecran === 'jeu' && !pause && S.ACTIONS.includes(m.a)) partie.ordre(1, m.a); }
    else if (m.t === 'choix') { if (ecran === 'choix' && sauve.choix[1] > 0 && Number.isInteger(m.k) && m.k >= 0 && m.k < S.CLES.length && !S.blocageTalent(sauve.talents[1], S.CLES[m.k])) appliquerChoix(1, m.k); }
    else if (m.t === 'reset') { if (ecran === 'choix') toutReprendre(1); }
    else if (m.t === 'go') { if (ecran === 'choix' && choixFini()) lancer(); }
    else if (m.t === 'pause') { if (ecran === 'jeu') pause = !!m.v; }
    else if (m.t === 'vitesse') vitesse = vitesse === 1 ? 2 : 1;
    else if (m.t === 'adieu') amiParti();
  }
  function amiParti() {
    if (!ami) return;
    ami = false;
    if (ecran === 'jeu') { if (!partie.fini) partie.confier(1, true); dire('Votre ami est déconnecté', 'Une IA prend sa place.' + (codeNet ? ' Le code ' + codeNet + ' reste valable.' : ''), 4); }
    else if (ecran === 'reseau') { info('Votre ami est parti. En attente…'); el('s-go').hidden = true; }
  }
  function messageInvite(m) {
    if (m.t === 'version') { quitterReseau(); ouvrirSalon('Vos deux fichiers de jeu sont de versions différentes : prenez le même.'); }
    else if (m.t === 'adieu') { quitterReseau(); ouvrirSalon('Votre ami a quitté la partie.'); }
    else if (m.t === 'etat') {
      const nb = (v, d) => Number.isInteger(v) && v >= 0 && v < 1e6 ? v : d;
      sauve.niveau = Math.max(1, nb(m.niveau, 1)); sauve.morts = nb(m.morts, 0);
      const avantChoix = sauve.choix.join(), etaitChoix = ecran === 'choix';
      sauve.choix = [nb(m.choix[0], 0), nb(m.choix[1], 0)];
      sauve.resultat = m.resultat === 'victoire' ? 'victoire' : 'defaite';
      sauve.talents = [0, 1].map(i => { const t = {}; for (const k of S.CLES) { const n = nb(m.talents[i][k], 0); if (n) t[k] = n; } return t; });
      if (m.ecran === 'jeu' && nb(m.partie, 0) > 0) {
        partie = S.creerPartie({ niveau: m.partie, talents: sauve.talents, graine: 1, bots: [false, false] });
        el('salon').hidden = true; ouvrirPartie();
      } else if (m.ecran === 'choix') {
        el('salon').hidden = true; ecran = 'choix';
        if (!etaitChoix || choixFini()) depuis = 0;
        else if (avantChoix !== sauve.choix.join()) son(500, 1100, 0.25, 'triangle', 0.08);
      } else if (ecran !== 'reseau') { partie = null; ouvrirSalon('Connecté. Votre ami va lancer la partie.'); }
    } else if (m.t === 'photo') {
      if (ecran !== 'jeu' || !partie) return;
      partie.charger(m.p); pause = !!m.z; vitesse = m.v === 2 ? 2 : 1;
      if (Array.isArray(m.e)) for (const e of m.e) if (e && typeof e.t === 'string' && !(e.t === 'refus') && !(e.t === 'age' && !PAL[e.age])) partie.evts.push(e);
    }
  }
  const el = id => document.getElementById(id);
  const info = s => { el('info').textContent = s; };
  function ouvrirSalon(s) {
    ecran = 'reseau'; pause = false;
    const libre = !net;
    el('salon').hidden = false; el('s-choix').hidden = !libre; el('s-manuel').hidden = !libre;
    el('s-code').hidden = true; el('s-go').hidden = true;
    info(s || '');
  }
  function connecter(role) {
    if (net) net.fermer();
    ami = false; codeNet = '';
    mode = role;
    if (role === 'invite') sauve = Object.assign(neuf(), { muet: sauve.muet });
    const n = net = window.Reseau.creer({
      code(c) { codeNet = c; el('code').textContent = c; el('s-code').hidden = false; info('En attente de votre ami…'); },
      ouvert() {
        if (n !== net) return;
        el('s-manuel').hidden = true; el('s-choix').hidden = true;
        if (role === 'invite') { n.poster({ t: 'salut', v: VERSION }); info('Connecté. Votre ami va lancer la partie.'); }
      },
      message(m) { if (n !== net) return; try { (role === 'hote' ? messageHote : messageInvite)(m); } catch (e) { console.warn('message ignoré', e); } },
      ferme() {
        if (n !== net) return;
        if (role === 'hote') amiParti();
        else { const c = codeNet; quitterReseau(); ouvrirSalon('Connexion perdue. Rejoignez avec le même code pour reprendre.'); el('i-code').value = c; }
      },
      erreur(s) { if (n !== net || ecran !== 'reseau') return; const c = codeNet; quitterReseau(); ouvrirSalon(s); if (c && role === 'invite') el('i-code').value = c; },
    });
    el('s-choix').hidden = true;
    return n;
  }
  function quitterReseau() {
    const n = net; net = null; ami = false;
    if (n) n.fermer();
    if (mode === 'invite') { // on retrouve sa propre campagne
      const muet = sauve.muet;
      sauve = neuf();
      try { Object.assign(sauve, JSON.parse(localStorage.getItem(CLE) || '{}')); } catch (e) { /* illisible */ }
      sauve.muet = muet;
    }
    mode = 'duo'; partie = null; pause = false;
  }
  function versMenu() { if (enLigne()) quitterReseau(); partie = null; pause = false; el('salon').hidden = true; ecran = 'titre'; }
  el('b-creer').onclick = () => { info('Création…'); el('s-manuel').hidden = true; connecter('hote').heberger(); };
  el('b-rejoindre').onclick = () => {
    const c = el('i-code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length !== 6) { info('Le code fait 6 caractères.'); return; }
    info('Connexion…'); el('s-manuel').hidden = true;
    const n = connecter('invite'); codeNet = c; n.rejoindre(c);
  };
  el('i-code').onkeydown = e => { if (e.key === 'Enter') el('b-rejoindre').click(); };
  el('b-copier').onclick = async () => { try { await navigator.clipboard.writeText(codeNet); info('Code copié. En attente de votre ami…'); } catch (e) { info('Copie impossible : notez le code.'); } };
  el('b-go').onclick = () => { if (!ami) return; el('salon').hidden = true; demarrer(); };
  el('b-retour').onclick = versMenu;
  el('b-inviter').onclick = async () => {
    info('Préparation de l\'invitation…');
    try { el('t-a').value = await connecter('hote').inviter(); el('t-a').select(); info('Copiez l\'invitation et envoyez-la à votre ami.'); } catch (e) { info('Connexion directe impossible dans ce navigateur.'); }
  };
  el('b-accepter').onclick = async () => {
    info('Préparation de la réponse…');
    try { el('t-b').value = await connecter('invite').accepter(el('t-a').value); el('t-b').select(); info('Copiez la réponse et renvoyez-la à votre ami.'); } catch (e) { quitterReseau(); ouvrirSalon('Invitation illisible : recopiez-la en entier.'); el('s-manuel').open = true; }
  };
  el('b-conclure').onclick = async () => {
    if (mode !== 'hote' || !net) { info('Créez d\'abord une invitation.'); return; }
    try { await net.conclure(el('t-b').value); info('Connexion…'); } catch (e) { info('Réponse illisible : recopiez-la en entier.'); }
  };

  // --- Commandes (positions physiques des touches : ZQSD sur AZERTY) ----------
  const DIR = { KeyA: [0, -1], KeyD: [0, 1], KeyW: [0, -5], KeyS: [0, 5], ArrowLeft: [1, -1], ArrowRight: [1, 1], ArrowUp: [1, -5], ArrowDown: [1, 5] };
  const OK = { Space: 0, Enter: 1, NumpadEnter: 1 };
  function bouger(c, i, d, n, col) {
    const l = Math.floor(c[i] / col), k = c[i] % col;
    if (Math.abs(d) === 1) c[i] = l * col + (k + d + col) % col;
    else c[i] = (c[i] + (d > 0 ? col : n - col)) % n;
  }
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (ecran === 'reseau') { if (e.key === 'Escape') versMenu(); return; }
    if (DIR[e.code] || e.code in OK) e.preventDefault();
    if (e.key === 'm' || e.key === 'M') { if (!e.repeat) { sauve.muet = !sauve.muet; garder(); } return; }
    if (ecran === 'jeu') {
      if ((e.key === 'Escape' || e.code === 'KeyP') && !e.repeat) { basculerPause(); return; }
      if (e.code === 'KeyV' && !e.repeat) { basculerVitesse(); return; }
      if (DIR[e.code]) { const [j, d] = DIR[e.code], i = enLigne() ? moi() : j; bouger(curseur, i, d, 12, 6); }
      else if (e.code in OK && !e.repeat) { const i = enLigne() ? moi() : OK[e.code]; agir(i, S.ACTIONS[curseur[i]]); }
    } else if (ecran === 'choix') {
      if (DIR[e.code]) { const [j, d] = DIR[e.code], i = enLigne() ? moi() : j; bouger(curChoix, i, d, S.CLES.length, 4); }
      else if (e.code in OK && !e.repeat) {
        const i = enLigne() ? moi() : OK[e.code];
        if (choixFini()) { if (depuis > 0.6) lancer(); } else choisir(i, curChoix[i]);
      }
    } else if (e.code in OK && !e.repeat) lancerSelon(sauve.solo);
  });
  addEventListener('blur', () => { if (ecran === 'jeu' && !partie.fini && !enLigne()) pause = true; });
  function pos(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  }
  const dans = z => souris.x >= z.x && souris.x <= z.x + z.w && souris.y >= z.y && souris.y <= z.y + z.h;
  cv.addEventListener('mousemove', e => { souris = pos(e); });
  cv.addEventListener('mousedown', e => {
    souris = pos(e);
    for (let k = zones.length - 1; k >= 0; k--) if (dans(zones[k])) { zones[k].f(); return; }
  });
  function zone(x, y, w, h, f) { const z = { x, y, w, h, f }; zones.push(z); return dans(z); }

  // --- Outils de dessin -----------------------------------------------------
  function rect(x, y, w, h, r, c, bord, ep) {
    g.beginPath(); g.roundRect(x, y, w, h, r);
    if (c) { g.fillStyle = c; g.fill(); }
    if (bord) { g.strokeStyle = bord; g.lineWidth = ep || 2; g.stroke(); }
  }
  function texte(s, x, y, t, c, al, gras, max) {
    g.font = (gras ? 'bold ' : '') + t + 'px ' + POLICE;
    g.fillStyle = c || '#fff'; g.textAlign = al || 'left'; g.textBaseline = 'middle';
    if (max) g.fillText(s, x, y, max); else g.fillText(s, x, y);
  }
  function jauge(x, y, w, h, r, c) {
    rect(x, y, w, h, h / 2, 'rgba(0,0,0,.55)');
    r = Math.max(0, Math.min(1, r));
    if (r > 0.01) rect(x, y, Math.max(h, w * r), h, h / 2, c);
  }
  function poly(c, ...p) {
    g.fillStyle = c; g.beginPath(); g.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
    g.closePath(); g.fill();
  }
  function ligne(c, ep, ...p) {
    g.strokeStyle = c; g.lineWidth = ep; g.lineCap = 'round'; g.beginPath(); g.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
    g.stroke();
  }
  function rond(c, x, y, r) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }

  // --- Décor ------------------------------------------------------------------
  function decor(t) {
    const a = partie ? partie.camps[0].age : 0;
    const d = g.createLinearGradient(0, 0, 0, SOL);
    d.addColorStop(0, PAL[a].haut); d.addColorStop(1, PAL[a].bas);
    g.fillStyle = d; g.fillRect(0, 0, W, H);
    const nuit = partie ? Math.min(0.5, partie.nuit() * 0.12) : 0;
    rond('rgba(255,240,210,.5)', 800, 190 + nuit * 300, 60);
    if (a >= 3) for (let k = 0; k < 60; k++) rond('rgba(255,255,255,.6)', (k * 397) % W, (k * 173) % 300, 1 + k % 2);
    for (let c = 0; c < 2; c++) {
      g.fillStyle = c ? 'rgba(30,38,44,.55)' : 'rgba(40,50,66,.35)';
      g.beginPath(); g.moveTo(0, SOL);
      for (let x = 0; x <= W; x += 40) g.lineTo(x, (c ? 430 : 350) + Math.sin(x * 0.006 + c * 2) * 40 + Math.sin(x * 0.017 + c) * 18);
      g.lineTo(W, SOL); g.fill();
    }
    g.fillStyle = '#3d3a2c'; g.fillRect(0, SOL - 45, W, H);
    g.fillStyle = '#4b4734'; g.fillRect(0, SOL - 45, W, 10);
    g.fillStyle = 'rgba(0,0,0,.12)';
    for (let k = 0; k < 40; k++) g.fillRect((k * 211) % W, SOL - 25 + (k * 37) % 100, 24, 3);
    if (partie) { chateau(0, partie.camps[0]); chateau(1, partie.camps[1]); }
    if (nuit) {
      g.fillStyle = 'rgba(60,10,10,' + nuit * 0.6 + ')'; g.fillRect(0, 0, W, 600);
      for (let k = 0; k < 70; k++) rond('rgba(220,210,200,.5)', (k * 149 + t * 25) % W, (k * 83 + t * (40 + k % 5 * 12)) % 590, 2);
    }
  }
  function chateau(e, c) {
    const age = c.age, P = PAL[age], n0 = performance.now();
    g.save();
    if (e === 1) { g.translate(W, 0); g.scale(-1, 1); }
    if (c.touche > 0) g.translate(Math.sin(n0) * 2, 0);
    const y = SOL + 20;
    g.fillStyle = P.pierre; g.fillRect(0, y - 170, 130, 170);
    g.fillStyle = 'rgba(0,0,0,.15)';
    for (let k = 0; k < 7; k++) for (let m = 0; m < 4; m++) g.fillRect(m * 34 + (k % 2) * 14, y - 160 + k * 24, 24, 2);
    g.fillStyle = P.pierre;
    for (let m = 0; m < 5; m++) g.fillRect(m * 28, y - 186, 17, 18);
    // donjon : il grandit avec l'âge
    const h = 230 + age * 22;
    g.fillRect(8, y - h, 66, h - 100);
    poly(P.toit, 0, y - h, 41, y - h - 62, 82, y - h);
    rond(P.accent, 41, y - h + 30, 11); rond('rgba(0,0,0,.45)', 41, y - h + 30, 7);
    if (age >= 2) { ligne(P.metal, 6, 100, y - 170, 100, y - 225); rond('rgba(230,230,230,.25)', 102, y - 238 - (n0 / 60) % 25, 11); }
    if (age >= 3) { ligne(P.accent, 2, 41, y - h - 62, 41, y - h - 85); rond(P.accent, 41, y - h - 85, 5 + Math.sin(n0 / 200)); }
    if (age >= 4) { g.strokeStyle = P.accent; g.lineWidth = 3; g.beginPath(); g.ellipse(41, y - h - 85, 34, 10, 0, 0, 7); g.stroke(); }
    // porte
    g.fillStyle = '#2a1d15'; g.beginPath(); g.roundRect(84, y - 78, 46, 78, [23, 23, 0, 0]); g.fill();
    for (let k = 0; k < 3; k++) ligne(P.metal, 3, 95 + k * 12, y - 66, 95 + k * 12, y);
    ligne('#3a2a20', 3, 112, y - 180, 112, y - 250);
    poly(e === 0 ? COUL.j[0] : COUL.j[2], 112, y - 250, 148, y - 239, 112, y - 228);
    // défenses construites
    let n = 0;
    for (const j of partie.joueurs) if (j.equipe === e) for (const d of ['baliste', 'mortier']) for (let k = 0; k < j.def[d]; k++, n++) {
      const x = 18 + (n % 6) * 21, yy = y - 192 + Math.floor(n / 6) * 45;
      rond(COUL.j[j.i], x, yy + 5, 8);
      if (d === 'baliste') { ligne(P.metal, 3, x - 6, yy - 10, x + 8, yy, x - 2, yy + 8); ligne('#222', 2, x - 4, yy, x + 13, yy - 3); }
      else ligne('#22252a', 9, x, yy + 2, x + 7, yy - 10);
    }
    const r = c.pv / c.max;
    if (r < 0.6) for (let k = 0; k < (r < 0.3 ? 3 : 1); k++) {
      rond('rgba(255,120,40,.8)', 25 + k * 36, y - 110 - k * 14, 9 + Math.sin(n0 / 90 + k) * 3);
      rond('rgba(40,40,40,.35)', 25 + k * 36, y - 130 - k * 14 - (n0 / 40) % 40, 13);
    }
    g.restore();
  }

  // --- Soldats ------------------------------------------------------------------
  const yVoie = v => SOL + v * 62;
  function soldat(u, t) {
    const age = partie.camps[u.equipe].age, P = PAL[age], C = COUL.j[u.prop];
    const marche = Math.sin(t * 9 + u.id), coup = u.frappe > 0 ? Math.sin(u.frappe / 0.25 * Math.PI) : 0;
    const PEAU = '#e0b48c', NOIR = '#2c2723';
    g.save();
    g.translate(u.x, yVoie(u.voie));
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, 1, u.type === 'colosse' ? 30 : u.type === 'champion' ? 24 : 15, 5, 0, 0, 7); g.fill();
    g.scale(u.equipe === 0 ? 1 : -1, 1);
    if (u.touche > 0) g.globalAlpha *= 0.6;
    if (partie.camps[u.equipe].assaut > 0 && u.type !== 'barricade') { g.shadowColor = '#ffd04a'; g.shadowBlur = 16; }
    if (u.type === 'barricade') {
      for (let k = 0; k < 4; k++) poly(k % 2 ? P.pierre : P.metal, -16 + k * 9, 4, -11 + k * 9, -62 - (k % 2) * 10, -5 + k * 9, 4);
      ligne('#3a2a20', 5, -16, -22, 20, -26);
      g.fillStyle = C; g.fillRect(-6, -48, 14, 14);
    } else if (u.type === 'colosse') {
      ligne(NOIR, 11, -9, -26, -11 + marche * 6, -1); ligne(NOIR, 11, 9, -26, 11 - marche * 6, -1);
      rect(-25, -78, 50, 56, 18, C); rect(-16, -70, 32, 22, 8, P.metal);
      rond(PEAU, 8, -88, 12); rect(-4, -101, 25, 10, 4, P.metal); rond('#221', 14, -87, 2);
      ligne(NOIR, 9, 18, -62, 34, -50 - coup * 14);
      ligne(P.metal, 6, 32, -46, 44 + coup * 10, -84 + coup * 48); rond(P.metal, 44 + coup * 10, -84 + coup * 48, 13);
      if (age >= 3) rond(P.accent, 0, -58, 6);
    } else {
      const cav = u.type === 'cavalier', y = cav ? -24 : 0, BAI = '#4a342a';
      if (u.type === 'champion') { g.scale(1.55, 1.55); poly('#8e2430', -4, -38, -24 - marche * 2, -2, -6, -8); }
      if (u.type === 'etendard') { ligne('#6b4d33', 3, -11, 0, -11, -84); poly(C, -11, -84, -42 - marche * 3, -76, -34, -68, -42 + marche * 3, -60, -11, -56); rond(P.accent, -11, -86, 4); }
      if (cav) {
        g.fillStyle = BAI; g.beginPath(); g.ellipse(0, -24, 24, 11, 0, 0, 7); g.fill();
        ligne(BAI, 9, 18, -28, 27, -44);
        g.fillStyle = BAI; g.beginPath(); g.ellipse(32, -46, 9, 5, 0.4, 0, 7); g.fill();
        for (const [x, s] of [[-16, 1], [-9, -1], [12, 1], [18, -1]]) ligne(BAI, 4, x, -18, x + marche * s * 8, 0);
        ligne('#2a1c15', 4, -23, -27, -32, -14);
        if (age >= 1) rect(-10, -36, 24, 13, 4, P.metal);
      } else { ligne(NOIR, 5, -3, -14, -4 + marche * 6, 0); ligne(NOIR, 5, 3, -14, 4 - marche * 6, 0); }
      rect(-9, y - 38, 18, 26, 7, C);
      if (age >= 1) rect(-6, y - 35, 12, 10, 3, P.metal);
      rond(PEAU, 1, y - 45, 8); rond('#221', 5, y - 45, 1.5);
      if (u.type === 'alchimiste') { poly(C, -12, 0, -8, -38, 8, -38, 12, 0); poly('#4b3470', -10, -42, -3, -66, 11, -44); }
      else if (u.type === 'mercenaire') { rect(-13, -55, 28, 5, 2, '#2f241c'); rect(-6, -64, 14, 11, 4, '#2f241c'); ligne('#e5b93c', 2, -6, -55, 8, -55); }
      else if (u.type === 'champion') poly('#f2cf5b', -8, -50, -8, -62, -3, -55, 1, -64, 5, -55, 10, -62, 10, -50);
      else if (u.type === 'archer') poly(age ? P.metal : '#3d5a2d', -9, y - 44, 0, y - 60, 10, y - 46);
      else { rect(-8, y - 54, 18, 8, 4, age ? P.metal : '#6b4d33'); if (age >= 2) ligne(P.accent, 3, 0, y - 54, -5, y - 62); }
      if (u.type === 'lancier') {
        const a = coup * 14;
        ligne('#6b4d33', 3, -8 + a, y - 20, 30 + a, y - 28); poly(P.metal, 28 + a, y - 32, 41 + a, y - 29, 28 + a, y - 24);
        rond(P.metal, 9, y - 24, 8); rond(C, 9, y - 24, 4);
      }
      if (u.type === 'archer') {
        g.strokeStyle = P.metal; g.lineWidth = 3; g.beginPath(); g.arc(8, y - 27, 15, -1.3, 1.3); g.stroke();
        ligne('#eee', 1, 12, y - 41, 6 - coup * 5, y - 27, 12, y - 13);
      }
      if (u.type === 'etendard') ligne(P.metal, 4, 8, -26, 22 + coup * 10, -40 + coup * 18);
      if (u.type === 'garde') { rect(6 + coup * 5, -46, 15, 44, 5, P.pierre, P.metal, 3); rond(C, 13 + coup * 5, -25, 5); }
      if (u.type === 'mercenaire') { ligne(P.metal, 4, 8, -26, 24 + coup * 8, -44 + coup * 26); ligne(P.metal, 4, 2, -22, 20 + coup * 12, -14 - coup * 8); }
      if (u.type === 'alchimiste') { rond('#c59bf0', 15, -30 - coup * 12, 6); ligne('#eee', 2, 15, -36 - coup * 12, 15, -42 - coup * 12); }
      if (u.type === 'champion') { ligne(P.metal, 6, 8, -26, 30 + coup * 8, -58 + coup * 50); ligne('#f2cf5b', 4, 6, -34, 18, -26); }
      if (cav) ligne(P.metal, 4, 10, y - 28, 24 + coup * 8, y - 46 + coup * 34);
      if (age >= 4) { g.strokeStyle = P.accent; g.lineWidth = 2; g.beginPath(); g.ellipse(1, y - 62, 9, 3, 0, 0, 7); g.stroke(); }
    }
    g.restore();
    const r = u.pv / u.max;
    if (r < 0.99) jauge(u.x - 17, yVoie(u.voie) - (u.type === 'colosse' || u.type === 'champion' ? 116 : u.type === 'cavalier' ? 92 : 74), 34, 5, r, r > 0.4 ? '#7bd35f' : '#e2553f');
  }
  function tirs() {
    for (const s of partie.tirs) {
      const k = s.t / s.dur, y0 = s.x0 === S.PORTE[s.e] ? SOL - 160 : yVoie(s.voie) - 28, y1 = yVoie(s.voie) - 25;
      const arc = s.genre === 'mortier' ? 170 : s.genre === 'fiole' ? 70 : 26;
      const pt = q => [s.x0 + (s.x1 - s.x0) * q, y0 + (y1 - y0) * q - Math.sin(q * Math.PI) * arc];
      const [x, y] = pt(k), [xa, ya] = pt(Math.max(0, k - 0.09)), P = PAL[partie.camps[s.e].age];
      if (s.genre === 'fiole') rond('#c59bf0', x, y, 6);
      else if (s.genre === 'mortier') { rond('#1d1a18', x, y, 8); rond(P.accent, x, y, 4); }
      else ligne(s.genre === 'baliste' ? P.accent : '#f4ead0', s.genre === 'baliste' ? 4 : 2, xa, ya, x, y);
    }
  }
  function effets(t) { // dôme du Bâtisseur et brume du Stratège
    for (const e of [0, 1]) {
      const c = partie.camps[e], x = S.PORTE[e];
      if (c.dome > 0) {
        g.globalAlpha = Math.min(1, c.dome) * (0.8 + Math.sin(t * 6) * 0.1);
        g.beginPath(); g.ellipse(x, SOL + 70, 350, 330, 0, Math.PI, 0);
        g.fillStyle = 'rgba(143,184,232,.2)'; g.fill(); g.strokeStyle = '#bcd9ff'; g.lineWidth = 4; g.stroke();
        g.globalAlpha = 1;
      }
      if (c.brume > 0) for (const u of partie.unites) if (u.equipe === e && u.type !== 'barricade')
        for (let k = 0; k < 3; k++) rond('rgba(190,170,220,.28)', u.x + Math.sin(t * 2 + u.id + k * 2) * 22, yVoie(u.voie) - 20 - k * 13, 19);
    }
  }
  function eclats(x, y, n, c, v) {
    for (let k = 0; k < n && part.length < 400; k++) {
      const a = Math.random() * 6.3;
      part.push({ x, y, vx: Math.cos(a) * v * Math.random(), vy: -Math.abs(Math.sin(a)) * v * Math.random(), t: 0.4 + Math.random() * 0.4, c, r: 2 + Math.random() * 3 });
    }
  }
  function evenements() {
    if (mode === 'hote' && ami) evtsNet.push(...partie.evts);
    for (const e of partie.evts) {
      const nous = e.i !== undefined && e.i < 2;
      if (e.t === 'mort') { eclats(e.x, yVoie(e.voie) - 25, 10, e.e ? COUL.j[2] : '#cfc8bb', 160); sonRare('mort', 70, 190, 60, 0.18, 'sawtooth', 0.03); }
      else if (e.t === 'explosion') { eclats(e.x, SOL + 15, 18, '#ff9a3c', 230); secousse = Math.max(secousse, 0.12); sonRare('boum', 80, 110, 30, 0.3, 'sawtooth', 0.06); }
      else if (e.t === 'fiole') { eclats(e.x, SOL + 10, 10, '#c59bf0', 150); sonRare('fiole', 80, 500, 160, 0.2, 'triangle', 0.04); }
      else if (e.t === 'pouvoir' && S.VOIES[e.v] && partie.joueurs[e.i]) {
        const adv = e.i === 2;
        dire((adv ? partie.adv.nom : present(e.i) ? nomJoueur(e.i) : 'Allié IA') + ' : ' + S.VOIES[e.v].pouvoir + ' !', '', 1.8);
        son(adv ? 260 : 520, adv ? 130 : 1040, 0.5, 'triangle', 0.08);
      } else if (e.t === 'coup') sonRare('coup', 90, 320, 180, 0.05, 'square', 0.012);
      else if (e.t === 'recrue' && nous) son(380, 520, 0.09, 'triangle', 0.05);
      else if (e.t === 'construit' && nous) son(240, 300, 0.15, 'square', 0.03);
      else if (e.t === 'verse' && nous) son(700, 950, 0.1, 'sine', 0.05);
      else if (e.t === 'refus' && nous && humain(e.i)) sonRare('refus', 120, 130, 100, 0.1, 'square', 0.03);
      else if (e.t === 'appel' && nous) son(600, 620, 0.2, 'triangle', 0.06);
      else if (e.t === 'assaut') {
        dire(e.e ? 'Assaut ennemi !' : 'ASSAUT COMMUN !', e.e ? 'Tenez bon 10 secondes' : 'Vos soldats se déchaînent pendant 10 secondes', 2.2);
        son(220, 880, 0.6, 'sawtooth', 0.06);
      } else if (e.t === 'age') {
        dire((e.e ? partie.adv.nom + ' passe à' : 'Nous passons à') + ' l\'âge ' + AGE_DE[e.age], e.e ? 'Ses troupes et ses défenses se renforcent' : 'Soldats et défenses : ×1,4', 2.6);
        son(e.e ? 300 : 440, e.e ? 150 : 1320, 0.8, 'triangle', 0.09);
        eclats(e.e ? W - 70 : 70, 300, 60, PAL[e.age].accent, 320);
      } else if (e.t === 'fin') {
        const v = e.r === 'victoire';
        son(v ? 440 : 220, v ? 1200 : 50, 1.2, 'triangle', 0.1);
        secousse = 0.6; eclats(v ? W - 80 : 80, 420, 90, '#ff9a3c', 420);
      }
    }
    partie.evts.length = 0;
  }

  // --- Interface ------------------------------------------------------------------
  function bouton(x, y, w, h, s, f, sous) {
    const sur = zone(x, y, w, h, f);
    rect(x, y, w, h, 14, sur ? '#4a5a52' : '#2c3531', sur ? '#9fd16b' : '#5d6b62', 3);
    texte(s, x + w / 2, y + h / 2 - (sous ? 11 : 0), 24, '#fff', 'center', true, w - 20);
    if (sous) texte(sous, x + w / 2, y + h / 2 + 17, 15, '#c5cfc8', 'center', false, w - 20);
  }
  function icone(a, x, y, i) {
    const P = PAL[partie.camps[0].age];
    const sp = partie.spes[i];
    if ((a === 'special' || a === 'pouvoir') && !sp) { g.strokeStyle = '#9aa39d'; g.lineWidth = 4; g.beginPath(); g.arc(x, y - 5, 9, Math.PI, 0); g.stroke(); rect(x - 14, y - 5, 28, 22, 4, '#9aa39d'); return; }
    if (a === 'special') a = S.VOIES[sp].unite;
    if (a === 'pouvoir') {
      const c = COULV[sp];
      if (sp === 'guerre') poly(c, x - 18, y + 16, x - 18, y - 16, x - 8, y - 2, x, y - 20, x + 8, y - 2, x + 18, y - 16, x + 18, y + 16);
      else if (sp === 'rempart') { g.beginPath(); g.ellipse(x, y + 16, 20, 34, 0, Math.PI, 0); g.fillStyle = 'rgba(143,184,232,.4)'; g.fill(); g.strokeStyle = c; g.lineWidth = 4; g.stroke(); }
      else if (sp === 'or') { rond(c, x - 8, y + 8, 11); rond(c, x + 9, y + 8, 11); rond('#fff1b0', x, y - 8, 11); }
      else for (let k = 0; k < 3; k++) ligne(c, 5, x - 18 + k * 4, y - 12 + k * 12, x - 6, y - 17 + k * 12, x + 6, y - 8 + k * 12, x + 18 - k * 4, y - 13 + k * 12);
      return;
    }
    if (S.UNITES[a]) {
      const k = a === 'colosse' ? 0.5 : a === 'cavalier' ? 0.58 : a === 'etendard' ? 0.5 : 0.8;
      g.save(); g.translate(x - 4, y + 26); g.scale(k, k); g.translate(0, -yVoie(0));
      soldat({ id: 0, x: 0, voie: 0, type: a, equipe: 0, prop: i, pv: 1, max: 1, frappe: 0, touche: 0 }, 0);
      g.restore();
    } else if (a === 'assaut') poly('#ffd04a', x - 4, y - 22, x + 12, y - 22, x + 3, y - 5, x + 14, y - 5, x - 8, y + 24, x - 1, y + 3, x - 12, y + 3);
    else if (a === 'baliste') { g.strokeStyle = P.metal; g.lineWidth = 4; g.beginPath(); g.arc(x - 6, y, 19, -1.2, 1.2); g.stroke(); ligne('#e9dcc0', 4, x - 18, y, x + 22, y); }
    else if (a === 'mortier') { ligne(P.metal, 15, x - 6, y + 10, x + 8, y - 10); rond('#1d1a18', x + 14, y - 18, 7); rond('#555', x - 8, y + 14, 8); }
    else if (a === 'barricade') { for (let k = 0; k < 4; k++) poly(k % 2 ? P.pierre : P.metal, x - 24 + k * 12, y + 20, x - 17 + k * 12, y - 20, x - 10 + k * 12, y + 20); }
    else if (a === 'mine') { rond('#e5b93c', x, y, 19); rond('#f8db74', x, y, 13); texte('+', x, y + 1, 24, '#8a6511', 'center', true); }
    else if (a === 'age') poly(P.accent, x, y - 22, x + 20, y, x + 8, y, x + 8, y + 20, x - 8, y + 20, x - 8, y, x - 20, y);
  }
  function panneau(i) {
    const x0 = 14 + i * 793, y0 = 598, w = 779, j = partie.joueurs[i], C = COUL.j[i], hum = humain(i);
    rect(x0, y0, w, 294, 16, 'rgba(24,27,25,.95)', C, 3);
    texte(present(i) ? nomJoueur(i) : 'Allié IA', x0 + 18, y0 + 27, 23, C, 'left', true);
    rond('#e5b93c', x0 + 150, y0 + 26, 11);
    texte(Math.floor(j.or) + '', x0 + 168, y0 + 27, 24, refus[i] > 0 ? '#ff7766' : '#ffe08a', 'left', true);
    texte('+' + partie.revenu(j).toFixed(1).replace('.', ',') + '/s', x0 + 238, y0 + 28, 16, '#c9c2a8');
    texte(partie.compte(i) + '/' + S.MAX_UNITES[i] + ' soldats', x0 + 318, y0 + 28, 16, '#c9c2a8');
    texte(titre(partie.talents[i]), x0 + 430, y0 + 28, 17, COULV[partie.spes[i]] || '#c9c2a8', 'left', !!partie.spes[i], 135);
    texte(hum ? (enLigne() ? 'ZQSD ou flèches + Espace' : i === 0 ? 'ZQSD + Espace' : 'Flèches + Entrée') : present(i) ? 'En ligne' : 'Joue tout seul', x0 + w - 18, y0 + 28, 15, '#9aa39d', 'right');
    S.ACTIONS.forEach((a, k) => {
      const bw = 122, bh = 98, x = x0 + 12 + (k % 6) * 126.6, y = y0 + 50 + Math.floor(k / 6) * 104;
      const b = partie.blocage(i, a), prix = partie.cout(i, a), non = b && b !== '…';
      const sel = hum && curseur[i] === k;
      if (hum) zone(x, y, bw, bh, () => { curseur[i] = k; agir(i, a); });
      const appelAutre = a === 'assaut' && partie.joueurs[1 - i].appel > 0 && j.appel <= 0;
      rect(x, y, bw, bh, 10, appelAutre && Math.sin(performance.now() / 90) > 0 ? '#7a5d16' : non ? '#232725' : '#34403a', sel ? '#fff' : '#48544d', sel ? 4 : 1.5);
      g.save(); if (non) g.globalAlpha = 0.45; icone(a, x + 26, y + 54, i); g.restore();
      texte(nomAction(a, i), x + 8, y + 18, 16, non ? '#9aa39d' : COULV[(a === 'special' || a === 'pouvoir') && partie.spes[i]] || '#fff', 'left', true, bw - 16);
      if (prix > 0) texte(prix + ' or', x + 54, y + 44, 16, j.or >= prix ? '#ffe08a' : '#e07a66', 'left', true);
      let info = '';
      if (a in j.def) info = j.def[a] + '/' + partie.maxDef(i, a);
      else if (a === 'mine') info = j.mines + '/6';
      else if (a === 'age') { const c = partie.coutAge(0); info = c === null ? '' : Math.floor(partie.camps[0].fonds) + '/' + c; }
      else if (S.UNITES[a]) info = partie.compte(i, a) || '';
      else if (a === 'special' && partie.spes[i]) info = partie.compte(i, S.VOIES[partie.spes[i]].unite) || '';
      else if (a === 'pouvoir' && partie.spes[i] && !b) info = 'Prêt !';
      if (non && b !== 'Pas assez d\'or') info = b;
      if (appelAutre) info = 'Répondez !';
      texte(info + '', x + 54, y + (a === 'assaut' || a === 'pouvoir' ? 50 : 66), 14, appelAutre || info === 'Prêt !' ? '#ffd04a' : '#aab5ae', 'left', false, 64);
      if (a === 'assaut') jauge(x + 54, y + 72, 60, 8, partie.camps[0].jauge / 100, '#ffd04a');
      if (a === 'age' && partie.coutAge(0)) jauge(x + 54, y + 82, 60, 8, partie.camps[0].fonds / partie.coutAge(0), PAL[partie.camps[0].age].accent);
    });
    texte(hum ? texteAction(S.ACTIONS[curseur[i]], i) : present(i) ? 'Votre ami décide ici. L\'or de chacun est séparé.' : 'Il économise, recrute, défend et répond à vos assauts.', x0 + 18, y0 + 273, 17, '#d8dfd9', 'left', false, w - 36);
  }
  function bandeau() {
    for (const e of [0, 1]) {
      const c = partie.camps[e], x = e ? W - 474 : 14;
      rect(x, 10, 460, 74, 12, 'rgba(18,20,22,.75)');
      texte(e ? partie.adv.nom + ', ' + partie.adv.titre : 'Notre forteresse', x + 16, 30, 19, e ? '#ff9aa0' : '#bff0e6', 'left', true, 250);
      texte('Âge ' + (c.age + 1) + '/5 : ' + S.AGES[c.age], x + 446, 30, 17, PAL[c.age].accent, 'right', true);
      jauge(x + 14, 46, 432, 16, c.pv / c.max, e ? COUL.j[2] : COUL.j[0]);
      texte(Math.min(Math.ceil(c.pv), Math.round(c.max)) + ' / ' + Math.round(c.max), x + 230, 55, 13, '#fff', 'center', true);
      const ca = partie.coutAge(e);
      if (ca) jauge(x + 14, 68, 432, 7, c.fonds / ca, PAL[c.age].accent);
    }
    const m = Math.floor(partie.t / 60), s = Math.floor(partie.t % 60), n = partie.nuit();
    rect(540, 10, 520, 82, 12, 'rgba(18,20,22,.45)');
    texte(m + ':' + (s < 10 ? '0' : '') + s, 800, 28, 28, '#fff', 'center', true);
    texte(n > 0 ? 'Pluie de cendres : les murs s\'effritent' : 'Adversaire ' + partie.niveau + '  ·  Morts ' + sauve.morts, 800, 55, 16, n > 0 ? '#ffb09a' : '#e8e2d4', 'center', n > 0);
    texte('Échap pause · V vitesse ×' + vitesse + ' · M son ' + (sauve.muet ? 'coupé' : 'actif'), 800, 78, 14, 'rgba(255,255,255,.85)', 'center');
  }
  function voile(o) { g.fillStyle = 'rgba(10,9,9,' + o + ')'; g.fillRect(0, 0, W, H); }

  function ecranTitre(t) {
    decor(t); voile(0.5);
    texte('CENDRES ET REMPARTS', 800, 150, 78, '#ffe3b0', 'center', true);
    texte('Deux alliés, un château à faire tomber. Chaque défaite vous rend plus forts.', 800, 220, 25, '#eee', 'center');
    const a = S.adversaire(sauve.niveau);
    texte('Prochain adversaire : n° ' + sauve.niveau + ', ' + a.nom + ', ' + a.titre, 800, 285, 24, '#ff9aa0', 'center', true);
    texte('Morts : ' + sauve.morts + '  ·  ' + [0, 1].map(i => COUL.nom[i] + ' : ' + titre(sauve.talents[i]) + ' (' + S.points(sauve.talents[i]) + ')').join('  ·  '), 800, 320, 19, '#ccc', 'center');
    bouton(560, 355, 480, 72, 'Jouer en ligne avec un ami', () => ouvrirSalon(), 'Chacun sur son PC, avec un code');
    bouton(560, 435, 480, 72, 'Jouer à deux ici', () => lancerSelon(false), 'Même écran : ZQSD + Espace et Flèches + Entrée');
    bouton(560, 515, 480, 72, 'Jouer seul avec un allié IA', () => lancerSelon(true), 'ZQSD + Espace, ou la souris');
    bouton(640, 598, 320, 42, confirmer > 0 ? 'Vraiment tout effacer ?' : 'Recommencer à zéro', () => {
      if (confirmer > 0) { sauve = Object.assign(neuf(), { muet: sauve.muet }); garder(); confirmer = 0; } else confirmer = 3;
    });
    ['Soldats : lancier bat cavalier, cavalier bat archer, archer bat lancier. Le colosse brise les châteaux.',
      'Chacun a son or. Les mines rapportent, le pot commun fait monter tout le monde en âge.',
      'Après chaque combat, chacun place ses points : 4 dans une voie ouvrent sa spécialité (unité et pouvoir uniques).',
      'Après 3 min 30, la pluie de cendres ronge les deux châteaux : le plus abîmé tombe le premier.',
    ].forEach((s, k) => texte(s, 800, 680 + k * 36, 20, '#e6e0d2', 'center'));
    texte('M : couper ou remettre le son', 800, 840, 17, '#bbb', 'center');
  }
  function valeur(k, n) {
    const T = S.TALENTS[k];
    return !T.pas ? (n ? 'acquis' : 'non') : T.brut ? '+' + n * T.pas : '+' + Math.round(n * T.pas * 100) + ' %';
  }
  function ecranChoix(t) {
    decor(t); voile(0.78);
    const res = sauve.resultat, v = res === 'victoire', fini = choixFini(), a = S.adversaire(sauve.niveau);
    texte(v ? 'VICTOIRE !' : res ? 'LE CHÂTEAU EST TOMBÉ' : 'VOS TALENTS', 800, 46, 46, v ? '#bff0a0' : res ? '#ff9a8a' : '#ffe3b0', 'center', true);
    texte(fini ? 'Prochain combat : n° ' + sauve.niveau + ', ' + a.nom + ', ' + a.titre + '. ' + a.desc : 'Placez vos points, pour toujours. 4 points dans une voie ouvrent sa spécialité : une seule par joueur.', 800, 88, 20, '#eee', 'center', false, 1540);
    [0, 1].forEach(i => {
      const nom = present(i) ? nomJoueur(i) : 'Allié IA', tal = sauve.talents[i];
      texte(nom + ' · ' + titre(tal) + (sauve.choix[i] > 0 && present(i) ? ' · ' + sauve.choix[i] + (sauve.choix[i] > 1 ? ' points à placer' : ' point à placer') : present(i) ? ' · prêt' : ''), i ? 1568 : 32, 118, 20, COUL.j[i], i ? 'right' : 'left', true, 560);
    });
    const cleAl = S.alliance(sauve.talents[0], sauve.talents[1]), al = S.ALLIANCES[cleAl];
    texte(al ? 'Alliance « ' + al.nom + ' » : ' + al.texte : 'Deux spécialités = un bonus d\'alliance', 800, 118, 17, al ? '#ffd04a' : '#95a099', 'center', !!al, 420);
    Object.keys(S.VOIES).forEach((vo, c) => {
      const x = 32 + c * 388;
      texte(S.VOIES[vo].nom.toUpperCase(), x + 4, 156, 22, COULV[vo], 'left', true);
      [0, 1].forEach(i => texte(S.points(sauve.talents[i], vo) + ' pts', x + 300 + i * 68, 157, 17, COUL.j[i], 'right', true));
    });
    S.CLES.forEach((k, n) => {
      const T = S.TALENTS[k], w = 372, h = 98, x = 32 + (n % 4) * 388, y = 174 + Math.floor(n / 4) * 104;
      const bl = [0, 1].map(i => S.blocageTalent(sauve.talents[i], k));
      const ouvert = [0, 1].some(i => humain(i) && sauve.choix[i] > 0 && !bl[i]);
      const sur = !fini && zone(x, y, w, h, () => {
        const i = enLigne() ? moi() : sauve.choix[0] > 0 || seul() ? 0 : 1;
        curChoix[i] = n; choisir(i, n);
      });
      rect(x, y, w, h, 12, sur && ouvert ? '#3a4740' : T.rang === 3 ? '#2d2a35' : '#222825', ouvert ? COULV[T.voie] : '#3f4943', ouvert ? 2.5 : 1.5);
      if (!fini) [0, 1].forEach(i => { if (humain(i) && sauve.choix[i] > 0 && curChoix[i] === n) rect(x - 1 - i * 4, y - 1 - i * 4, w + 2 + i * 8, h + 2 + i * 8, 13, null, COUL.j[i], 4); });
      const libre = [0, 1].some(i => present(i) && (!bl[i] || sauve.talents[i][k]));
      g.save(); if (!libre) g.globalAlpha = 0.5;
      texte((T.rang === 3 ? '★ ' : '') + T.nom, x + 14, y + 24, 21, T.rang === 3 ? COULV[T.voie] : '#ffe3b0', 'left', true);
      texte(T.texte, x + 14, y + 51, 15.5, '#dfe5e0', 'left', false, w - 28);
      g.restore();
      [0, 1].forEach(i => {
        const m = sauve.talents[i][k] || 0;
        texte(m ? valeur(k, m) + (T.pas ? '  (' + m + (T.max ? '/' + T.max : '') + ')' : '') : '-', x + 14 + i * 122, y + 79, 16, m ? COUL.j[i] : '#59635d', 'left', true, 115);
      });
      if (T.rang > 1) texte(T.rang === 4 ? 'spécialité + ' + S.SEUILS[4] + ' pts' : 'dès ' + S.SEUILS[T.rang] + ' pts', x + w - 14, y + 24, 14, '#95a099', 'right');
    });
    if (!fini) {
      const hum = [0, 1].filter(i => humain(i) && sauve.choix[i] > 0);
      hum.forEach((i, l) => {
        const k = S.CLES[curChoix[i]], tal = sauve.talents[i], n = tal[k] || 0, b = S.blocageTalent(tal, k), T = S.TALENTS[k];
        texte((hum.length > 1 || !enLigne() && !seul() ? COUL.nom[i] + ' : ' : '') + T.nom + ', ' + T.texte.charAt(0).toLowerCase() + T.texte.slice(1) + (T.pas ? '  ' + valeur(k, n) + ' → ' + valeur(k, n + 1) : '') + (b ? '   [' + b + ']' : ''), 800, 718 + l * 27, 19, b ? '#ff9a8a' : COUL.j[i], 'center', true, 1520);
      });
      if (!hum.length) texte('Votre ami choisit…', 800, 718, 19, '#ccc', 'center');
      texte(enLigne() || seul() ? 'ZQSD puis Espace, ou clic. Chaque point endurcit aussi vos soldats (+4 %).' : 'Joueur 1 : ZQSD puis Espace  ·  Joueur 2 : Flèches puis Entrée  ·  au clic : Joueur 1 d\'abord. Chaque point endurcit aussi vos soldats (+4 %).', 800, 784, 17, '#bbb', 'center', false, 1540);
    } else bouton(560, 712, 480, 78, 'Au combat !', () => { if (depuis > 0.4) lancer(); }, 'Espace ou Entrée');
    bouton(660, 826, 280, 48, 'Menu', versMenu);
    [0, 1].forEach(i => {
      if (!humain(i) || !S.points(sauve.talents[i])) return;
      bouton(i && !enLigne() ? 1168 : 32, 826, 400, 48, confR[i] > 0 ? 'Confirmer : tout reprendre ?' : 'Reprendre ' + (enLigne() || seul() ? 'mes points' : 'les points du ' + COUL.nom[i].toLowerCase()), () => reorienter(i));
    });
  }

  // --- Boucle ---------------------------------------------------------------------
  let avant = performance.now(), reste = 0, horloge = 0;
  function avancer(dt) {
    horloge += dt; depuis += dt; confirmer = Math.max(0, confirmer - dt);
    refus = refus.map(v => Math.max(0, v - dt)); confR = confR.map(v => Math.max(0, v - dt)); secousse = Math.max(0, secousse - dt);
    if (ecran === 'jeu' && !pause) {
      if (mode === 'invite') partie.lisser(dt * vitesse);
      else if (!partie.fini) {
        reste += dt * vitesse;
        while (reste >= 1 / 60) { partie.pas(1 / 60); reste -= 1 / 60; }
        if (partie.fini) depuis = 0;
      }
      evenements();
      if (annonce) { annonce.t -= dt; if (annonce.t <= 0) annonce = null; }
      if (partie.fini && depuis > 2 && mode !== 'invite') finir();
    }
    photographier(dt);
    for (const q of part) { q.t -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 420 * dt; }
    part = part.filter(q => q.t > 0);
  }
  function dessiner() {
    zones = [];
    g.clearRect(0, 0, W, H);
    if (ecran === 'titre' || ecran === 'reseau') { ecranTitre(horloge); if (ecran === 'reseau') zones = []; return; }
    if (ecran === 'choix') { ecranChoix(horloge); return; }
    g.save();
    if (secousse > 0) g.translate((Math.random() - 0.5) * secousse * 30, (Math.random() - 0.5) * secousse * 30);
    decor(horloge);
    [...partie.unites].sort((a, b) => a.voie - b.voie).forEach(u => soldat(u, horloge));
    tirs(); effets(horloge);
    for (const q of part) { g.globalAlpha = Math.min(1, q.t * 2); rond(q.c, q.x, q.y, q.r); }
    g.restore();
    bandeau(); panneau(0); panneau(1);
    if (annonce && !partie.fini) {
      g.globalAlpha = Math.min(1, annonce.t * 2);
      texte(annonce.a, 800, 165, 42, '#fff4d8', 'center', true, 1400); texte(annonce.b, 800, 208, 22, '#fff', 'center', false, 1400);
      g.globalAlpha = 1;
    }
    if (partie.fini) texte(partie.fini === 'victoire' ? 'VICTOIRE !' : 'DÉFAITE', 800, 310, 90, partie.fini === 'victoire' ? '#bff0a0' : '#ff9a8a', 'center', true);
    if (pause) {
      zones = []; voile(0.65);
      texte('PAUSE', 800, 300, 80, '#fff', 'center', true);
      const paye = partie.t >= 120; // sinon on pourrait accumuler des renforts sans jouer
      bouton(600, 380, 400, 70, 'Reprendre', basculerPause);
      if (mode !== 'invite') bouton(600, 470, 400, 70, 'Abandonner ce combat', () => { pause = false; sansRenfort = !paye; partie.fini = 'defaite'; depuis = 2; }, paye ? 'Compte comme une mort, avec renfort' : 'Pas de renfort avant 2 minutes de combat');
      bouton(600, 560, 400, 70, enLigne() ? 'Quitter la partie en ligne' : 'Retour au menu', versMenu, mode === 'invite' ? 'Une IA prendra votre place' : 'Le combat en cours est perdu, sans mort ni renfort');
    }
  }
  function taille() {
    const k = Math.min(innerWidth / W, innerHeight / H);
    cv.style.width = W * k + 'px'; cv.style.height = H * k + 'px';
  }
  addEventListener('resize', taille); taille();
  function tic() {
    const n = performance.now();
    avancer(Math.max(0, Math.min(0.25, (n - avant) / 1000))); avant = n;
  }
  function boucle() { tic(); dessiner(); requestAnimationFrame(boucle); }
  // Onglet caché : le navigateur arrête l'affichage, mais la partie en ligne doit continuer.
  try {
    const w = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),50)'], { type: 'text/javascript' })));
    w.onmessage = () => { if (enLigne() && performance.now() - avant > 120) tic(); };
  } catch (e) { /* pas de tâche de fond : la partie ralentit si l'onglet est caché */ }
  addEventListener('pagehide', () => { if (net) net.fermer(); });
  requestAnimationFrame(boucle);
  // Accès pour les essais depuis la console
  window.Jeu = { get partie() { return partie; }, get sauve() { return sauve; }, get ecran() { return ecran; }, get pause() { return pause; }, get mode() { return mode; }, get ami() { return ami; }, get net() { return net; }, avancer, dessiner };
})();
