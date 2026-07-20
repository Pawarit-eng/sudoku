// sudokuEngine.js — generation, solving, validation for a 9x9 sudoku.
// Board representation: flat array of 81 numbers, 0 = empty, row-major (index = row*9 + col).

const SIZE = 9;
const BOX = 3;

function idx(row, col) {
  return row * SIZE + col;
}

function cellsInRow(row) {
  const out = [];
  for (let c = 0; c < SIZE; c++) out.push(idx(row, c));
  return out;
}
function cellsInCol(col) {
  const out = [];
  for (let r = 0; r < SIZE; r++) out.push(idx(r, col));
  return out;
}
function cellsInBox(row, col) {
  const out = [];
  const br = Math.floor(row / BOX) * BOX;
  const bc = Math.floor(col / BOX) * BOX;
  for (let r = br; r < br + BOX; r++) {
    for (let c = bc; c < bc + BOX; c++) out.push(idx(r, c));
  }
  return out;
}

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Is `num` legal to place at (row, col) given the current board?
function isSafe(board, row, col, num) {
  for (const i of cellsInRow(row)) if (board[i] === num) return false;
  for (const i of cellsInCol(col)) if (board[i] === num) return false;
  for (const i of cellsInBox(row, col)) if (board[i] === num) return false;
  return true;
}

// Backtracking fill of a full valid board, randomized so each call differs.
function generateSolvedBoard() {
  const board = new Array(81).fill(0);

  function fill(pos) {
    if (pos === 81) return true;
    const row = Math.floor(pos / SIZE);
    const col = pos % SIZE;
    for (const num of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (isSafe(board, row, col, num)) {
        board[pos] = num;
        if (fill(pos + 1)) return true;
        board[pos] = 0;
      }
    }
    return false;
  }

  fill(0);
  return board;
}

// Shared MRV (most-constrained-cell-first) backtracking search. Counts
// solutions up to `limit` and, if it finds exactly one before hitting the
// limit, hands back a snapshot of it — used both for the puzzle-digger's
// uniqueness check and for validating a hand-entered custom puzzle.
function solveAnalysis(board, limit = 2) {
  const b = board.slice();
  let count = 0;
  let firstSolution = null;

  function candidatesFor(pos) {
    const row = Math.floor(pos / SIZE);
    const col = pos % SIZE;
    const used = new Set();
    for (const i of cellsInRow(row)) if (b[i]) used.add(b[i]);
    for (const i of cellsInCol(col)) if (b[i]) used.add(b[i]);
    for (const i of cellsInBox(row, col)) if (b[i]) used.add(b[i]);
    const out = [];
    for (let n = 1; n <= 9; n++) if (!used.has(n)) out.push(n);
    return out;
  }

  // Picks the empty cell with the fewest legal candidates (fails fast).
  function mostConstrainedCell() {
    let bestPos = -1;
    let bestCandidates = null;
    for (let i = 0; i < 81; i++) {
      if (b[i] !== 0) continue;
      const cands = candidatesFor(i);
      if (cands.length === 0) return { pos: i, candidates: [] }; // dead end, bail fast
      if (!bestCandidates || cands.length < bestCandidates.length) {
        bestPos = i;
        bestCandidates = cands;
        if (cands.length === 1) break; // can't do better than 1
      }
    }
    return bestPos === -1 ? null : { pos: bestPos, candidates: bestCandidates };
  }

  function solve() {
    if (count >= limit) return;
    const next = mostConstrainedCell();
    if (next === null) {
      count++;
      if (count === 1) firstSolution = b.slice();
      return;
    }
    if (next.candidates.length === 0) return; // dead end
    for (const num of next.candidates) {
      if (count >= limit) return;
      b[next.pos] = num;
      solve();
      b[next.pos] = 0;
    }
  }

  solve();
  return { count, firstSolution };
}

function countSolutions(board, limit = 2) {
  return solveAnalysis(board, limit).count;
}

// Validates a board the user typed in by hand (a custom puzzle). Returns one
// of:
//   { status: "conflict", conflicts }  — duplicate digits in a row/col/box
//   { status: "unsolvable" }           — no arrangement completes it
//   { status: "multiple" }             — more than one valid completion
//   { status: "unique", solution }     — exactly one valid completion
export function analyzeCustomBoard(board) {
  const conflicts = findAllConflicts(board);
  if (conflicts.size > 0) return { status: "conflict", conflicts };

  const { count, firstSolution } = solveAnalysis(board, 2);
  if (count === 0) return { status: "unsolvable" };
  if (count >= 2) return { status: "multiple" };
  return { status: "unique", solution: firstSolution };
}

// Difficulty presets: how many clues to leave on the board (out of 81).
const DIFFICULTY_CLUES = {
  easy: 40,
  medium: 32,
  hard: 26,
  expert: 22,
};

// Removes clues one at a time (random order), only keeping a removal if the
// puzzle still has a unique solution.
function digHoles(solved, targetClues) {
  const puzzle = solved.slice();
  const order = shuffled([...Array(81).keys()]);
  let clues = 81;

  for (const pos of order) {
    if (clues <= targetClues) break;
    const backup = puzzle[pos];
    puzzle[pos] = 0;
    const solutions = countSolutions(puzzle, 2);
    if (solutions === 1) {
      clues--;
    } else {
      puzzle[pos] = backup; // removing this one broke uniqueness, keep it
    }
  }
  return puzzle;
}

// Public: generate a { puzzle, solution } pair for a given difficulty.
export function generatePuzzle(difficulty = "medium") {
  const solution = generateSolvedBoard();
  const targetClues = DIFFICULTY_CLUES[difficulty] ?? DIFFICULTY_CLUES.medium;
  const puzzle = digHoles(solution, targetClues);
  return { puzzle, solution };
}

// Does placing `num` at (row, col) conflict with the current board?
export function hasConflict(board, row, col, num) {
  if (num === 0) return false;
  const i = idx(row, col);
  for (const c of cellsInRow(row)) if (c !== i && board[c] === num) return true;
  for (const c of cellsInCol(col)) if (c !== i && board[c] === num) return true;
  for (const c of cellsInBox(row, col)) if (c !== i && board[c] === num) return true;
  return false;
}

// Returns a Set of (row,col) indices (as "r-c" strings) that currently conflict.
export function findAllConflicts(board) {
  const conflicts = new Set();
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const num = board[idx(row, col)];
      if (num !== 0 && hasConflict(board, row, col, num)) {
        conflicts.add(`${row}-${col}`);
      }
    }
  }
  return conflicts;
}

export function isBoardComplete(board) {
  return board.every((v) => v !== 0);
}

export function boardsEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export { idx, DIFFICULTY_CLUES };
