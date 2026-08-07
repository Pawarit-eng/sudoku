import { reactive, computed, watch, onUnmounted, ref } from "vue";
import {
  generatePuzzle,
  generateLinkedPuzzle,
  findAllConflictsFor,
  isBoardComplete,
  analyzeCustomBoard,
} from "../utils/sudokuEngine.js";
import { getLayout } from "../utils/layouts.js";

const STORAGE_KEY = "dad-sudoku-save-v1";
const CLASSIC_CELLS = getLayout("classic").numCells;

function emptyNotes(numCells) {
  return Array.from({ length: numCells }, () => new Set());
}

function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const linkMode = data.linkMode ?? "classic";
    const layout = getLayout(linkMode);
    // Board shape must match the layout it claims to be — guards against a
    // stale save from before a layout definition changed.
    if (!Array.isArray(data.board) || data.board.length !== layout.numCells) return null;
    data.linkMode = linkMode;
    data.notes = data.notes.map((arr) => new Set(arr));
    return data;
  } catch {
    return null;
  }
}

function persist(state) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        board: state.board,
        fixed: state.fixed,
        solution: state.solution,
        notes: state.notes.map((s) => [...s]),
        difficulty: state.difficulty,
        linkMode: state.linkMode,
        seconds: state.seconds,
        won: state.won,
        mode: state.mode,
      })
    );
  } catch {
    // storage might be unavailable (private mode etc.) — fail silently
  }
}

