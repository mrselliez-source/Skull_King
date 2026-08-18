const params = new URLSearchParams(window.location.search);
const roomCode = (params.get('room') || '').toUpperCase();
const playerName = localStorage.getItem('playerName');
const myId = Room.getOrCreatePlayerId();

if (!roomCode || !playerName) {
  window.location.href = 'index.html';
}

document.getElementById('roomCodeLabel').textContent = roomCode;
document.getElementById('shareCode').textContent = roomCode;

const els = {
  scoreboard: document.getElementById('scoreboard'),
  lobbyView: document.getElementById('lobbyView'),
  biddingView: document.getElementById('biddingView'),
  playingView: document.getElementById('playingView'),
  gameEndView: document.getElementById('gameEndView'),
  playerList: document.getElementById('playerList'),
  startBtn: document.getElementById('startBtn'),
  waitingHostMsg: document.getElementById('waitingHostMsg'),
  handDisplay: document.getElementById('handDisplay'),
  opponentsRowBid: document.getElementById('opponentsRowBid'),
  bidSelect: document.getElementById('bidSelect'),
  bidBtn: document.getElementById('bidBtn'),
  bidStatus: document.getElementById('bidStatus'),
  turnIndicator: document.getElementById('turnIndicator'),
  opponentsRow: document.getElementById('opponentsRow'),
  trickArea: document.getElementById('trickArea'),
  handDisplayPlay: document.getElementById('handDisplayPlay'),
  wildcardChoice: document.getElementById('wildcardChoice'),
  wildRaiderBtn: document.getElementById('wildRaiderBtn'),
  wildRetreatBtn: document.getElementById('wildRetreatBtn'),
  roundLabel: document.getElementById('roundLabel'),
  errorMsg: document.getElementById('errorMsg'),
  finalScoreboard: document.getElementById('finalScoreboard'),
};

function showError(msg) {
  els.errorMsg.textContent = msg || '';
}

function showView(name) {
  ['lobbyView', 'biddingView', 'playingView', 'gameEndView'].forEach((v) => {
    els[v].classList.toggle('hidden', v !== name);
  });
}

const CARD_IMAGES_DIR = 'images/cards';

// Ajoute une image par-dessus le rendu CSS par défaut si un des fichiers de
// `sources` existe (essayés dans l'ordre). Convention de noms : voir
// images/cards/README.md. Si aucune n'existe (404), le rendu par défaut
// (couleur + texte) reste affiché.
function attachCardImage(div, sources) {
  const img = document.createElement('img');
  img.className = 'card-img';
  img.alt = '';
  let idx = 0;
  img.onload = () => div.classList.add('has-image');
  img.onerror = () => {
    if (idx < sources.length) img.src = sources[idx++];
    else img.remove();
  };
  div.appendChild(img);
  img.src = sources[idx++];
}

// Numéro d'exemplaire (1, 2, 3...) d'une carte spéciale parmi les copies de ce
// type dans le deck, à partir de son id `${type}-${i}-${compteur}`.
function specialCopyNumber(card) {
  const parts = card.id.split('-');
  return parseInt(parts[1], 10) + 1;
}

function cardEl(card, opts) {
  opts = opts || {};
  const div = document.createElement('div');
  const suitClass = card.kind === 'NUMBERED' ? `suit-${card.suit}` : `special-${card.type}`;
  div.className = `card-face ${suitClass}` + (opts.disabled ? ' disabled' : '') + (opts.faceDown ? ' face-down' : '');
  if (opts.faceDown) {
    attachCardImage(div, [`${CARD_IMAGES_DIR}/back.png`]);
  } else {
    div.innerHTML = card.kind === 'NUMBERED'
      ? `<span class="card-value">${card.value}</span>`
      : `<span class="card-label">${Rules.THEME.specialLabels[card.type]}</span>`;
    if (card.kind === 'NUMBERED') {
      attachCardImage(div, [`${CARD_IMAGES_DIR}/${card.suit}-${card.value}.png`]);
    } else {
      // Essaie d'abord un visuel propre à cet exemplaire (ex. ENCHANTRESS-2.png),
      // puis retombe sur le visuel générique du type (ENCHANTRESS.png).
      attachCardImage(div, [
        `${CARD_IMAGES_DIR}/${card.type}-${specialCopyNumber(card)}.png`,
        `${CARD_IMAGES_DIR}/${card.type}.png`,
      ]);
    }
  }
  if (opts.onClick && !opts.disabled) {
    div.addEventListener('click', () => opts.onClick(card));
  }
  return div;
}

