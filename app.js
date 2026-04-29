const $ = (selector) => document.querySelector(selector);

const elements = {
  modeMark: $("#modeMark"),
  modeTitle: $("#modeTitle"),
  modeDescription: $("#modeDescription"),
  tournamentName: $("#tournamentName"),
  playerInput: $("#playerInput"),
  modeInputs: document.querySelectorAll('input[name="bracketMode"]'),
  buildBtn: $("#buildBtn"),
  shuffleBtn: $("#shuffleBtn"),
  resetBtn: $("#resetBtn"),
  bracket: $("#bracket"),
  template: $("#matchTemplate"),
  eventLabel: $("#eventLabel"),
  championBadge: $("#championBadge"),
  liveBracket: $("#liveBracket"),
  liveCount: $("#liveCount"),
  entrantCount: $("#entrantCount"),
  activeCount: $("#activeCount"),
  finishedCount: $("#finishedCount"),
  standingList: $("#standingList"),
  tabs: document.querySelectorAll(".tab"),
};

const state = {
  players: [],
  matches: [],
  results: [],
  mode: "double",
  activeView: "all",
};

const nextPowerOfTwo = (value) => 2 ** Math.ceil(Math.log2(value));

function readPlayers() {
  return readPlayerNames().map((name, index) => ({
    id: `p${index + 1}`,
    name,
    seed: index + 1,
    losses: 0,
    eliminated: false,
  }));
}

function readPlayerNames() {
  const unique = new Set();
  return elements.playerInput.value
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => {
      const key = name.toLowerCase();
      if (unique.has(key)) return false;
      unique.add(key);
      return true;
    })
    .slice(0, 16);
}

function shufflePlayers() {
  const names = readPlayerNames();
  if (names.length < 2) {
    alert("กรุณาใส่รายชื่ออย่างน้อย 2 คนก่อนสุ่มทีม");
    return;
  }

  for (let index = names.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [names[index], names[randomIndex]] = [names[randomIndex], names[index]];
  }

  elements.playerInput.value = names.join("\n");
  createBracket();
}

function getSelectedMode() {
  return document.querySelector('input[name="bracketMode"]:checked')?.value || "double";
}

function isDoubleMode() {
  return state.mode === "double";
}

function updateModeBrand() {
  const isDouble = isDoubleMode();
  elements.modeMark.textContent = isDouble ? "DE" : "EL";
  elements.modeTitle.textContent = isDouble ? "จัดสาย Double Elimination" : "จัดสาย Elimination";
  elements.modeDescription.textContent = isDouble
    ? "สร้างสายแข่ง บันทึกผล และติดตามผู้แพ้สองครั้งตกรอบ"
    : "สร้างสายแข่ง บันทึกผล และแพ้ครั้งเดียวตกรอบ";
}

function makeMatch({ id, bracket, round, label, nextWin = null, nextLose = null }) {
  return {
    id,
    bracket,
    round,
    label,
    slots: [null, null],
    scores: ["", ""],
    winner: null,
    loser: null,
    nextWin,
    nextLose,
    incoming: [[], []],
    complete: false,
  };
}

function addIncoming(target, source) {
  if (!target) return;
  target.match.incoming[target.slot].push(source);
}

