// layouts.js — geometry for the "linked board" modes (classic single board,
// plus Samurai-style boards joined edge-to-edge sharing real cells).
//
// A board's origin is given in BLOCK units (1 block = 3 cells). Board bi
// occupies global cell rows [blockRow*3, blockRow*3+9) and cols
// [blockCol*3, blockCol*3+9) — a normal 9x9 sudoku. Two boards sharing the
// same global cells are literally linked: a digit placed there must satisfy
// both boards' rows/cols/boxes at once.
//
// Vertical modes always share one full block-ROW band (3 cell-rows) at the
// seam; the "1/2/3" overlap count sets how many of that band's 3 blocks are
// the same cells (col offset = 3 - overlap). Horizontal modes mirror this
// with rows/cols swapped.

// Generates a chain of `count` boards along `axis`:
//  - "v" stacks downward, sharing a block-ROW band each link.
//  - "h" stacks rightward, sharing a block-COLUMN band each link.
//  - "d" steps diagonally (down-right each link), touching the next board
//    at a single corner block only — diagonal connections are always a
//    1-block (9-cell) corner overlap, there's no wider "band" to share.
// `overlapBlocks` (1-3, ignored for "d") sets how many of the shared band's
// 3 blocks are literally the same cells — see module doc.
// `zigzag: true` alternates the offset direction each link (board 3 lands
// back under/right-of board 1, board 4 back where board 2 was, ...), which
// is what keeps a long chain from drifting off-screen — same shape as the
// "connected boards" puzzles in other sudoku apps.
function chainBoards({ axis, overlapBlocks, count, zigzag = false }) {
  const shift = 3 - overlapBlocks; // blocks
  const boards = [{ blockRow: 0, blockCol: 0 }];
  let dir = 1;
  for (let i = 1; i < count; i++) {
    const prev = boards[i - 1];
    const delta = zigzag ? dir * shift : shift;
    if (zigzag) dir *= -1;
    let next;
    if (axis === "v") next = { blockRow: prev.blockRow + 2, blockCol: prev.blockCol + delta };
    else if (axis === "h") next = { blockRow: prev.blockRow + delta, blockCol: prev.blockCol + 2 };
    else next = { blockRow: prev.blockRow + 2, blockCol: prev.blockCol + 2 }; // "d"
    boards.push(next);
  }
  return boards;
}

export const LINK_MODES = [
  { id: "classic", label: "กระดานเดี่ยว", boards: [{ blockRow: 0, blockCol: 0 }] },

  { id: "v-1x2", label: "เชื่อม 1 แนวตั้ง", boards: chainBoards({ axis: "v", overlapBlocks: 1, count: 2 }) },
  { id: "v-2x2", label: "เชื่อม 2 แนวตั้ง", boards: chainBoards({ axis: "v", overlapBlocks: 2, count: 2 }) },
  { id: "v-3x2", label: "เชื่อม 3 แนวตั้ง (2 กระดาน)", boards: chainBoards({ axis: "v", overlapBlocks: 3, count: 2 }) },
  { id: "v-3x3", label: "เชื่อม 3 แนวตั้ง (3 กระดาน)", boards: chainBoards({ axis: "v", overlapBlocks: 3, count: 3 }) },

  { id: "h-1x2", label: "เชื่อม 1 แนวนอน", boards: chainBoards({ axis: "h", overlapBlocks: 1, count: 2 }) },
  { id: "h-2x2", label: "เชื่อม 2 แนวนอน", boards: chainBoards({ axis: "h", overlapBlocks: 2, count: 2 }) },
  { id: "h-3x2", label: "เชื่อม 3 แนวนอน (2 กระดาน)", boards: chainBoards({ axis: "h", overlapBlocks: 3, count: 2 }) },
  { id: "h-3x3", label: "เชื่อม 3 แนวนอน (3 กระดาน)", boards: chainBoards({ axis: "h", overlapBlocks: 3, count: 3 }) },

  // Zigzag chains: 1-block overlap each link, alternating side — a long
  // snake of boards instead of a single straight seam. Capped at 3 boards.
  { id: "vz-3", label: "ซิกแซก 3 กระดาน (แนวตั้ง)", boards: chainBoards({ axis: "v", overlapBlocks: 1, count: 3, zigzag: true }) },
  { id: "hz-3", label: "ซิกแซก 3 กระดาน (แนวนอน)", boards: chainBoards({ axis: "h", overlapBlocks: 1, count: 3, zigzag: true }) },

  // Diagonal chain: each board touches the next at just one corner block.
  { id: "d-3", label: "ทแยง 3 กระดาน", boards: chainBoards({ axis: "d", count: 3 }) },
];

