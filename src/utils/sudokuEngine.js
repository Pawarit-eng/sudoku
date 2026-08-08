// sudokuEngine.js — generation, solving, validation.
//
// Core solving/generation logic is layout-generic: a puzzle is just
// `numCells` cells plus a `peers` array (peers[i] = Set of cell indices that
// must not repeat i's value). A classic 9x9 board is one such layout with
// 81 cells; a linked multi-board puzzle (see layouts.js) is another, where
// shared cells simply have peers pulled from more than one board. Classic
// exports below are thin wrappers around that generic core so the existing
// single-board and custom-puzzle flows are unaffected.

import { getLayout } from "./layouts.js";

const SIZE = 9;
const BOX = 3;

function idx(row, col) {
  return row * SIZE + col;
}

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- generic core (works for any layout's numCells/peers) ---

function genericIsSafe(board, peers, cell, num) {
  for (const p of peers[cell]) if (board[p] === num) return false;
  return true;
}

function genericCandidatesFor(board, peers, cell) {
  const used = new Set();
  for (const p of peers[cell]) if (board[p]) used.add(board[p]);
  const out = [];
  for (let n = 1; n <= 9; n++) if (!used.has(n)) out.push(n);
  return out;
}

// Picks the empty cell with the fewest legal candidates (fails fast).
function genericMostConstrainedCell(board, peers, numCells) {
  let bestPos = -1;
  let bestCandidates = null;
  for (let i = 0; i < numCells; i++) {
    if (board[i] !== 0) continue;
    const cands = genericCandidatesFor(board, peers, i);
    if (cands.length === 0) return { pos: i, candidates: [] }; // dead end, bail fast
    if (!bestCandidates || cands.length < bestCandidates.length) {
      bestPos = i;
      bestCandidates = cands;
      if (cands.length === 1) break; // can't do better than 1
    }
  }
  return bestPos === -1 ? null : { pos: bestPos, candidates: bestCandidates };
}

// MRV backtracking search. Counts solutions up to `limit` and, if it finds
// exactly one before hitting the limit, hands back a snapshot of it — used
// both for the puzzle-digger's uniqueness check and for validating a
// hand-entered custom puzzle. `nodeBudget` bounds how many cells this single
// search will visit before giving up (`aborted: true`) — a large linked
// layout with very few clues left can otherwise search near-endlessly
// trying to prove uniqueness of an under-constrained puzzle.
function genericSolveAnalysis(board, peers, numCells, limit = 2, nodeBudget = Infinity) {
  const b = board.slice();
  let count = 0;
  let firstSolution = null;
  let nodes = 0;
  let aborted = false;

  function solve() {
    if (count >= limit || aborted) return;
    if (++nodes > nodeBudget) {
      aborted = true;
      return;
    }
    const next = genericMostConstrainedCell(b, peers, numCells);
    if (next === null) {
      count++;
      if (count === 1) firstSolution = b.slice();
      return;
    }
    if (next.candidates.length === 0) return; // dead end
    for (const num of next.candidates) {
      if (count >= limit || aborted) return;
      b[next.pos] = num;
      solve();
      b[next.pos] = 0;
    }
  }

  solve();
  return { count, firstSolution, aborted };
}

// Backtracking fill of a full valid board, randomized so each call differs.
function genericGenerateSolvedBoard(numCells, peers) {
  const board = new Array(numCells).fill(0);

  function fill(pos) {
    if (pos === numCells) return true;
    for (const num of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (genericIsSafe(board, peers, pos, num)) {
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

// Removes clues one at a time (random order), only keeping a removal if the
// puzzle still has a unique solution. Bounded on two levels so a big linked
// layout can't hang the UI: each uniqueness check gets a node budget (an
// inconclusive check is treated as "unsafe, keep the clue"), and the whole
// dig stops early past a wall-clock budget, settling for a puzzle with a
// few more clues than the nominal target rather than freezing.
function genericDigHoles(solved, peers, numCells, targetClues) {
  const puzzle = solved.slice();
  const order = shuffled([...Array(numCells).keys()]);
  let clues = numCells;
  const nodeBudget = 15000;
  const deadline = Date.now() + 8000;

  for (const pos of order) {
    if (clues <= targetClues) break;
    if (Date.now() > deadline) break;
    const backup = puzzle[pos];
    puzzle[pos] = 0;
    const { count, aborted } = genericSolveAnalysis(puzzle, peers, numCells, 2, nodeBudget);
    if (count === 1 && !aborted) {
      clues--;
    } else {
      puzzle[pos] = backup; // removing this one broke uniqueness (or we couldn't prove it didn't), keep it
    }
  }
  return puzzle;
}

function genericHasConflict(board, peers, cell, num) {
  if (num === 0) return false;
  for (const p of peers[cell]) if (board[p] === num) return true;
  return false;
}

function genericFindAllConflicts(board, peers, numCells) {
  const conflicts = new Set();
  for (let i = 0; i < numCells; i++) {
    const num = board[i];
    if (num !== 0 && genericHasConflict(board, peers, i, num)) conflicts.add(i);
  }
  return conflicts;
}

// --- classic 9x9 (default layout — same cell indexing as the old row*9+col
// scheme, so these wrappers keep their exact original signatures/behavior) ---

const CLASSIC = getLayout("classic");

// Validates a board the user typed in by hand (a custom puzzle). Returns one
// of:
//   { status: "conflict", conflicts }  — duplicate digits in a row/col/box
//   { status: "unsolvable" }           — no arrangement completes it
//   { status: "multiple" }             — more than one valid completion
//   { status: "unique", solution }     — exactly one valid completion
export function analyzeCustomBoard(board) {
  const conflicts = findAllConflicts(board);
  if (conflicts.size > 0) return { status: "conflict", conflicts };

  const { count, firstSolution } = genericSolveAnalysis(board, CLASSIC.peers, CLASSIC.numCells, 2);
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

// Public: generate a { puzzle, solution } pair for a given difficulty.
export function generatePuzzle(difficulty = "medium") {
  const solution = genericGenerateSolvedBoard(CLASSIC.numCells, CLASSIC.peers);
  const targetClues = DIFFICULTY_CLUES[difficulty] ?? DIFFICULTY_CLUES.medium;
  const puzzle = genericDigHoles(solution, CLASSIC.peers, CLASSIC.numCells, targetClues);
  return { puzzle, solution };
}

// Does placing `num` at (row, col) conflict with the current board?
export function hasConflict(board, row, col, num) {
  return genericHasConflict(board, CLASSIC.peers, idx(row, col), num);
}

// Returns a Set of conflicting cell indices.
export function findAllConflicts(board) {
  return genericFindAllConflicts(board, CLASSIC.peers, CLASSIC.numCells);
}

export function isBoardComplete(board) {
  return board.every((v) => v !== 0);
}

export function boardsEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// --- linked (multi-board) puzzles ---

// Public: generate a { puzzle, solution } pair for an arbitrary layout
// (from layouts.js). Target clue count scales the classic percentage
// (clues/81) up to the layout's actual cell count.
export function generateLinkedPuzzle(layout, difficulty = "medium") {
  const solution = genericGenerateSolvedBoard(layout.numCells, layout.peers);
  const classicClues = DIFFICULTY_CLUES[difficulty] ?? DIFFICULTY_CLUES.medium;
  const targetClues = Math.round((classicClues / 81) * layout.numCells);
  const puzzle = genericDigHoles(solution, layout.peers, layout.numCells, targetClues);
  return { puzzle, solution };
}

export function hasConflictAt(board, layout, cell, num) {
  return genericHasConflict(board, layout.peers, cell, num);
}

export function findAllConflictsFor(board, layout) {
  return genericFindAllConflicts(board, layout.peers, layout.numCells);
}

export { idx, DIFFICULTY_CLUES };
