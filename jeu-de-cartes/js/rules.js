// Moteur de jeu générique : plis + mise + hiérarchie de cartes spéciales.
// Thème neutre et volontairement générique (pas de noms/marque d'un jeu existant) —
// personnalisable via THEME plus bas.

const THEME = {
  suits: {
    GREEN: { label: 'Vert', trump: false },
    PURPLE: { label: 'Violet', trump: false },
    YELLOW: { label: 'Jaune', trump: false },
    BLACK: { label: 'Atout', trump: true },
  },
  // Hiérarchie: COMMANDER bat tout sauf ENCHANTRESS. RAIDER bat tout sauf
  // COMMANDER. ENCHANTRESS bat tout (numérotées + COMMANDER) mais perd face à
  // RAIDER. RETREAT et LOOT perdent toujours (comme un drapeau blanc). WILDCARD
  // choisit RAIDER ou RETREAT au moment de jouer.
  // LOOT ne gagne donc jamais le pli, mais forme une alliance avec le joueur qui
  // le remporte (bonus si les deux réalisent exactement leur mise en fin de manche).
  // KRAKEN / WHALE / MANTA sont des cartes "perturbatrices" : si plusieurs sont
  // jouées dans le même pli, seule la DERNIÈRE jouée fait effet (les autres sont
  // annulées). KRAKEN annule le pli (personne ne le gagne). WHALE neutralise
  // toutes les cartes spéciales : seule la carte numérotée la PLUS HAUTE gagne,
  // couleur/atout sans importance. MANTA fait pareil mais la carte la PLUS
  // BASSE gagne.
  specialCounts: {
    COMMANDER: 1,
    RAIDER: 5,
    ENCHANTRESS: 2,
    RETREAT: 5,
    WILDCARD: 1,
    LOOT: 2,
    WHALE: 1,
    KRAKEN: 1,
    MANTA: 1,
  },
  specialLabels: {
    COMMANDER: 'Commandant',
    RAIDER: 'Pirate',
    ENCHANTRESS: 'Sirène',
    RETREAT: 'Repli',
    WILDCARD: 'Tigresse',
    LOOT: 'Butin',
    WHALE: 'Baleine',
    KRAKEN: 'Kraken',
    MANTA: 'Raie Manta',
  },
};

const DISRUPTOR_TYPES = ['KRAKEN', 'WHALE', 'MANTA'];
const isRaiderTier = (effectiveType) => effectiveType === 'RAIDER';
// RETREAT et LOOT ne remportent jamais un pli (drapeau blanc), quoi qu'il arrive.
const neverWins = (effectiveType) => effectiveType === 'RETREAT' || effectiveType === 'LOOT';

const SUIT_KEYS = Object.keys(THEME.suits);
const NUMBERED_MIN = 1;
const NUMBERED_MAX = 14;

function buildDeck() {
  const deck = [];
  for (const suit of SUIT_KEYS) {
    for (let n = NUMBERED_MIN; n <= NUMBERED_MAX; n++) {
      deck.push({ kind: 'NUMBERED', suit, value: n, id: `${suit}-${n}` });
    }
  }
  let specialIdx = 0;
  for (const [type, count] of Object.entries(THEME.specialCounts)) {
    for (let i = 0; i < count; i++) {
      deck.push({ kind: 'SPECIAL', type, id: `${type}-${i}-${specialIdx++}` });
    }
  }
  return deck;
}

function shuffle(array, rng = Math.random) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Nombre de manches jouables (10 normalement, réduit si le deck ne suffit pas pour beaucoup de joueurs)
function maxRounds(numPlayers) {
  const deckSize = buildDeck().length; // 70
  return Math.min(10, Math.floor(deckSize / numPlayers));
}

function cardsForRound(round, numPlayers) {
  const cap = maxRounds(numPlayers);
  return Math.min(round, cap);
}

