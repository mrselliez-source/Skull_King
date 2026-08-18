# Tes visuels de cartes

Dépose ici tes fichiers image (`.png`, idéalement avec un fond, format portrait
type carte à jouer — 300×440px ou toute résolution avec ce ratio ~1:1.47 fonctionne).
Dès qu'un fichier est présent avec le bon nom, il remplace automatiquement le
rendu par défaut (rectangle coloré + texte) — pas besoin de toucher au code.
Une carte sans image garde le rendu par défaut, tu peux donc avancer petit à petit.

## Convention de noms

**Cartes de couleur** (1 à 14, dans chacune des 4 familles) :

```
GREEN-1.png  ... GREEN-14.png   (Vert)
PURPLE-1.png ... PURPLE-14.png  (Violet)
YELLOW-1.png ... YELLOW-14.png  (Jaune)
BLACK-1.png  ... BLACK-14.png   (Noir = l'atout)
```

**Cartes spéciales** (une image par type, peu importe le nombre d'exemplaires
dans le jeu) :

```
COMMANDER.png    (bat tout sauf la Sirène)
RAIDER.png       (Pirate : bat tout sauf Commandant — 5 exemplaires)
ENCHANTRESS.png  (Sirène : bat tout, y compris Commandant — 2 exemplaires)
RETREAT.png      (perd toujours — 5 exemplaires)
WILDCARD.png     (Tigresse : au choix Pirate ou Repli au moment de jouer)
LOOT.png         (Butin : forme une alliance avec le vainqueur du pli — 2 exemplaires)
WHALE.png        (Baleine : neutralise les spéciales, seule la carte la plus haute gagne)
KRAKEN.png       (annule complètement le pli)
MANTA.png        (Raie Manta : comme la Baleine, mais la carte la plus basse gagne)
```

**Un visuel différent par exemplaire (optionnel)** : pour les types à plusieurs
copies (Pirate ×5, Sirène ×2, Repli ×5, Butin ×2), tu peux donner un visuel
distinct à chaque exemplaire en numérotant : `ENCHANTRESS-1.png`,
`ENCHANTRESS-2.png`, `RAIDER-1.png` ... `RAIDER-5.png`, etc. S'il manque un
numéro, cet exemplaire retombe automatiquement sur le visuel générique
(`ENCHANTRESS.png`), donc pas besoin de tout faire d'un coup.

**Dos de carte** (utilisé pour les mains des adversaires et toute carte
retournée) :

```
back.png
```

## Renommer les familles/personnages

Si tu changes les noms dans `js/rules.js` (objet `THEME`), les noms de
fichiers doivent suivre les clés que tu utilises là-bas (`GREEN`, `PURPLE`, etc.
et `COMMANDER`, `RAIDER`...), pas les libellés affichés.