function createBracket(options = {}) {
  const replayResults = options.replayResults || [];
  const mode = getSelectedMode();
  const players = readPlayers();
  if (players.length < 2) {
    alert("กรุณาใส่รายชื่ออย่างน้อย 2 คน");
    return;
  }

  const size = Math.max(2, nextPowerOfTwo(players.length));
  const padded = [...players, ...Array.from({ length: size - players.length }, () => null)];
  const winnerRounds = Math.log2(size);
  const matches = [];
  const roundMatches = { winners: [], losers: [], finals: [] };

  for (let round = 1; round <= winnerRounds; round += 1) {
    const count = size / 2 ** round;
    roundMatches.winners[round] = [];
    for (let index = 0; index < count; index += 1) {
      const match = makeMatch({
        id: `W${round}-${index}`,
        bracket: "winners",
        round,
        label: `W${round}.${index + 1}`,
      });
      matches.push(match);
      roundMatches.winners[round][index] = match;
    }
  }

  const loserRounds = mode === "double" ? Math.max(0, winnerRounds * 2 - 2) : 0;
  for (let round = 1; round <= loserRounds; round += 1) {
    const count = size / 2 ** (Math.floor((round + 1) / 2) + 1);
    roundMatches.losers[round] = [];
    for (let index = 0; index < count; index += 1) {
      const match = makeMatch({
        id: `L${round}-${index}`,
        bracket: "losers",
        round,
        label: `L${round}.${index + 1}`,
      });
      matches.push(match);
      roundMatches.losers[round][index] = match;
    }
  }

  const grandFinal = mode === "double"
    ? makeMatch({
        id: "GF-1",
        bracket: "finals",
        round: 1,
        label: "Grand Final",
      })
    : null;
  const resetFinal = mode === "double"
    ? makeMatch({
        id: "GF-2",
        bracket: "finals",
        round: 2,
        label: "Reset Final",
      })
    : null;
  if (mode === "double") {
    matches.push(grandFinal, resetFinal);
    roundMatches.finals[1] = [grandFinal];
    roundMatches.finals[2] = [resetFinal];
  }

  roundMatches.winners.forEach((round, roundNumber) => {
    if (!round) return;
    round.forEach((match, index) => {
      match.nextWin = roundNumber < winnerRounds
        ? { match: roundMatches.winners[roundNumber + 1][Math.floor(index / 2)], slot: index % 2 }
        : mode === "double"
          ? { match: grandFinal, slot: 0 }
          : null;
      if (mode !== "double") {
        match.nextLose = null;
      } else if (loserRounds === 0 && roundNumber === winnerRounds) {
        match.nextLose = { match: grandFinal, slot: 1 };
      } else if (roundNumber === 1) {
        match.nextLose = { match: roundMatches.losers[1][Math.floor(index / 2)], slot: index % 2 };
      } else {
        const loserRound = (roundNumber - 1) * 2;
        match.nextLose = { match: roundMatches.losers[loserRound][index], slot: 1 };
      }
      addIncoming(match.nextWin, match);
      addIncoming(match.nextLose, match);
    });
  });

  roundMatches.losers.forEach((round, roundNumber) => {
    if (!round) return;
    round.forEach((match, index) => {
      const isOddRound = roundNumber % 2 === 1;
      match.nextWin = roundNumber < loserRounds
        ? {
            match: roundMatches.losers[roundNumber + 1][isOddRound ? index : Math.floor(index / 2)],
            slot: isOddRound ? 0 : index % 2,
          }
        : { match: grandFinal, slot: 1 };
      addIncoming(match.nextWin, match);
    });
  });

  roundMatches.winners[1].forEach((match, index) => {
    match.slots[0] = padded[index * 2];
    match.slots[1] = padded[index * 2 + 1];
  });

  state.players = players;
  state.matches = matches;
  state.results = [];
  state.mode = mode;
  if (!isDoubleMode() && (state.activeView === "losers" || state.activeView === "finals")) {
    state.activeView = "all";
  }
  resolveByes();
  replayResults.forEach((result) => replayResult(result));
  render();
}

function resolveByes() {
  let changed = true;
  while (changed) {
    changed = false;
    state.matches.forEach((match) => {
      if (match.complete || match.bracket === "finals") return;
      const filled = match.slots.filter(Boolean);
      const canAdvanceBye = canResolveBye(match);
      if (canAdvanceBye && filled.length === 0 && match.slots.every((slot) => !slot)) {
        match.complete = true;
        changed = true;
        return;
      }
      if (canAdvanceBye && filled.length === 1 && match.slots.includes(null)) {
        completeMatch(match, filled[0], { automatic: true });
        changed = true;
      }
    });
  }
}

function canResolveBye(match) {
  return match.slots.every((slot, index) => {
    if (slot) return true;
    const sources = match.incoming[index];
    return sources.length === 0 || sources.every((source) => source.complete);
  });
}