export function useGame() {
  const saved = loadSave();

  const state = reactive({
    board: saved?.board ?? new Array(CLASSIC_CELLS).fill(0),
    fixed: saved?.fixed ?? new Array(CLASSIC_CELLS).fill(false),
    solution: saved?.solution ?? new Array(CLASSIC_CELLS).fill(0),
    notes: saved?.notes ?? emptyNotes(CLASSIC_CELLS),
    difficulty: saved?.difficulty ?? "medium",
    linkMode: saved?.linkMode ?? "classic",
    seconds: saved?.seconds ?? 0,
    won: saved?.won ?? false,
    selected: null, // index into board/notes/fixed
    noteMode: false,
    hasSave: !!saved,
    mode: saved?.mode ?? "play", // "play" | "create"
    createMessage: "",
    highlightNumber: 0, // drives illegal-cell/same-value highlighting on the grid
  });

  // Board geometry for the current linkMode — cells, peer groups, per-board
  // membership. Only changes on newGame/load, cached by id in layouts.js.
  const layout = computed(() => getLayout(state.linkMode));

  let preCreateSnapshot = null;
  const history = ref([]);
  const future = ref([]);

  const conflicts = computed(() => findAllConflictsFor(state.board, layout.value));
  const won = computed(
    () =>
      state.mode === "play" &&
      isBoardComplete(state.board) &&
      conflicts.value.size === 0
  );
  watch(won, (isWon) => {
    if (isWon) state.won = true;
  });

  // --- timer ---
  const timerHandle = setInterval(() => {
    if (state.mode === "play" && !state.won && !isBoardComplete(state.board))
      state.seconds++;
  }, 1000);
  onUnmounted(() => clearInterval(timerHandle));

  const formattedTime = computed(() => {
    const m = Math.floor(state.seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (state.seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  });

  function snapshot() {
    return {
      board: state.board.slice(),
      notes: state.notes.map((s) => new Set(s)),
    };
  }

  function pushHistory() {
    history.value.push(snapshot());
    if (history.value.length > 200) history.value.shift();
    future.value.length = 0;
  }

  // Generates a fresh puzzle. `linkMode` picks the board layout (classic or
  // one of the linked multi-board shapes from layouts.js); classic keeps
  // using the original single-board generator, other modes go through the
  // generalized multi-board one.
  function newGame(linkMode = state.linkMode, difficulty = state.difficulty) {
    const safeDifficulty = difficulty === "custom" ? "medium" : difficulty;
    const nextLayout = getLayout(linkMode);
    const { puzzle, solution } =
      linkMode === "classic"
        ? generatePuzzle(safeDifficulty)
        : generateLinkedPuzzle(nextLayout, safeDifficulty);
    state.board = puzzle.slice();
    state.solution = solution;
    state.fixed = puzzle.map((v) => v !== 0);
    state.notes = emptyNotes(nextLayout.numCells);
    state.linkMode = linkMode;
    state.difficulty = safeDifficulty;
    state.seconds = 0;
    state.won = false;
    state.selected = null;
    state.highlightNumber = 0;
    state.noteMode = false;
    state.mode = "play";
    state.createMessage = "";
    preCreateSnapshot = null;
    history.value.length = 0;
    future.value.length = 0;
  }

  // Clears every non-clue cell back to blank, keeping the same puzzle/solution.
  // Takes a snapshot first so a single undo can bring the filled-in board back.
  function restartPuzzle() {
    if (state.mode !== "play") return;
    pushHistory();
    for (let i = 0; i < state.board.length; i++) {
      if (!state.fixed[i]) {
        state.board[i] = 0;
        state.notes[i].clear();
      }
    }
    state.seconds = 0;
    state.won = false;
    state.selected = null;
    state.highlightNumber = 0;
    state.noteMode = false;
  }

  // --- custom puzzle creation (classic single board only) ---

  function startCreate() {
    if (state.mode !== "create") {
      preCreateSnapshot = {
        board: state.board.slice(),
        fixed: state.fixed.slice(),
        notes: state.notes.map((s) => new Set(s)),
        solution: state.solution.slice(),
        difficulty: state.difficulty,
        linkMode: state.linkMode,
        seconds: state.seconds,
        won: state.won,
      };
    }
    state.board = new Array(CLASSIC_CELLS).fill(0);
    state.fixed = new Array(CLASSIC_CELLS).fill(false);
    state.notes = emptyNotes(CLASSIC_CELLS);
    state.solution = new Array(CLASSIC_CELLS).fill(0);
    state.difficulty = "custom";
    state.linkMode = "classic";
    state.seconds = 0;
    state.won = false;
    state.selected = null;
    state.highlightNumber = 0;
    state.noteMode = false;
    state.mode = "create";
    state.createMessage = "";
    history.value.length = 0;
    future.value.length = 0;
  }

  function cancelCreate() {
    if (preCreateSnapshot) {
      state.board = preCreateSnapshot.board;
      state.fixed = preCreateSnapshot.fixed;
      state.notes = preCreateSnapshot.notes;
      state.solution = preCreateSnapshot.solution;
      state.difficulty = preCreateSnapshot.difficulty;
      state.linkMode = preCreateSnapshot.linkMode;
      state.seconds = preCreateSnapshot.seconds;
      state.won = preCreateSnapshot.won;
      preCreateSnapshot = null;
      state.mode = "play";
    } else {
      newGame("classic", "medium");
    }
    state.createMessage = "";
    state.selected = null;
    state.highlightNumber = 0;
    history.value.length = 0;
    future.value.length = 0;
  }

  function clearCreateBoard() {
    state.board = new Array(CLASSIC_CELLS).fill(0);
    state.notes = emptyNotes(CLASSIC_CELLS);
    state.createMessage = "";
    history.value.length = 0;
    future.value.length = 0;
  }

  // Validates the hand-entered board; on success, locks the filled cells in
  // as clues and switches into normal play against the found solution.
  function confirmCustomPuzzle() {
    const result = analyzeCustomBoard(state.board);

    if (result.status === "conflict") {
      state.createMessage = "มีเลขซ้ำกันในแถว/คอลัมน์/บล็อกเดียวกัน (ช่องสีแดง) แก้ก่อนนะ";
      return false;
    }
    if (result.status === "unsolvable") {
      state.createMessage = "โจทย์นี้แก้ไม่ได้เลย ลองแก้เลขที่ใส่ไปดูใหม่";
      return false;
    }
    if (result.status === "multiple") {
      state.createMessage = "โจทย์นี้ยังตอบได้มากกว่า 1 แบบ ลองใส่เลขเพิ่มอีกนิดให้เหลือคำตอบเดียว";
      return false;
    }

    state.fixed = state.board.map((v) => v !== 0);
    state.solution = result.solution;
    state.notes = emptyNotes(CLASSIC_CELLS);
    state.seconds = 0;
    state.won = false;
    state.selected = null;
    state.highlightNumber = 0;
    state.mode = "play";
    state.createMessage = "";
    preCreateSnapshot = null;
    history.value.length = 0;
    future.value.length = 0;
    return true;
  }

  function select(i) {
    state.selected = i;
    state.highlightNumber = state.board[i];
  }

  function clearNotesAround(i, num) {
    for (const p of layout.value.peers[i]) state.notes[p].delete(num);
  }

  function inputNumber(num) {
    const i = state.selected;
    if (i === null || i === undefined) return;
    if (state.fixed[i]) return;

    pushHistory();

    if (state.noteMode) {
      const set = state.notes[i];
      if (set.has(num)) set.delete(num);
      else set.add(num);
      state.board[i] = 0;
    } else {
      const next = state.board[i] === num ? 0 : num;
      state.board[i] = next;
      state.notes[i].clear();
      if (next !== 0) clearNotesAround(i, next);
      state.highlightNumber = next;
    }
  }

  function eraseSelected() {
    const i = state.selected;
    if (i === null || i === undefined) return;
    if (state.fixed[i]) return;
    pushHistory();
    state.board[i] = 0;
    state.notes[i].clear();
  }

  function toggleNoteMode() {
    state.noteMode = !state.noteMode;
  }

  function undo() {
    if (!history.value.length) return;
    future.value.push(snapshot());
    const prev = history.value.pop();
    state.board = prev.board;
    state.notes = prev.notes;
  }

  function redo() {
    if (!future.value.length) return;
    history.value.push(snapshot());
    const next = future.value.pop();
    state.board = next.board;
    state.notes = next.notes;
  }

  // Fills every empty, non-fixed cell with its remaining candidates (1-9 minus
  // what's already used among that cell's peers) — a "fill all notes" helper
  // covering the whole board in one tap, not just the selected cell.
  function autoNoteAll() {
    pushHistory();
    const L = layout.value;
    for (let i = 0; i < L.numCells; i++) {
      if (state.fixed[i] || state.board[i] !== 0) continue;
      const used = new Set();
      for (const p of L.peers[i]) if (state.board[p]) used.add(state.board[p]);
      const set = new Set();
      for (let n = 1; n <= 9; n++) if (!used.has(n)) set.add(n);
      state.notes[i] = set;
    }
  }

  // Wipes every pencil mark on the board, leaving placed numbers untouched.
  function clearAllNotes() {
    pushHistory();
    state.notes = emptyNotes(layout.value.numCells);
  }

  if (!saved) newGame();

  watch(
    () => [
      state.board,
      state.notes,
      state.fixed,
      state.solution,
      state.difficulty,
      state.linkMode,
      state.seconds,
      state.won,
      state.mode,
    ],
    () => persist(state),
    { deep: true }
  );

  return {
    state,
    layout,
    conflicts,
    won,
    formattedTime,
    newGame,
    select,
    inputNumber,
    eraseSelected,
    toggleNoteMode,
    undo,
    redo,
    autoNoteAll,
    clearAllNotes,
    restartPuzzle,
    startCreate,
    cancelCreate,
    clearCreateBoard,
    confirmCustomPuzzle,
    canUndo: computed(() => history.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
  };
}
