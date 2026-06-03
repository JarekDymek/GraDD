const elements = {
  setupView: document.querySelector("#setupView"),
  gameView: document.querySelector("#gameView"),
  setupForm: document.querySelector("#setupForm"),
  csvFile: document.querySelector("#csvFile"),
  fileName: document.querySelector("#fileName"),
  csvSummary: document.querySelector("#csvSummary"),
  teamAName: document.querySelector("#teamAName"),
  teamBName: document.querySelector("#teamBName"),
  categoryCount: document.querySelector("#categoryCount"),
  questionCount: document.querySelector("#questionCount"),
  baseValue: document.querySelector("#baseValue"),
  valueStep: document.querySelector("#valueStep"),
  startButton: document.querySelector("#startButton"),
  clearButton: document.querySelector("#clearButton"),
  setupError: document.querySelector("#setupError"),
  teamANameLabel: document.querySelector("#teamANameLabel"),
  teamBNameLabel: document.querySelector("#teamBNameLabel"),
  teamAScore: document.querySelector("#teamAScore"),
  teamBScore: document.querySelector("#teamBScore"),
  currentTurnLabel: document.querySelector("#currentTurnLabel"),
  manualScoreForm: document.querySelector("#manualScoreForm"),
  manualTeam: document.querySelector("#manualTeam"),
  manualTeamAOption: document.querySelector("#manualTeamAOption"),
  manualTeamBOption: document.querySelector("#manualTeamBOption"),
  manualPoints: document.querySelector("#manualPoints"),
  manualSubtractButton: document.querySelector("#manualSubtractButton"),
  board: document.querySelector("#board"),
  questionModal: document.querySelector("#questionModal"),
  modalValue: document.querySelector("#modalValue"),
  modalCategory: document.querySelector("#modalCategory"),
  closeModalButton: document.querySelector("#closeModalButton"),
  questionText: document.querySelector("#questionText"),
  dailyDoubleBadge: document.querySelector("#dailyDoubleBadge"),
  answerPanel: document.querySelector("#answerPanel"),
  answerText: document.querySelector("#answerText"),
  modalTurnLabel: document.querySelector("#modalTurnLabel"),
  modalTurnHelp: document.querySelector("#modalTurnHelp"),
  showAnswerButton: document.querySelector("#showAnswerButton"),
  fullCorrectButton: document.querySelector("#fullCorrectButton"),
  teamCorrectButton: document.querySelector("#teamCorrectButton"),
  teamMissButton: document.querySelector("#teamMissButton"),
  stealCorrectButton: document.querySelector("#stealCorrectButton"),
  stealMissButton: document.querySelector("#stealMissButton"),
  newGameButton: document.querySelector("#newGameButton"),
  resetBoardButton: document.querySelector("#resetBoardButton"),
};

const state = {
  rows: [],
  categories: [],
  board: [],
  scores: { A: 0, B: 0 },
  teamNames: { A: "Team A", B: "Team B" },
  activeClue: null,
  currentTeam: "A",
  lastConfig: null,
};

const DAILY_DOUBLE_COUNT = 2;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) {
    rows.push(row);
  }

  if (rows.length < 2) {
    throw new Error("The CSV needs a header row and at least one question.");
  }

  const headers = rows[0].map((header) => normalizeHeader(header));
  const requiredHeaders = ["cat", "q", "a"];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

  if (missingHeaders.length) {
    throw new Error(`Missing column: ${missingHeaders.join(", ")}`);
  }

  return rows.slice(1).map((sourceRow, rowIndex) => {
    const item = {};
    headers.forEach((header, cellIndex) => {
      item[header] = (sourceRow[cellIndex] || "").trim();
    });

    return {
      id: `row-${rowIndex}`,
      round: item.round || "",
      category: item.cat || item.category || "",
      question: item.q || item.question || "",
      answer: item.a || item.answer || "",
      dailyDouble: false,
    };
  }).filter((item) => item.category && item.question && item.answer);
}