function playerName_(room, id) {
  const p = room.players.find((pl) => pl.id === id);
  return p ? p.name : '???';
}

// Dispose des cartes déjà présentes dans `container` en éventail (arc de cercle),
// la carte du milieu la plus haute, comme une main tenue à la table.
function layoutFan(container) {
  const cardEls = Array.from(container.children);
  const n = cardEls.length;
  if (n === 0) return;
  const mid = (n - 1) / 2;
  const anglePerCard = Math.min(9, Math.max(4, 44 / Math.max(n - 1, 1)));
  const spacing = Math.max(16, 70 - n * 4);
  const maxLift = 20;
  cardEls.forEach((el, i) => {
    const offset = i - mid;
    const angle = offset * anglePerCard;
    const normalized = mid > 0 ? Math.abs(offset) / mid : 0;
    const lift = -maxLift * (1 - normalized * normalized * 0.75);
    el.style.left = `calc(50% + ${offset * spacing}px)`;
    el.style.setProperty('--rot', `${angle}deg`);
    el.style.setProperty('--lift', `${lift}px`);
    el.style.zIndex = String(i);
  });
}

// Affiche les autres joueurs autour de la table : mini-éventail de cartes
// retournées (on ne dévoile jamais leur main) + statut (mise faite / tour en cours).
function renderOpponents(container, room, opts) {
  opts = opts || {};
  container.innerHTML = '';
  room.players
    .filter((p) => p.id !== myId)
    .forEach((p) => {
      const handCount = (room.hands && room.hands[p.id] ? room.hands[p.id].length : room.cardsThisRound) || 0;
      const div = document.createElement('div');
      div.className = 'opponent' + (opts.activeId === p.id ? ' active' : '');

      const fan = document.createElement('div');
      fan.className = 'mini-fan';
      const backsShown = Math.min(handCount, 7);
      for (let i = 0; i < backsShown; i++) {
        const back = document.createElement('div');
        back.className = 'mini-card-back';
        const offset = i - (backsShown - 1) / 2;
        back.style.transform = `translateX(-50%) translateX(${offset * 10}px) rotate(${offset * 8}deg)`;
        attachCardImage(back, [`${CARD_IMAGES_DIR}/back.png`]);
        fan.appendChild(back);
      }
      div.appendChild(fan);

      const name = document.createElement('div');
      name.className = 'opponent-name';
      name.textContent = p.name;
      div.appendChild(name);

      const status = document.createElement('div');
      status.className = 'opponent-status';
      status.textContent = opts.statusFor ? opts.statusFor(p, handCount) : '';
      div.appendChild(status);

      container.appendChild(div);
    });
}

function renderScoreboard(room) {
  const rows = room.players
    .map((p) => ({ name: p.name, total: room.totals?.[p.id] || 0 }))
    .sort((a, b) => b.total - a.total);
  els.scoreboard.innerHTML = rows
    .map((r) => `<span class="score-chip">${r.name}: <strong>${r.total}</strong></span>`)
    .join('');
  els.roundLabel.textContent = room.round ? `Manche ${room.round}/${room.maxRounds}` : '';
}

function renderLobby(room) {
  showView('lobbyView');
  els.playerList.innerHTML = room.players.map((p) => `<li>${p.name}${p.id === room.hostId ? ' (hôte)' : ''}</li>`).join('');
  const isHost = room.hostId === myId;
  els.startBtn.classList.toggle('hidden', !isHost);
  els.waitingHostMsg.classList.toggle('hidden', isHost);
  els.startBtn.disabled = room.players.length < 2;
}

let myBidChoice = null;

function renderBidding(room) {
  showView('biddingView');
  renderOpponents(els.opponentsRowBid, room, {
    statusFor: (p) => (room.bids[p.id] !== null && room.bids[p.id] !== undefined ? '✓ a misé' : '… réfléchit'),
  });

  const hand = room.hands[myId] || [];
  els.handDisplay.innerHTML = '';
  hand.forEach((c) => els.handDisplay.appendChild(cardEl(c, { disabled: true })));
  layoutFan(els.handDisplay);

  els.bidSelect.innerHTML = '';
  for (let i = 0; i <= room.cardsThisRound; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    els.bidSelect.appendChild(opt);
  }

  const alreadyBid = room.bids[myId] !== null && room.bids[myId] !== undefined;
  els.bidBtn.disabled = alreadyBid;
  els.bidSelect.disabled = alreadyBid;
  const bidCount = Object.values(room.bids).filter((b) => b !== null && b !== undefined).length;
  els.bidStatus.textContent = alreadyBid
    ? `Ta mise : ${room.bids[myId]}. En attente des autres (${bidCount}/${room.players.length})...`
    : `Choisis ta mise (${bidCount}/${room.players.length} joueurs ont misé).`;
}