function dealHands(deck, playerIds, cardsPerPlayer) {
  const shuffled = shuffle(deck);
  const hands = {};
  playerIds.forEach((id) => (hands[id] = []));
  let cursor = 0;
  for (let c = 0; c < cardsPerPlayer; c++) {
    for (const id of playerIds) {
      hands[id].push(shuffled[cursor++]);
    }
  }
  return hands;
}

function cardLabel(card) {
  if (card.kind === 'SPECIAL') return THEME.specialLabels[card.type];
  return `${THEME.suits[card.suit].label} ${card.value}`;
}

// Règle de suivi de couleur : seules les cartes numérotées imposent la couleur.
// Les cartes spéciales peuvent toujours être jouées.
function legalPlays(hand, trick) {
  if (trick.length === 0) return hand;
  const ledCard = trick[0].card;
  if (ledCard.kind !== 'NUMBERED') return hand; // rien à suivre si un spécial a ouvert
  const ledSuit = ledCard.suit;
  const hasSuit = hand.some((c) => c.kind === 'NUMBERED' && c.suit === ledSuit);
  if (!hasSuit) return hand;
  return hand.filter((c) => c.kind === 'SPECIAL' || c.suit === ledSuit);
}

// Résolution "normale" (hiérarchie + numérotées/atout), sans tenir compte des
// cartes perturbatrices (KRAKEN/WHALE/MANTA) qui sont gérées séparément.
// effectiveList/playsList doivent avoir le même ordre et la même longueur.
function resolveNormal(effectiveList, playsList) {
  const has = (pred) => effectiveList.some(pred);
  const firstMatching = (pred) => effectiveList.find(pred);

  const hasCommander = has((p) => p.effectiveType === 'COMMANDER');
  const hasRaiderTier = has((p) => isRaiderTier(p.effectiveType));
  const hasEnchantress = has((p) => p.effectiveType === 'ENCHANTRESS');

  if (hasCommander && hasRaiderTier && hasEnchantress) return firstMatching((p) => p.effectiveType === 'ENCHANTRESS');
  if (hasEnchantress && hasRaiderTier) return firstMatching((p) => isRaiderTier(p.effectiveType));
  if (hasEnchantress) return firstMatching((p) => p.effectiveType === 'ENCHANTRESS');
  if (hasCommander) return firstMatching((p) => p.effectiveType === 'COMMANDER');
  if (hasRaiderTier) return firstMatching((p) => isRaiderTier(p.effectiveType));

  // Que des cartes numérotées et/ou des drapeaux blancs (Repli/Butin).
  const contenders = effectiveList.filter((p) => !neverWins(p.effectiveType));
  if (contenders.length === 0) return effectiveList[0]; // tout le monde a fui, le premier gagne

  // La couleur à suivre est celle de la première carte NUMEROTEE jouée
  // (une carte spéciale en tête, ex. un joker-repli, ne fixe pas de couleur).
  const firstNumbered = playsList.find((p) => p.card.kind === 'NUMBERED');
  const ledSuit = firstNumbered ? firstNumbered.card.suit : null;
  const trumpPlays = contenders.filter((p) => p.card.kind === 'NUMBERED' && THEME.suits[p.card.suit].trump);
  const pool = trumpPlays.length > 0
    ? trumpPlays
    : contenders.filter((p) => p.card.kind === 'NUMBERED' && p.card.suit === ledSuit);
  return pool.length > 0
    ? pool.reduce((best, p) => (p.card.value > best.card.value ? p : best), pool[0])
    : effectiveList[0];
}