function normalizeHeader(header) {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function groupCategories(rows) {
  const map = new Map();

  rows.forEach((row) => {
    if (!map.has(row.category)) {
      map.set(row.category, []);
    }
    map.get(row.category).push(row);
  });

  return Array.from(map, ([name, questions]) => ({ name, questions }));
}

function handleCsvText(text, fileLabel) {
  try {
    const rows = parseCsv(text);
    const categories = groupCategories(rows);
    const maxQuestions = categories.reduce((max, category) => Math.max(max, category.questions.length), 1);

    state.rows = rows;
    state.categories = categories;
    elements.fileName.textContent = fileLabel;
    elements.csvSummary.textContent = `${rows.length} questions, ${categories.length} categories`;
    elements.csvSummary.classList.remove("is-hidden");
    elements.categoryCount.max = String(categories.length);
    elements.categoryCount.value = String(Math.min(5, categories.length));
    elements.questionCount.max = String(maxQuestions);
    elements.questionCount.value = String(Math.min(5, maxQuestions));
    elements.startButton.disabled = false;
    setSetupError("");
  } catch (error) {
    clearLoadedCsv();
    setSetupError(error.message);
  }
}

function setSetupError(message) {
  elements.setupError.textContent = message;
}

function clearLoadedCsv() {
  state.rows = [];
  state.categories = [];
  elements.csvFile.value = "";
  elements.fileName.textContent = "Choose file";
  elements.csvSummary.classList.add("is-hidden");
  elements.csvSummary.textContent = "";
  elements.startButton.disabled = true;
}

function readNumber(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function startGame(event) {
  event.preventDefault();

  if (!state.categories.length) {
    setSetupError("Choose a CSV file first.");
    return;
  }

  const categoryCount = clamp(readNumber(elements.categoryCount, 5), 1, state.categories.length);
  const maxQuestions = state.categories.reduce((max, category) => Math.max(max, category.questions.length), 1);
  const questionCount = clamp(readNumber(elements.questionCount, 5), 1, maxQuestions);
  const baseValue = readNumber(elements.baseValue, 100);
  const valueStep = readNumber(elements.valueStep, 100);

  const board = buildBoard(categoryCount, questionCount, baseValue, valueStep);

  if (countClues(board) < DAILY_DOUBLE_COUNT) {
    setSetupError("Choose a board with at least 2 questions.");
    return;
  }

  assignDailyDoubles(board);
  state.lastConfig = { categoryCount, questionCount, baseValue, valueStep };
  state.board = board;
  state.scores = { A: 0, B: 0 };
  state.teamNames = readTeamNames();
  state.activeClue = null;
  state.currentTeam = "A";

  renderTeamNames();
  renderScores();
  renderBoard();
  showGameView();
}

function buildBoard(categoryCount, questionCount, baseValue, valueStep) {
  return state.categories.slice(0, categoryCount).map((category, categoryIndex) => {
    const clues = category.questions.slice(0, questionCount).map((question, questionIndex) => ({
      ...question,
      id: `${categoryIndex}-${questionIndex}-${question.id}`,
      value: baseValue + questionIndex * valueStep,
      dailyDouble: false,
      used: false,
    }));

    return {
      name: category.name,
      clues,
    };
  });
}

function countClues(board) {
  return board.reduce((total, category) => total + category.clues.length, 0);
}

function assignDailyDoubles(board) {
  const clues = board.flatMap((category) => category.clues);

  clues.forEach((clue) => {
    clue.dailyDouble = false;
  });

  shuffle(clues).slice(0, DAILY_DOUBLE_COUNT).forEach((clue) => {
    clue.dailyDouble = true;
  });
}

function shuffle(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function renderBoard() {
  elements.board.innerHTML = "";
  const columns = state.board.length;
  const questionRows = state.lastConfig.questionCount;
  const grid = document.createElement("div");
  grid.className = "board-grid";
  grid.style.gridTemplateColumns = `repeat(${columns}, minmax(142px, 1fr))`;

  state.board.forEach((category) => {
    const header = document.createElement("div");
    header.className = "category-cell";
    header.textContent = category.name;
    grid.append(header);
  });

  for (let rowIndex = 0; rowIndex < questionRows; rowIndex += 1) {
    state.board.forEach((category, categoryIndex) => {
      const clue = category.clues[rowIndex];
      const button = document.createElement("button");
      button.className = "clue-cell";
      button.type = "button";

      if (!clue) {
        button.classList.add("is-used");
        button.disabled = true;
        button.textContent = "";
      } else {
        button.textContent = formatScore(clue.value);
        button.disabled = clue.used;
        button.classList.toggle("is-used", clue.used);
        button.addEventListener("click", () => openClue(categoryIndex, rowIndex));
      }

      grid.append(button);
    });
  }

  elements.board.append(grid);
}

function openClue(categoryIndex, clueIndex) {
  const clue = state.board[categoryIndex].clues[clueIndex];
  if (!clue || clue.used) return;

  state.activeClue = {
    categoryIndex,
    clueIndex,
    choosingTeam: state.currentTeam,
    stealTeam: getOtherTeam(state.currentTeam),
    stage: "chooser",
  };
  elements.modalValue.textContent = formatScore(clue.value);
  elements.modalCategory.textContent = clue.category;
  elements.questionText.textContent = clue.question;
  elements.answerText.textContent = clue.answer;
  elements.dailyDoubleBadge.classList.toggle("is-hidden", !clue.dailyDouble);
  elements.answerPanel.classList.add("is-hidden");
  elements.showAnswerButton.disabled = false;
  setModalStage("chooser");
  elements.questionModal.classList.remove("is-hidden");
  elements.showAnswerButton.focus();
}

function closeModal() {
  elements.questionModal.classList.add("is-hidden");
  state.activeClue = null;
}

function revealAnswer() {
  elements.answerPanel.classList.remove("is-hidden");
  elements.showAnswerButton.disabled = true;
}

function setModalStage(stage) {
  if (!state.activeClue) return;

  state.activeClue.stage = stage;
  const choosingTeamName = getTeamName(state.activeClue.choosingTeam);
  const stealTeamName = getTeamName(state.activeClue.stealTeam);
  const isSteal = stage === "steal";

  elements.modalTurnLabel.textContent = isSteal
    ? `${stealTeamName} steal chance`
    : `${choosingTeamName} question`;
  elements.modalTurnHelp.textContent = isSteal
    ? `${stealTeamName} can answer for half points. No points are lost for a miss.`
    : `${choosingTeamName} can win full points, consult for half points, or miss and offer a steal.`;
  elements.fullCorrectButton.classList.toggle("is-hidden", isSteal);
  elements.teamCorrectButton.classList.toggle("is-hidden", isSteal);
  elements.teamMissButton.classList.toggle("is-hidden", isSteal);
  elements.stealCorrectButton.classList.toggle("is-hidden", !isSteal);
  elements.stealMissButton.classList.toggle("is-hidden", !isSteal);
}

function awardFullPoints() {
  const clue = getActiveClue();
  if (!clue || !state.activeClue) return;
  resolveClue(state.activeClue.choosingTeam, clue.value);
}

function awardTeamConsultPoints() {
  const clue = getActiveClue();
  if (!clue || !state.activeClue) return;
  resolveClue(state.activeClue.choosingTeam, getHalfPoints(clue.value));
}

function offerSteal() {
  if (!getActiveClue() || !state.activeClue) return;
  elements.answerPanel.classList.add("is-hidden");
  elements.showAnswerButton.disabled = false;
  setModalStage("steal");
}

function awardStealPoints() {
  const clue = getActiveClue();
  if (!clue || !state.activeClue) return;
  resolveClue(state.activeClue.stealTeam, getHalfPoints(clue.value));
}

function resolveNoScore() {
  if (!getActiveClue() || !state.activeClue) return;
  resolveClue(null, 0);
}

function resolveClue(scoringTeam, points) {
  const clue = getActiveClue();
  if (!clue || !state.activeClue) return;

  if (scoringTeam) {
    state.scores[scoringTeam] += points;
  }

  const choosingTeam = state.activeClue.choosingTeam;
  clue.used = true;
  state.currentTeam = getOtherTeam(choosingTeam);
  renderScores();
  renderBoard();
  closeModal();
}

function getActiveClue() {
  if (!state.activeClue) return null;
  return state.board[state.activeClue.categoryIndex].clues[state.activeClue.clueIndex];
}

function getOtherTeam(team) {
  return team === "A" ? "B" : "A";
}

function getTeamName(team) {
  return state.teamNames[team] || `Team ${team}`;
}

function getHalfPoints(value) {
  return value / 2;
}

function readTeamNames() {
  return {
    A: normalizeTeamName(elements.teamAName.value, "Team A"),
    B: normalizeTeamName(elements.teamBName.value, "Team B"),
  };
}

function normalizeTeamName(name, fallback) {
  const trimmed = name.trim();
  return trimmed || fallback;
}

function renderTeamNames() {
  elements.teamANameLabel.textContent = getTeamName("A");
  elements.teamBNameLabel.textContent = getTeamName("B");
  elements.manualTeamAOption.textContent = getTeamName("A");
  elements.manualTeamBOption.textContent = getTeamName("B");
}

function renderScores() {
  elements.teamAScore.textContent = formatScore(state.scores.A);
  elements.teamBScore.textContent = formatScore(state.scores.B);
  elements.currentTurnLabel.textContent = getTeamName(state.currentTeam);
  document.querySelector(".team-a").classList.toggle("is-turn", state.currentTeam === "A");
  document.querySelector(".team-b").classList.toggle("is-turn", state.currentTeam === "B");
}

function formatScore(value) {
  const absolute = Math.abs(value);
  const formatted = absolute.toLocaleString("en-US");
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
}

function adjustManualScore(multiplier) {
  const points = Number(elements.manualPoints.value);
  if (!Number.isFinite(points) || points === 0) return;
  state.scores[elements.manualTeam.value] += Math.trunc(points) * multiplier;
  renderScores();
}

function resetBoard() {
  if (!state.lastConfig) return;
  state.board = buildBoard(
    state.lastConfig.categoryCount,
    state.lastConfig.questionCount,
    state.lastConfig.baseValue,
    state.lastConfig.valueStep,
  );
  assignDailyDoubles(state.board);
  state.scores = { A: 0, B: 0 };
  state.currentTeam = "A";
  renderScores();
  renderBoard();
  closeModal();
}

function showGameView() {
  elements.setupView.classList.add("is-hidden");
  elements.gameView.classList.remove("is-hidden");
}

function showSetupView() {
  elements.gameView.classList.add("is-hidden");
  elements.setupView.classList.remove("is-hidden");
  closeModal();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

elements.csvFile.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => handleCsvText(String(reader.result || ""), file.name));
  reader.addEventListener("error", () => setSetupError("The file could not be read."));
  reader.readAsText(file);
});

elements.setupForm.addEventListener("submit", startGame);

elements.clearButton.addEventListener("click", () => {
  clearLoadedCsv();
  setSetupError("");
});

elements.manualScoreForm.addEventListener("submit", (event) => {
  event.preventDefault();
  adjustManualScore(1);
});

elements.manualSubtractButton.addEventListener("click", () => adjustManualScore(-1));
elements.closeModalButton.addEventListener("click", closeModal);
elements.showAnswerButton.addEventListener("click", revealAnswer);
elements.fullCorrectButton.addEventListener("click", awardFullPoints);
elements.teamCorrectButton.addEventListener("click", awardTeamConsultPoints);
elements.teamMissButton.addEventListener("click", offerSteal);
elements.stealCorrectButton.addEventListener("click", awardStealPoints);
elements.stealMissButton.addEventListener("click", resolveNoScore);
elements.newGameButton.addEventListener("click", showSetupView);
elements.resetBoardButton.addEventListener("click", resetBoard);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.questionModal.classList.contains("is-hidden")) {
    closeModal();
  }
});