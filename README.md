# Jeu de cartes en ligne — MVP

Moteur de jeu de plis (mise + cartes spéciales à hiérarchie) jouable en ligne à
plusieurs, 100% gratuit. Thème pour l'instant (Commandant / Pirate / Sirène /
Repli / Tigresse / Butin / Baleine / Kraken / Raie Manta) — voir
`js/rules.js` (objet `THEME`) pour renommer et `css/style.css` /
`images/cards/` pour intégrer tes propres visuels de cartes.

### Cartes spéciales

- **Commandant** (1) : bat tout sauf la Sirène.
- **Pirate** (5) : bat tout sauf le Commandant.
- **Sirène** (2) : bat tout, y compris le Commandant, mais perd face au Pirate.
- **Repli** (5) : perd toujours.
- **Tigresse** (1) : au moment de la jouer, tu choisis si elle compte comme Pirate ou comme Repli.
- **Butin** (2) : ne gagne jamais le pli (drapeau blanc, comme un Repli). En le jouant, tu formes une alliance avec le joueur qui remporte ce pli : si vous réalisez tous les deux exactement votre mise à la fin de la manche, vous gagnez chacun +20 points.
- **Baleine** (1) : neutralise toutes les cartes spéciales (y compris l'atout) du pli — seule la carte numérotée la **plus haute** gagne, couleur/atout sans importance.
- **Raie Manta** (1) : comme la Baleine, mais c'est la carte numérotée la **plus basse** qui gagne.
- **Kraken** (1) : annule complètement le pli — personne ne le gagne, personne ne marque dessus. Le joueur qui aurait normalement gagné débute le pli suivant.
- Si Baleine/Raie Manta/Kraken sont jouées dans le même pli, seule la **dernière** jouée fait effet (les précédentes sont annulées).

## 1. Créer ton projet Firebase (gratuit)

1. Va sur https://console.firebase.google.com et connecte-toi avec un compte Google.
2. "Ajouter un projet" → donne-lui un nom → suivant → tu peux désactiver Google Analytics (pas nécessaire).
3. Une fois le projet créé, dans le menu de gauche : **Créer une base de données** → **Firestore Database** → "Créer une base de données" → mode **production** → choisis une région proche (ex. `europe-west1`).
4. Toujours dans Firestore, onglet **Règles**, remplace le contenu par :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomCode} {
      allow read, write: if true;
    }
  }
}
```

   ⚠️ Ces règles sont ouvertes (n'importe qui connaissant le code de salle peut
   lire/écrire) — largement suffisant pour jouer entre amis, mais ne mets
   aucune donnée sensible dans les salles.

5. Retourne dans **Paramètres du projet** (roue dentée) → onglet **Général** →
   section "Vos applications" → clique l'icône **Web `</>`** → donne un nom à
   l'app → "Enregistrer l'application". Firebase t'affiche un objet
   `firebaseConfig`.
6. Copie ces valeurs dans [`js/firebase-config.js`](js/firebase-config.js) à la
   place des `REMPLACE_MOI`.

## 2. Lancer en local

Depuis ce dossier :

```bash
python3 serve.py
```

Puis ouvre `http://localhost:8767` dans ton navigateur.

## 3. Héberger gratuitement pour jouer avec tes amis

Le plus simple : [Firebase Hosting](https://firebase.google.com/docs/hosting)
(gratuit) ou [GitHub Pages](https://pages.github.com/) (gratuit aussi). Les
deux donnent un lien `https://...` que tu peux partager — ça marche pareil sur
Android et iOS puisque c'est une page web.

## Limites du MVP actuel

- Mise, plis, hiérarchie des cartes spéciales (+ Butin/Baleine/Raie Manta/Kraken),
  bonus 14, captures et alliances sont implémentés. Les pouvoirs de personnage
  individuels du livret (ex. piocher 2 cartes, regarder les cartes non
  distribuées...) et les variantes de comptage alternatives ne sont pas
  implémentés.
- Le créateur de la salle doit garder son onglet ouvert pendant la partie :
  c'est son navigateur qui arbitre les transitions (fin de mise, résolution
  d'un pli, manche suivante).
- Pas de reconnexion automatique si un joueur ferme l'onglet en pleine manche
  (son `playerId` est gardé dans le navigateur, donc revenir sur le même lien
  le remet dans la salle, mais son tour ne sera pas rejoué automatiquement).

## Important — ce que je n'ai pas reproduit

Les photos de règles que tu m'as montrées sont celles d'un jeu physique publié
dans le commerce. Je n'ai utilisé ni son nom, ni les noms de ses personnages,
ni ses illustrations : le thème ci-dessus est générique et à toi de le
personnaliser avec ton propre visuel/nom si tu veux t'en éloigner davantage.