// plays: [{ playerId, card, wildAs }] wildAs = 'RAIDER' | 'RETREAT' si WILDCARD joué
function resolveTrick(plays) {
  const effective = plays.map((p) => {
    if (p.card.kind === 'SPECIAL' && p.card.type === 'WILDCARD' && p.wildAs) {
      return { ...p, effectiveType: p.wildAs };
    }
    return { ...p, effectiveType: p.card.kind === 'SPECIAL' ? p.card.type : null };
  });

  // Cartes perturbatrices : "anciennes ennemies" — si plusieurs sont jouées dans
  // le même pli, seule la DERNIÈRE jouée fait effet, les autres sont annulées.
  const disruptorPlays = effective.filter((p) => DISRUPTOR_TYPES.includes(p.effectiveType));
  const governingType = disruptorPlays.length > 0 ? disruptorPlays[disruptorPlays.length - 1].effectiveType : null;
  const disruptorPlayerIds = new Set(disruptorPlays.map((p) => p.playerId));

  let winner;
  let voided = false;

  if (governingType === 'KRAKEN') {
    voided = true;
    // Le pli est annulé, mais on calcule qui l'aurait normalement emporté (sans
    // aucune perturbatrice) : c'est ce joueur qui débute le pli suivant.
    const withoutDisruptors = effective.filter((p) => !disruptorPlayerIds.has(p.playerId));
    const playsWithoutDisruptors = plays.filter((p) => !disruptorPlayerIds.has(p.playerId));
    winner = withoutDisruptors.length > 0
      ? resolveNormal(withoutDisruptors, playsWithoutDisruptors)
      : effective[0];
  } else if (governingType === 'WHALE' || governingType === 'MANTA') {
    // Neutralise toutes les cartes spéciales : seule la carte numérotée la plus
    // haute (WHALE) ou la plus basse (MANTA) gagne, couleur/atout sans importance.
    const numberedPlays = effective.filter((p) => p.card.kind === 'NUMBERED');
    if (numberedPlays.length > 0) {
      winner = governingType === 'WHALE'
        ? numberedPlays.reduce((best, p) => (p.card.value > best.card.value ? p : best), numberedPlays[0])
        : numberedPlays.reduce((best, p) => (p.card.value < best.card.value ? p : best), numberedPlays[0]);
    } else {
      winner = effective[0];
    }
  } else {
    winner = resolveNormal(effective, plays);
  }

  const raiderTierCount = effective.filter((p) => isRaiderTier(p.effectiveType)).length;
  const enchantressCount = effective.filter((p) => p.effectiveType === 'ENCHANTRESS').length;
  const hasCommander = effective.some((p) => p.effectiveType === 'COMMANDER');

  // Alliances Butin : jouer une carte Butin forme une alliance avec le vainqueur
  // du pli (aucune alliance si le pli est annulé par le Kraken).
  const alliances = [];
  if (!voided) {
    effective.forEach((p) => {
      if (p.card.kind === 'SPECIAL' && p.card.type === 'LOOT' && p.playerId !== winner.playerId) {
        alliances.push({ a: p.playerId, b: winner.playerId });
      }
    });
  }

  return {
    winnerId: winner.playerId,
    voided,
    // Le gagnant du pli remporte (capture) toutes les cartes qui s'y trouvent,
    // peu importe qui les a jouées à l'origine.
    capturedCommander: !voided && hasCommander && winner.effectiveType === 'ENCHANTRESS',
    raidersCapturedByCommander: !voided && winner.effectiveType === 'COMMANDER' ? raiderTierCount : 0,
    enchantressesCapturedByRaider: !voided && isRaiderTier(winner.effectiveType) ? enchantressCount : 0,
    fourteens: voided ? [] : effective.filter((p) => p.card.kind === 'NUMBERED' && p.card.value === 14),
    alliances,
  };
}

function scoreBid(round, bid, tricksWon) {
  if (bid === 0) {
    return tricksWon === 0 ? 10 * round : -10 * round;
  }
  return bid === tricksWon ? 20 * bid : -10 * Math.abs(bid - tricksWon);
}

const Rules = {
  THEME,
  buildDeck,
  shuffle,
  maxRounds,
  cardsForRound,
  dealHands,
  cardLabel,
  legalPlays,
  resolveTrick,
  scoreBid,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Rules;
} else {
  window.Rules = Rules;
}