const BOX = 3;
const BOARD_SIZE = 9;

function modeById(modeId) {
  const mode = LINK_MODES.find((m) => m.id === modeId);
  if (!mode) throw new Error(`Unknown link mode: ${modeId}`);
  return mode;
}

// Builds full layout metadata for a mode: the global cell grid, which
// board(s)/local-coords each cell belongs to, the 27-cells-per-board unit
// list (rows/cols/boxes), and the peer set every solver/UI need.
export function buildLayout(modeId) {
  const mode = modeById(modeId);

  // Pass A: for every board, walk its 81 local cells and record global
  // (row, col) -> which board + local coords land there.
  const membershipByKey = new Map(); // "row,col" -> [{ board, localRow, localCol }]
  for (let bi = 0; bi < mode.boards.length; bi++) {
    const { blockRow, blockCol } = mode.boards[bi];
    const originRow = blockRow * BOX;
    const originCol = blockCol * BOX;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const key = `${originRow + r},${originCol + c}`;
        const entry = { board: bi, localRow: r, localCol: c };
        if (membershipByKey.has(key)) membershipByKey.get(key).push(entry);
        else membershipByKey.set(key, [entry]);
      }
    }
  }

  // Pass B: bounding box + deterministic row-major cell indices.
  let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
  for (const key of membershipByKey.keys()) {
    const [row, col] = key.split(",").map(Number);
    if (row < minRow) minRow = row;
    if (row > maxRow) maxRow = row;
    if (col < minCol) minCol = col;
    if (col > maxCol) maxCol = col;
  }
  const width = maxCol - minCol + 1;
  const height = maxRow - minRow + 1;

  const indexAt = Array.from({ length: height }, () => new Array(width).fill(-1));
  const cells = [];
  const boardCellIndices = mode.boards.map(() => new Array(BOARD_SIZE * BOARD_SIZE).fill(-1));

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const key = `${row},${col}`;
      const memberships = membershipByKey.get(key);
      if (!memberships) continue;
      const cellIndex = cells.length;
      indexAt[row - minRow][col - minCol] = cellIndex;
      // row/col stored relative to the bounding box (0-based) — the
      // coordinate space every consumer (renderer, activeAt) uses.
      cells.push({ row: row - minRow, col: col - minCol, memberships });
      for (const { board, localRow, localCol } of memberships) {
        boardCellIndices[board][localRow * BOARD_SIZE + localCol] = cellIndex;
      }
    }
  }

  const numCells = cells.length;

  // Units: 27 per board (9 rows, 9 cols, 9 boxes), each a list of global
  // cell indices. Shared cells simply show up in units from >1 board.
  const units = [];
  for (let bi = 0; bi < mode.boards.length; bi++) {
    const bc = boardCellIndices[bi];
    for (let r = 0; r < BOARD_SIZE; r++) {
      units.push(Array.from({ length: BOARD_SIZE }, (_, c) => bc[r * BOARD_SIZE + c]));
    }
    for (let c = 0; c < BOARD_SIZE; c++) {
      units.push(Array.from({ length: BOARD_SIZE }, (_, r) => bc[r * BOARD_SIZE + c]));
    }
    for (let br = 0; br < BOARD_SIZE; br += BOX) {
      for (let bcCol = 0; bcCol < BOARD_SIZE; bcCol += BOX) {
        const box = [];
        for (let r = br; r < br + BOX; r++)
          for (let c = bcCol; c < bcCol + BOX; c++) box.push(bc[r * BOARD_SIZE + c]);
        units.push(box);
      }
    }
  }

  const peers = Array.from({ length: numCells }, () => new Set());
  for (const unit of units) {
    for (const a of unit) {
      for (const b of unit) {
        if (a !== b) peers[a].add(b);
      }
    }
  }

  const boards = mode.boards.map((origin, bi) => ({
    ...origin,
    cellIndices: boardCellIndices[bi],
  }));

  // row/col here are bounding-box-relative (0-based), matching cells[].row/col.
  function activeAt(row, col) {
    if (row < 0 || row >= height || col < 0 || col >= width) return -1;
    return indexAt[row][col];
  }

  return { id: mode.id, label: mode.label, boards, cells, numCells, units, peers, width, height, activeAt };
}

let layoutCache = null;
// Layouts are pure functions of the mode id and never mutated once built —
// cache the last one so re-deriving it on every reactive tick is free.
export function getLayout(modeId) {
  if (layoutCache && layoutCache.id === modeId) return layoutCache.layout;
  const layout = buildLayout(modeId);
  layoutCache = { id: modeId, layout };
  return layout;
}