let pendingWildCard = null;

function renderPlaying(room) {
  showView('playingView');
  const playerIds = room.players.map((p) => p.id);
  const myTurn = playerIds[room.turnIndex] === myId;

  els.turnIndicator.textContent = myTurn
    ? 'À toi de jouer !'
    : `Tour de ${playerName_(room, playerIds[room.turnIndex])}...`;

  renderOpponents(els.opponentsRow, room, {
    activeId: playerIds[room.turnIndex],
    statusFor: (p, count) => (playerIds[room.turnIndex] === p.id ? 'à son tour' : `${count} carte(s)`),
  });

  els.trickArea.innerHTML = '';
  room.currentTrick.forEach((play) => {
    const wrap = document.createElement('div');
    wrap.className = 'trick-play';
    wrap.appendChild(cardEl(play.card));
    const label = document.createElement('div');
    label.className = 'trick-play-name';
    label.textContent = playerName_(room, play.playerId);
    wrap.appendChild(label);
    els.trickArea.appendChild(wrap);
  });

  const hand = room.hands[myId] || [];
  const legal = myTurn ? Rules.legalPlays(hand, room.currentTrick) : [];
  const legalIds = new Set(legal.map((c) => c.id));

  els.handDisplayPlay.innerHTML = '';
  els.wildcardChoice.classList.add('hidden');
  hand.forEach((c) => {
    els.handDisplayPlay.appendChild(
      cardEl(c, {
        disabled: !myTurn || !legalIds.has(c.id),
        onClick: (card) => onCardClick(room, card),
      })
    );
  });
  layoutFan(els.handDisplayPlay);
}

async function onCardClick(room, card) {
  if (card.kind === 'SPECIAL' && card.type === 'WILDCARD') {
    pendingWildCard = card;
    els.wildcardChoice.classList.remove('hidden');
    return;
  }
  try {
    await Room.playCard(roomCode, myId, card, null);
  } catch (e) {
    showError('Erreur : ' + e.message);
  }
}

els.wildRaiderBtn.addEventListener('click', async () => {
  if (!pendingWildCard) return;
  try {
    await Room.playCard(roomCode, myId, pendingWildCard, 'RAIDER');
  } catch (e) {
    showError('Erreur : ' + e.message);
  }
  pendingWildCard = null;
  els.wildcardChoice.classList.add('hidden');
});

els.wildRetreatBtn.addEventListener('click', async () => {
  if (!pendingWildCard) return;
  try {
    await Room.playCard(roomCode, myId, pendingWildCard, 'RETREAT');
  } catch (e) {
    showError('Erreur : ' + e.message);
  }
  pendingWildCard = null;
  els.wildcardChoice.classList.add('hidden');
});

function renderGameEnd(room) {
  showView('gameEndView');
  const rows = room.players
    .map((p) => ({ name: p.name, total: room.totals?.[p.id] || 0 }))
    .sort((a, b) => b.total - a.total);
  els.finalScoreboard.innerHTML =
    '<ol>' + rows.map((r) => `<li>${r.name} — ${r.total} points</li>`).join('') + '</ol>';
}

els.startBtn.addEventListener('click', async () => {
  els.startBtn.disabled = true;
  try {
    await Room.startGame(roomCode);
  } catch (e) {
    showError('Erreur : ' + e.message);
    els.startBtn.disabled = false;
  }
});

els.bidBtn.addEventListener('click', async () => {
  const bid = parseInt(els.bidSelect.value, 10);
  els.bidBtn.disabled = true;
  try {
    await Room.submitBid(roomCode, myId, bid);
  } catch (e) {
    showError('Erreur : ' + e.message);
    els.bidBtn.disabled = false;
  }
});

let advancing = false;

Room.subscribeRoom(roomCode, async (room) => {
  if (!room) {
    showError('Cette salle n\'existe plus.');
    return;
  }
  showError('');
  renderScoreboard(room);

  if (room.status === 'lobby') renderLobby(room);
  else if (room.status === 'bidding') renderBidding(room);
  else if (room.status === 'playing') renderPlaying(room);
  else if (room.status === 'gameEnd') renderGameEnd(room);

  if (room.hostId === myId && !advancing && (room.status === 'bidding' || room.status === 'playing')) {
    advancing = true;
    try {
      await Room.hostAdvance(roomCode, room);
    } catch (e) {
      console.error(e);
    } finally {
      advancing = false;
    }
  }
});
