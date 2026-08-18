// Synchronisation multijoueur via Firestore. Le créateur de la salle (hostId) fait
// office d'arbitre : c'est son navigateur qui calcule les transitions de phase
// (fin de mise, résolution d'un pli, distribution de la manche suivante).
// Les autres clients se contentent d'envoyer leurs actions (mise, carte jouée).

const ROOMS = 'rooms';

function getOrCreatePlayerId() {
  let id = localStorage.getItem('playerId');
  if (!id) {
    id = 'p-' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('playerId', id);
  }
  return id;
}

function randomRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans caractères ambigus
  let code = '';
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

async function createRoom(playerName) {
  const playerId = getOrCreatePlayerId();
  let code;
  let ref;
  // évite (rarement) une collision de code de salle
  for (let attempt = 0; attempt < 5; attempt++) {
    code = randomRoomCode();
    ref = db.collection(ROOMS).doc(code);
    const snap = await ref.get();
    if (!snap.exists) break;
  }
  await ref.set({
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    hostId: playerId,
    status: 'lobby',
    players: [{ id: playerId, name: playerName }],
    round: 0,
    totals: { [playerId]: 0 },
    trickHistory: [],
  });
  localStorage.setItem('playerName', playerName);
  return { roomCode: code, playerId };
}

async function joinRoom(roomCode, playerName) {
  const playerId = getOrCreatePlayerId();
  const ref = db.collection(ROOMS).doc(roomCode);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('room-not-found');
    const room = snap.data();
    if (room.status !== 'lobby') {
      if (room.players.some((p) => p.id === playerId)) return; // reconnexion en cours de partie
      throw new Error('room-already-started');
    }
    if (room.players.some((p) => p.id === playerId)) return; // déjà dans la salle
    if (room.players.length >= 8) throw new Error('room-full');
    const players = [...room.players, { id: playerId, name: playerName }];
    tx.update(ref, { players, [`totals.${playerId}`]: 0 });
  });
  localStorage.setItem('playerName', playerName);
  return { playerId };
}

function subscribeRoom(roomCode, callback) {
  return db.collection(ROOMS).doc(roomCode).onSnapshot((snap) => {
    if (snap.exists) callback({ id: snap.id, ...snap.data() });
    else callback(null);
  });
}

async function startGame(roomCode) {
  const ref = db.collection(ROOMS).doc(roomCode);
  const snap = await ref.get();
  const room = snap.data();
  const playerIds = room.players.map((p) => p.id);
  await dealRound(ref, room, playerIds, 1, 0);
}

async function dealRound(ref, room, playerIds, round, dealerIndex) {
  const cards = Rules.cardsForRound(round, playerIds.length);
  const deck = Rules.buildDeck();
  const hands = Rules.dealHands(deck, playerIds, cards);
  const bids = {};
  const tricksWon = {};
  playerIds.forEach((id) => {
    bids[id] = null;
    tricksWon[id] = 0;
  });
  await ref.update({
    status: 'bidding',
    round,
    cardsThisRound: cards,
    maxRounds: Rules.maxRounds(playerIds.length),
    dealerIndex,
    trickLeaderIndex: (dealerIndex + 1) % playerIds.length,
    turnIndex: (dealerIndex + 1) % playerIds.length,
    currentTrick: [],
    trickCount: 0,
    hands,
    bids,
    tricksWon,
    bonusTotals: {},
    alliances: [],
  });
}

async function submitBid(roomCode, playerId, bid) {
  const ref = db.collection(ROOMS).doc(roomCode);
  await ref.update({ [`bids.${playerId}`]: bid });
}

async function playCard(roomCode, playerId, card, wildAs) {
  const ref = db.collection(ROOMS).doc(roomCode);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const room = snap.data();
    // Le pli est complet et en attente que l'hôte valide le passage au pli
    // suivant : plus personne ne peut jouer en attendant.
    if (room.pendingTrick) throw new Error('trick-pending');
    const playerIds = room.players.map((p) => p.id);
    if (playerIds[room.turnIndex] !== playerId) throw new Error('not-your-turn');
    const hand = room.hands[playerId];
    const idx = hand.findIndex((c) => c.id === card.id);
    if (idx === -1) throw new Error('card-not-in-hand');
    const newHand = hand.slice();
    newHand.splice(idx, 1);
    const play = { playerId, card, wildAs: wildAs || null };
    const currentTrick = [...room.currentTrick, play];
    tx.update(ref, {
      [`hands.${playerId}`]: newHand,
      currentTrick,
      turnIndex: (room.turnIndex + 1) % playerIds.length,
    });
  });
}

function playerNameIn(room, id) {
  const p = room.players.find((pl) => pl.id === id);
  return p ? p.name : '???';
}