function placePlayer(target, player) {
  if (!target || !player) return;
  target.match.slots[target.slot] = player;
}

function completeMatch(match, winner, options = {}) {
  if (!winner || match.complete) return;
  const loser = match.slots.find((slot) => slot && slot.id !== winner.id) || null;
  const shouldRecord = !options.automatic && options.record !== false;
  const resultRecord = shouldRecord
    ? {
        matchId: match.id,
        winnerId: winner.id,
        scores: [...match.scores],
      }
    : null;

  match.winner = winner;
  match.loser = loser;
  match.complete = true;

  if (match.id === "GF-1") {
    if (loser) loser.losses += 1;
    if (winner.id === match.slots[0]?.id) {
      if (loser) loser.eliminated = true;
    } else {
      const resetFinal = state.matches.find((item) => item.id === "GF-2");
      resetFinal.slots[0] = match.slots[0];
      resetFinal.slots[1] = match.slots[1];
    }
    recordResult(resultRecord);
    return;
  }

  if (match.id === "GF-2") {
    if (loser) {
      loser.losses += 1;
      loser.eliminated = true;
    }
    recordResult(resultRecord);
    return;
  }

  placePlayer(match.nextWin, winner);

  if (loser) {
    loser.losses += 1;
    if (loser.losses >= 2 || !match.nextLose) {
      loser.eliminated = true;
    } else {
      placePlayer(match.nextLose, loser);
    }
  }

  if (!options.automatic) {
    resolveByes();
  }

  recordResult(resultRecord);
}

function recordResult(resultRecord) {
  if (!resultRecord) return;
  state.results.push(resultRecord);
}

function replayResult(result) {
  const match = state.matches.find((item) => item.id === result.matchId);
  if (!match || match.complete || match.slots.some((slot) => !slot)) return;

  const winner = match.slots.find((player) => player.id === result.winnerId);
  if (!winner) return;

  match.scores = [...result.scores];
  completeMatch(match, winner, { record: false });
  state.results.push({ ...result, scores: [...result.scores] });
}

function undoResult(matchId) {
  const resultIndex = state.results.findIndex((result) => result.matchId === matchId);
  if (resultIndex === -1) return;

  if (!confirm("ต้องการยกเลิกผลแมตช์นี้และผลที่เกิดหลังจากนั้นใช่ไหม?")) {
    return;
  }

  const replayResults = state.results.slice(0, resultIndex);
  createBracket({ replayResults });
}

function chooseWinner(matchId, slotIndex) {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match || match.complete) return;
  const winner = match.slots[slotIndex];
  if (!winner || match.slots.some((slot) => !slot)) return;
  completeMatch(match, winner);
  render();
}

function saveScore(matchId, slotIndex, value) {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match || match.complete) return;
  match.scores[slotIndex] = value;
  renderLiveBracket();
}

function confirmScore(matchId) {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match || match.complete || match.slots.some((slot) => !slot)) return;

  const scores = match.scores.map((score) => Number(score));
  const hasInvalidScore = match.scores.some((score) => score === "")
    || scores.some((score) => !Number.isInteger(score) || score < 0);

  if (hasInvalidScore) {
    alert("กรุณาใส่คะแนนเป็นเลขจำนวนเต็ม 0 ขึ้นไปให้ครบทั้งสองทีม");
    return;
  }

  if (scores[0] === scores[1]) {
    alert("คะแนนเท่ากัน กรุณาแก้คะแนนก่อนยืนยัน");
    return;
  }

  completeMatch(match, match.slots[scores[0] > scores[1] ? 0 : 1]);
  render();
}

function groupMatches(bracket) {
  const rounds = new Map();
  state.matches
    .filter((match) => match.bracket === bracket)
    .forEach((match) => {
      if (!rounds.has(match.round)) rounds.set(match.round, []);
      rounds.get(match.round).push(match);
    });
  return [...rounds.entries()].sort(([a], [b]) => a - b);
}

