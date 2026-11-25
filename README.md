# Cendres et Remparts

Jeu de guerre de châteaux incrémental, à deux contre une IA : en ligne, sur le même écran, ou seul avec un allié IA.

Envoyez des soldats, bâtissez des défenses, économisez pour passer d'âge en âge. À chaque mort, chacun choisit un renfort permanent.

## Jouer

Ouvrir `Cendres-et-Remparts.html` dans Chrome ou Edge. Rien à installer.

| | Se déplacer | Valider |
|---|---|---|
| Joueur 1 | ZQSD | Espace |
| Joueur 2 | Flèches | Entrée |

La souris marche aussi. Échap : pause. V : vitesse. M : son.

## En ligne

Un joueur crée la partie et donne le code à 6 caractères, l'autre le rejoint. Les deux navigateurs se connectent directement (WebRTC). La mise en relation passe par ntfy.sh en messages chiffrés, et des serveurs STUN de Google et Cloudflare aident à établir la connexion. Un échange manuel, sans ntfy.sh, est proposé en secours.

## Fichiers

- `sim.js` : règles, combat et IA, sans affichage
- `reseau.js` : connexion entre les deux navigateurs
- `jeu.js`, `index.html` : affichage, commandes, salon en ligne
- `assembler.js` : `node assembler.js` régénère `Cendres-et-Remparts.html`
- `equilibrage.js` : `node equilibrage.js` fait jouer des campagnes à des bots