// Appelé uniquement par le client hôte à chaque mise à jour de la salle : fait
// avancer la partie (fin de mise -> jeu, pli complet -> calcul du résultat en
// attente de validation par l'hôte).
async function hostAdvance(roomCode, room) {
  const playerIds = room.players.map((p) => p.id);
  const ref = db.collection(ROOMS).doc(roomCode);

  if (room.status === 'bidding') {
    const allBid = playerIds.every((id) => room.bids[id] !== null && room.bids[id] !== undefined);
    if (allBid) {
      await ref.update({ status: 'playing' });
    }
    return;
  }

  // Le pli est complet mais attend déjà la validation de l'hôte : rien à faire
  // de plus ici, c'est confirmNextTrick qui prendra le relais.
  if (room.pendingTrick) return;

  if (room.status === 'playing' && room.currentTrick.length === playerIds.length) {
    const result = Rules.resolveTrick(room.currentTrick);
    const historyEntry = {
      round: room.round,
      trickNumber: room.trickCount + 1,
      plays: room.currentTrick.map((p) => ({
        playerId: p.playerId,
        playerName: playerNameIn(room, p.playerId),
        card: p.card,
        wildAs: p.wildAs || null,
      })),
      voided: result.voided,
      winnerId: result.voided ? null : result.winnerId,
      winnerName: result.voided ? null : playerNameIn(room, result.winnerId),
    };
    await ref.update({
      pendingTrick: result,
      trickHistory: firebase.firestore.FieldValue.arrayUnion(historyEntry),
    });
  }
}

// Appelé par l'hôte quand il clique sur "Pli suivant" : applique réellement le
// résultat du pli en attente (scores, alliances, fin de manche éventuelle)
// puis passe au pli suivant.
async function confirmNextTrick(roomCode) {
  const ref = db.collection(ROOMS).doc(roomCode);
  const snap = await ref.get();
  const room = snap.data();
  if (!room.pendingTrick) return;
  const result = room.pendingTrick;
  const playerIds = room.players.map((p) => p.id);

  const tricksWon = { ...room.tricksWon };
  // Un pli annulé par le Kraken n'est remporté par personne : personne ne
  // marque de pli, mais le "vainqueur théorique" débute quand même le pli suivant.
  if (!result.voided) {
    tricksWon[result.winnerId] = (tricksWon[result.winnerId] || 0) + 1;
  }

  const bonuses = {};
  playerIds.forEach((id) => (bonuses[id] = 0));
  // Le vainqueur du pli capture toutes les cartes qui s'y trouvent, y compris
  // les 14 joués par d'autres joueurs (rien n'est capturé si le pli est annulé).
  result.fourteens.forEach((p) => {
    bonuses[result.winnerId] += p.card.suit === 'BLACK' ? 20 : 10;
  });
  bonuses[result.winnerId] += 30 * result.raidersCapturedByCommander;
  bonuses[result.winnerId] += 20 * result.enchantressesCapturedByRaider;
  if (result.capturedCommander) bonuses[result.winnerId] += 40;

  const bonusTotals = { ...(room.bonusTotals || {}) };
  playerIds.forEach((id) => (bonusTotals[id] = (bonusTotals[id] || 0) + (bonuses[id] || 0)));

  const alliances = [...(room.alliances || []), ...result.alliances];

  const winnerIndex = result.voided ? room.trickLeaderIndex : playerIds.indexOf(result.winnerId);
  const trickCount = room.trickCount + 1;

  if (trickCount >= room.cardsThisRound) {
    // fin de manche : calcule les scores et passe à la suite
    const totals = { ...room.totals };
    const roundScores = {};
    playerIds.forEach((id) => {
      roundScores[id] = Rules.scoreBid(room.round, room.bids[id], tricksWon[id]) + (bonusTotals[id] || 0);
    });
    // Bonus d'alliance (Butin) : +20 chacun si les deux membres de l'alliance
    // ont exactement réalisé leur mise sur cette manche.
    alliances.forEach(({ a, b }) => {
      if (room.bids[a] === tricksWon[a] && room.bids[b] === tricksWon[b]) {
        roundScores[a] += 20;
        roundScores[b] += 20;
      }
    });
    playerIds.forEach((id) => {
      totals[id] = (totals[id] || 0) + roundScores[id];
    });

    const nextRound = room.round + 1;
    if (nextRound > room.maxRounds) {
      await ref.update({
        status: 'gameEnd',
        currentTrick: [],
        pendingTrick: firebase.firestore.FieldValue.delete(),
        tricksWon,
        bonusTotals: {},
        alliances: [],
        totals,
        lastRoundScores: roundScores,
      });
    } else {
      await ref.update({
        totals,
        lastRoundScores: roundScores,
        bonusTotals: {},
        alliances: [],
        pendingTrick: firebase.firestore.FieldValue.delete(),
      });
      const nextDealer = (room.dealerIndex + 1) % playerIds.length;
      const freshSnap = await ref.get();
      await dealRound(ref, freshSnap.data(), playerIds, nextRound, nextDealer);
    }
  } else {
    await ref.update({
      currentTrick: [],
      pendingTrick: firebase.firestore.FieldValue.delete(),
      trickCount,
      tricksWon,
      bonusTotals,
      alliances,
      trickLeaderIndex: winnerIndex,
      turnIndex: winnerIndex,
    });
  }
}

window.Room = {
  getOrCreatePlayerId,
  createRoom,
  joinRoom,
  subscribeRoom,
  startGame,
  submitBid,
  playCard,
  hostAdvance,
  confirmNextTrick,
};