function renderMatch(match) {
  const node = elements.template.content.firstElementChild.cloneNode(true);
  node.id = `match-${match.id}`;
  node.dataset.matchId = match.id;
  node.classList.toggle("locked", isLockedResetFinal(match));
  const title = node.querySelector(".match-title");
  const status = node.querySelector(".match-status");
  const slots = node.querySelectorAll(".slot");
  const scoreInputs = node.querySelectorAll(".score-input");
  const scoreSubmit = node.querySelector(".score-submit");
  const undoButton = node.querySelector(".undo-result");
  const isPlayable = match.slots.every(Boolean);
  title.textContent = match.label;
  status.textContent = getMatchStatus(match, isPlayable);

  slots.forEach((slotNode, index) => {
    const player = match.slots[index];
    slotNode.dataset.match = match.id;
    slotNode.querySelector(".seed").textContent = player ? `#${player.seed}` : "-";
    slotNode.querySelector(".name").textContent = player ? player.name : "รอผล";
    slotNode.querySelector(".losses").textContent = player ? `${player.losses}L` : "";
    slotNode.disabled = match.complete || !player || !isPlayable || isLockedResetFinal(match);
    slotNode.classList.toggle("ready", !slotNode.disabled);
    slotNode.classList.toggle("winner", match.winner?.id === player?.id);
    slotNode.classList.toggle("eliminated", Boolean(player?.eliminated));
    slotNode.addEventListener("click", () => chooseWinner(match.id, index));
  });

  scoreInputs.forEach((input, index) => {
    input.value = match.scores[index];
    input.disabled = match.complete || !match.slots[index] || !isPlayable || isLockedResetFinal(match);
    input.addEventListener("input", () => saveScore(match.id, index, input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        confirmScore(match.id);
      }
    });
  });

  scoreSubmit.disabled = match.complete || !isPlayable || isLockedResetFinal(match);
  scoreSubmit.addEventListener("click", () => confirmScore(match.id));

  const canUndo = match.complete && state.results.some((result) => result.matchId === match.id);
  undoButton.hidden = !canUndo;
  undoButton.addEventListener("click", () => undoResult(match.id));

  return node;
}

function isLockedResetFinal(match) {
  return isDoubleMode() && match.id === "GF-2" && !shouldActivateResetFinal();
}

function getMatchStatus(match, isPlayable) {
  if (match.complete) return "จบแล้ว";
  if (isLockedResetFinal(match)) return "รอเงื่อนไข Reset";
  return isPlayable ? "พร้อมแข่ง" : "รอคู่แข่ง";
}

function getLiveMatches() {
  return state.matches.filter((match) => (
    !match.complete
    && match.slots.every(Boolean)
    && !isLockedResetFinal(match)
  ));
}

function jumpToMatch(matchId) {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match) return;
  const matchingTab = [...elements.tabs].find((tab) => tab.dataset.view === match.bracket);
  if (state.activeView !== "all" && matchingTab) {
    elements.tabs.forEach((tab) => tab.classList.remove("active"));
    matchingTab.classList.add("active");
    state.activeView = match.bracket;
    render();
  }

  requestAnimationFrame(() => {
    const node = document.getElementById(`match-${matchId}`);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    node.classList.remove("flash");
    void node.offsetWidth;
    node.classList.add("flash");
  });
}

function renderLiveBracket() {
  const liveMatches = getLiveMatches();
  elements.liveCount.textContent = `${liveMatches.length} คู่`;
  elements.liveBracket.innerHTML = "";

  if (!liveMatches.length) {
    const empty = document.createElement("div");
    empty.className = "live-empty";
    empty.textContent = getChampion() ? "การแข่งขันจบแล้ว" : "ยังไม่มีคู่ที่พร้อมแข่ง";
    elements.liveBracket.append(empty);
    return;
  }

  liveMatches.slice(0, 4).forEach((match) => {
    const card = document.createElement("article");
    card.className = "live-card";

    const title = document.createElement("strong");
    title.textContent = `${match.label} · ${match.bracket.toUpperCase()}`;

    const names = document.createElement("span");
    names.textContent = `${match.slots[0].name} vs ${match.slots[1].name}`;

    const scores = document.createElement("span");
    scores.textContent = `คะแนน: ${match.scores[0] || "-"} - ${match.scores[1] || "-"}`;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "ไปที่แมตช์";
    button.addEventListener("click", () => jumpToMatch(match.id));

    card.append(title, names, scores, button);
    elements.liveBracket.append(card);
  });
}

