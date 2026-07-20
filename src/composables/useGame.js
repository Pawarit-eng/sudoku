import { reactive, computed, watch, onUnmounted, ref } from "vue";
import {
  generatePuzzle,
  findAllConflicts,
  isBoardComplete,
  analyzeCustomBoard,
} from "../utils/sudokuEngine.js";

const STORAGE_KEY = "dad-sudoku-save-v1";

function emptyNotes() {
  return Array.from({ length: 81 }, () => new Set());
}

function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
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
    board: saved?.board ?? new Array(81).fill(0),
    fixed: saved?.fixed ?? new Array(81).fill(false),
    solution: saved?.solution ?? new Array(81).fill(0),
    notes: saved?.notes ?? emptyNotes(),
    difficulty: saved?.difficulty ?? "medium",
    seconds: saved?.seconds ?? 0,
    won: saved?.won ?? false,
    selected: null, // index 0-80
    noteMode: false,
    hasSave: !!saved,
    mode: saved?.mode ?? "play", // "play" | "create"
    createMessage: "",
    highlightNumber: 0, // drives illegal-cell/same-value highlighting on the grid
  });

  let preCreateSnapshot = null;
  const history = ref([]);
  const future = ref([]);

  const conflicts = computed(() => findAllConflicts(state.board));
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

  function newGame(difficulty = state.difficulty) {
    const safeDifficulty = difficulty === "custom" ? "medium" : difficulty;
    const { puzzle, solution } = generatePuzzle(safeDifficulty);
    state.board = puzzle.slice();
    state.solution = solution;
    state.fixed = puzzle.map((v) => v !== 0);
    state.notes = emptyNotes();
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
    for (let i = 0; i < 81; i++) {
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

  // --- custom puzzle creation ---

  function startCreate() {
    if (state.mode !== "create") {
      preCreateSnapshot = {
        board: state.board.slice(),
        fixed: state.fixed.slice(),
        notes: state.notes.map((s) => new Set(s)),
        solution: state.solution.slice(),
        difficulty: state.difficulty,
        seconds: state.seconds,
        won: state.won,
      };
    }
    state.board = new Array(81).fill(0);
    state.fixed = new Array(81).fill(false);
    state.notes = emptyNotes();
    state.solution = new Array(81).fill(0);
    state.difficulty = "custom";
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
      state.seconds = preCreateSnapshot.seconds;
      state.won = preCreateSnapshot.won;
      preCreateSnapshot = null;
      state.mode = "play";
    } else {
      newGame("medium");
    }
    state.createMessage = "";
    state.selected = null;
    state.highlightNumber = 0;
    history.value.length = 0;
    future.value.length = 0;
  }

  function clearCreateBoard() {
    state.board = new Array(81).fill(0);
    state.notes = emptyNotes();
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
    state.notes = emptyNotes();
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
    const row = Math.floor(i / 9);
    const col = i % 9;
    for (let c = 0; c < 9; c++) state.notes[row * 9 + c].delete(num);
    for (let r = 0; r < 9; r++) state.notes[r * 9 + col].delete(num);
    const br = Math.floor(row / 3) * 3;
    const bc = Math.floor(col / 3) * 3;
    for (let r = br; r < br + 3; r++)
      for (let c = bc; c < bc + 3; c++) state.notes[r * 9 + c].delete(num);
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
  // what's already used in that cell's row/col/box) — a "fill all notes"
  // helper covering the whole board in one tap, not just the selected cell.
  function autoNoteAll() {
    pushHistory();
    for (let i = 0; i < 81; i++) {
      if (state.fixed[i] || state.board[i] !== 0) continue;
      const row = Math.floor(i / 9);
      const col = i % 9;
      const used = new Set();
      for (let c = 0; c < 9; c++) used.add(state.board[row * 9 + c]);
      for (let r = 0; r < 9; r++) used.add(state.board[r * 9 + col]);
      const br = Math.floor(row / 3) * 3;
      const bc = Math.floor(col / 3) * 3;
      for (let r = br; r < br + 3; r++)
        for (let c = bc; c < bc + 3; c++) used.add(state.board[r * 9 + c]);
      const set = new Set();
      for (let n = 1; n <= 9; n++) if (!used.has(n)) set.add(n);
      state.notes[i] = set;
    }
  }

  // Wipes every pencil mark on the board, leaving placed numbers untouched.
  function clearAllNotes() {
    pushHistory();
    state.notes = emptyNotes();
  }

  if (!saved) newGame(state.difficulty);

  watch(
    () => [
      state.board,
      state.notes,
      state.fixed,
      state.solution,
      state.difficulty,
      state.seconds,
      state.won,
      state.mode,
    ],
    () => persist(state),
    { deep: true }
  );

  return {
    state,
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
