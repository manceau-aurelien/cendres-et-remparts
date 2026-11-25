// Connexion directe entre deux navigateurs (WebRTC), sans bibliothèque.
// La mise en relation par code court passe par le service public ntfy.sh, en messages chiffrés ;
// l'échange manuel de codes longs s'en passe complètement.
(function () {
  'use strict';
  const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }] };
  const COURTIER = 'https://ntfy.sh/';
  const LETTRES = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans I, L, O, 0, 1
  const SILENCE = 12000, DELAI = 25000;
  const alea = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), v => LETTRES[v % LETTRES.length]).join('');

  // Le code donne, par dérivation lente, le nom du canal et la clé de chiffrement :
  // le service ne voit ni le code, ni les adresses des joueurs contenues dans les messages.
  async function derive(code) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
    const b = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode('cendres-et-remparts'), iterations: 250000 }, base, 384));
    return {
      canal: 'cer' + Array.from(b.slice(0, 16), v => v.toString(16).padStart(2, '0')).join(''),
      cle: await crypto.subtle.importKey('raw', b.slice(16), 'AES-GCM', false, ['encrypt', 'decrypt']),
    };
  }
  async function chiffrer(cle, o) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, new TextEncoder().encode(JSON.stringify(o))));
    let t = ''; for (const v of iv) t += String.fromCharCode(v); for (const v of c) t += String.fromCharCode(v);
    return btoa(t);
  }
  async function dechiffrer(cle, t) {
    const b = Uint8Array.from(atob(t), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, cle, b.slice(12))));
  }
  const alleger = sdp => sdp.split('\r\n').filter(l => !/^a=candidate:.* tcp /i.test(l)).join('\r\n');

  // ev : { code, ouvert, message, ferme, erreur, occupe }
  function creer(ev) {
    let flux = null, secret = null, pc = null, dc = null, fini = false, hote = false, vu = 0, minuteur = 0, essai = 0;
    const jeton = alea(10); // distingue les deux joueurs sur le canal
    const vivant = () => !!dc && dc.readyState === 'open';

    function poster(o) {
      if (!vivant() || dc.bufferedAmount > 300000) return false;
      try { dc.send(JSON.stringify(o)); return true; } catch (e) { return false; }
    }
    function brancher(d, p) {
      d.onopen = () => {
        if (fini || p !== pc) return;
        dc = d; vu = Date.now(); clearTimeout(essai);
        ev.ouvert();
      };
      d.onmessage = m => {
        if (fini || d !== dc) return;
        vu = Date.now();
        let o; try { o = JSON.parse(m.data); } catch (e) { return; }
        if (!o || o.t === 'ping') return;
        ev.message(o);
      };
      d.onclose = () => { if (d === dc) perdu(); };
    }
    function perdu() {
      if (!dc) return;
      const d = dc, p = pc; dc = null; pc = null;
      try { d.close(); } catch (e) { /* déjà fermé */ }
      try { p && p.close(); } catch (e) { /* déjà fermé */ }
      if (!fini) ev.ferme();
    }
    function nouveauPc() {
      if (pc) try { pc.close(); } catch (e) { /* déjà fermé */ }
      const p = pc = new RTCPeerConnection(ICE);
      p.ondatachannel = e => brancher(e.channel, p);
      p.onconnectionstatechange = () => {
        if (p !== pc || p.connectionState !== 'failed') return;
        if (dc) perdu(); else if (!hote) ev.erreur('Les deux box refusent la connexion directe. Essayez un autre réseau (partage de connexion du téléphone, par exemple).');
      };
      return p;
    }
    const glace = p => new Promise(ok => {
      if (p.iceGatheringState === 'complete') return ok();
      const t = setTimeout(ok, 3000);
      p.addEventListener('icegatheringstatechange', () => { if (p.iceGatheringState === 'complete') { clearTimeout(t); ok(); } });
    });
    async function offre() {
      const p = nouveauPc();
      brancher(p.createDataChannel('jeu'), p);
      await p.setLocalDescription(await p.createOffer());
      await glace(p);
      return { type: 'offer', sdp: alleger(p.localDescription.sdp) };
    }
    async function reponse(o) {
      const p = nouveauPc();
      await p.setRemoteDescription({ type: 'offer', sdp: String(o.sdp) });
      await p.setLocalDescription(await p.createAnswer());
      await glace(p);
      return { type: 'answer', sdp: alleger(p.localDescription.sdp) };
    }

    // --- Mise en relation par code court ----------------------------------
    async function courtier(code, surOuverture, surMessage) {
      try { secret = await derive(code); } catch (e) { ev.erreur('Ce navigateur ne permet pas le chiffrement. Utilisez l\'échange manuel.'); return; }
      if (fini) return;
      const f = flux = new EventSource(COURTIER + secret.canal + '/sse');
      let pret = false;
      const alarme = setTimeout(() => { if (!pret && !fini && !vivant()) ev.erreur('Service de mise en relation injoignable. Utilisez l\'échange manuel.'); }, 12000);
      f.onopen = () => { if (pret || fini) return; pret = true; clearTimeout(alarme); surOuverture(); };
      f.onmessage = async m => { // après une coupure, EventSource se reconnecte tout seul
        if (fini) return;
        let o;
        try { o = await dechiffrer(secret.cle, JSON.parse(m.data).message); } catch (e) { return; }
        if (!o || o.de === jeton || (o.pour && o.pour !== jeton)) return;
        surMessage(o);
      };
    }
    async function signaler(type, pour, payload) {
      if (!secret || fini) return;
      const corps = await chiffrer(secret.cle, { type, de: jeton, pour, payload });
      const rep = await fetch(COURTIER + secret.canal + '?cache=no&firebase=no', { method: 'POST', body: corps });
      if (!rep.ok) throw new Error('service ' + rep.status);
    }

    minuteur = setInterval(() => {
      if (vivant()) { if (Date.now() - vu > SILENCE) perdu(); else poster({ t: 'ping' }); }
    }, 3000);

    return {
      vivant, poster,
      heberger() {
        hote = true;
        const code = alea(6);
        courtier(code, () => ev.code(code), async o => {
          if (o.type !== 'offre' || !o.de || !o.payload) return;
          try { await signaler('reponse', o.de, vivant() ? { occupe: true } : await reponse(o.payload)); } catch (e) { console.warn('offre ignorée', e); }
        });
      },
      rejoindre(code) {
        essai = setTimeout(() => { if (!vivant() && !fini) ev.erreur('Pas de réponse. Vérifiez le code, et que la partie est bien ouverte chez votre ami.'); }, DELAI);
        courtier(code, async () => {
          let o;
          try { o = await offre(); } catch (e) { ev.erreur('Connexion directe impossible dans ce navigateur.'); return; }
          try { await signaler('offre', '', o); } catch (e) { ev.erreur('Service de mise en relation injoignable. Utilisez l\'échange manuel.'); }
        }, async o => {
          if (o.type !== 'reponse' || !o.payload) return;
          if (o.payload.occupe) return ev.erreur('Cette partie a déjà deux joueurs.');
          if (!pc || pc.signalingState !== 'have-local-offer') return;
          try { await pc.setRemoteDescription({ type: 'answer', sdp: String(o.payload.sdp) }); } catch (e) { ev.erreur('Réponse illisible.'); }
        });
      },
      // --- Échange manuel : aucun service de mise en relation ---------------
      async inviter() { hote = true; return btoa(JSON.stringify(await offre())); },
      async accepter(texte) { return btoa(JSON.stringify(await reponse(JSON.parse(atob(texte.trim()))))); },
      async conclure(texte) { await pc.setRemoteDescription({ type: 'answer', sdp: String(JSON.parse(atob(texte.trim())).sdp) }); },
      fermer() {
        poster({ t: 'adieu' });
        fini = true; clearInterval(minuteur); clearTimeout(essai);
        const d = dc, p = pc, s = flux; dc = pc = flux = null;
        setTimeout(() => { for (const x of [d, p, s]) try { x && x.close(); } catch (e) { /* déjà fermé */ } }, 150);
      },
    };
  }
  window.Reseau = { creer };
})();