function renderSection(bracket, title) {
  const section = document.createElement("section");
  section.className = `section bracket-section ${bracket}-section`;
  section.dataset.bracket = bracket;
  section.classList.toggle("hidden-view", state.activeView !== "all" && state.activeView !== bracket);

  const heading = document.createElement("h2");
  heading.className = "section-title";
  heading.textContent = title;
  section.append(heading);

  const roundsNode = document.createElement("div");
  roundsNode.className = "rounds";

  groupMatches(bracket).forEach(([roundNumber, matches]) => {
    const round = document.createElement("div");
    round.className = "round";

    const roundTitle = document.createElement("h3");
    roundTitle.textContent = getRoundTitle(bracket, roundNumber);
    round.append(roundTitle);

    matches.forEach((match) => round.append(renderMatch(match)));
    roundsNode.append(round);
  });

  section.append(roundsNode);
  return section;
}

function renderMirroredSection(bracket, title) {
  const rounds = groupMatches(bracket);
  if (!rounds.length) return renderSection(bracket, title);

  const section = document.createElement("section");
  section.className = `section bracket-section centered-section ${bracket}-section`;
  section.dataset.bracket = bracket;
  section.classList.toggle("hidden-view", state.activeView !== "all" && state.activeView !== bracket);

  const heading = document.createElement("h2");
  heading.className = "section-title";
  heading.textContent = title;
  section.append(heading);

  const bracketNode = document.createElement("div");
  bracketNode.className = "centered-bracket mirrored-bracket";

  if (rounds.length === 1) {
    bracketNode.append(createMirroredColumn(getRoundTitle(bracket, rounds[0][0]), rounds[0][1], "center"));
    section.append(bracketNode);
    return section;
  }

  const leftColumns = [];
  const rightColumns = [];
  const finalRound = rounds[rounds.length - 1];

  rounds.slice(0, -1).forEach(([roundNumber, matches]) => {
    const splitIndex = Math.ceil(matches.length / 2);
    const leftMatches = matches.slice(0, splitIndex);
    const rightMatches = matches.slice(splitIndex);
    const titleText = getRoundTitle(bracket, roundNumber);

    if (leftMatches.length) {
      leftColumns.push(createMirroredColumn(titleText, leftMatches, "left"));
    }

    if (rightMatches.length) {
      rightColumns.push(createMirroredColumn(titleText, rightMatches, "right"));
    }
  });

  const centerColumn = createMirroredColumn(getRoundTitle(bracket, finalRound[0]), finalRound[1], "center");
  const columns = [...leftColumns, centerColumn, ...rightColumns.reverse()];
  bracketNode.style.setProperty("--columns", columns.length);
  bracketNode.classList.toggle("compact", columns.length >= 5);
  bracketNode.classList.toggle("ultra-compact", columns.length >= 7);
  bracketNode.append(...columns);

  section.append(bracketNode);
  return section;
}

function createMirroredColumn(title, matches, side) {
  const column = document.createElement("div");
  column.className = `centered-column ${side}`;

  const roundTitle = document.createElement("h3");
  roundTitle.textContent = title;
  column.append(roundTitle);
  matches.forEach((match) => column.append(renderMatch(match)));
  return column;
}

function getRoundTitle(bracket, roundNumber) {
  if (bracket !== "finals") return `Round ${roundNumber}`;
  return roundNumber === 1 ? "Grand Final" : "Reset Final";
}

function shouldShowResetFinal() {
  return isDoubleMode();
}

function shouldActivateResetFinal() {
  if (!isDoubleMode()) return false;
  const grandFinal = state.matches.find((match) => match.id === "GF-1");
  const resetFinal = state.matches.find((match) => match.id === "GF-2");
  return Boolean(resetFinal?.complete || resetFinal?.slots.some(Boolean) || (
    grandFinal?.complete && grandFinal.winner?.id === grandFinal.slots[1]?.id
  ));
}

function updateSummary() {
  const finished = state.matches.filter((match) => match.complete && match.slots.some(Boolean)).length;
  const active = state.players.filter((player) => !player.eliminated).length;
  const champion = getChampion();

  elements.eventLabel.textContent = elements.tournamentName.value.trim() || "Tournament Bracket";
  elements.entrantCount.textContent = state.players.length;
  elements.activeCount.textContent = champion ? 1 : active;
  elements.finishedCount.textContent = finished;
  elements.championBadge.classList.toggle("hidden", !champion);
  elements.championBadge.textContent = champion ? `แชมป์: ${champion.name}` : "";

  const standings = [...state.players].sort((a, b) => {
    if (a.eliminated !== b.eliminated) return Number(a.eliminated) - Number(b.eliminated);
    if (a.losses !== b.losses) return a.losses - b.losses;
    return a.seed - b.seed;
  });

  elements.standingList.innerHTML = "";
  standings.forEach((player) => {
    const item = document.createElement("li");
    item.textContent = `${player.name} (${player.losses}L${player.eliminated ? ", ตกรอบ" : ""})`;
    elements.standingList.append(item);
  });
}

function getChampion() {
  if (!isDoubleMode()) {
    const finalRound = Math.max(
      0,
      ...state.matches
        .filter((match) => match.bracket === "winners")
        .map((match) => match.round),
    );
    const final = state.matches.find((match) => match.bracket === "winners" && match.round === finalRound);
    return final?.complete ? final.winner : null;
  }

  const grandFinal = state.matches.find((match) => match.id === "GF-1");
  const resetFinal = state.matches.find((match) => match.id === "GF-2");
  if (resetFinal?.complete) return resetFinal.winner;
  if (grandFinal?.complete && grandFinal.winner?.id === grandFinal.slots[0]?.id) {
    return grandFinal.winner;
  }
  return null;
}

function render() {
  elements.bracket.innerHTML = "";
  updateModeBrand();
  updateModeTabs();
  if (!state.matches.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "ใส่รายชื่อแล้วกดสร้างสายเพื่อเริ่มจัดการแข่งขัน";
    elements.bracket.append(empty);
    return;
  }

  elements.bracket.append(
    renderMirroredSection("winners", isDoubleMode() ? "Winner Bracket" : "Elimination Bracket"),
  );
  if (isDoubleMode()) {
    elements.bracket.append(
      renderMirroredSection("losers", "Loser Bracket"),
      renderMirroredSection("finals", "Grand Final"),
    );
  }
  renderLiveBracket();
  updateSummary();
}

function updateModeTabs() {
  elements.tabs.forEach((tab) => {
    const shouldHide = !isDoubleMode() && (tab.dataset.view === "losers" || tab.dataset.view === "finals");
    tab.hidden = shouldHide;
    if (shouldHide && tab.classList.contains("active")) {
      tab.classList.remove("active");
      elements.tabs[0].classList.add("active");
      state.activeView = "all";
    }
  });
}

function resetResults() {
  if (!confirm("ต้องการล้างผลการแข่งขันทั้งหมดและสร้างสายใหม่จากรายชื่อเดิมใช่ไหม?")) {
    return;
  }
  createBracket();
}

elements.buildBtn.addEventListener("click", createBracket);
elements.shuffleBtn.addEventListener("click", shufflePlayers);
elements.resetBtn.addEventListener("click", resetResults);
elements.tournamentName.addEventListener("input", updateSummary);
elements.modeInputs.forEach((input) => {
  input.addEventListener("change", () => createBracket());
});
elements.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    elements.tabs.forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    state.activeView = tab.dataset.view;
    render();
  });
});

createBracket();
