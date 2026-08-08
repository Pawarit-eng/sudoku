<script setup>
import { computed } from "vue";

const props = defineProps({
  board: { type: Array, required: true },
  fixed: { type: Array, required: true },
  notes: { type: Array, required: true },
  solution: { type: Array, required: true },
  selected: { type: Number, default: null },
  highlightNumber: { type: Number, default: 0 },
  conflicts: { type: Set, required: true },
  layout: { type: Object, required: true },
});
const emit = defineEmits(["select"]);

// Every board-bounding-box position, active ones carrying their cell index
// (inactive ones — the "holes" in a staircase layout — render as blanks).
const gridCells = computed(() => {
  const L = props.layout;
  const out = [];
  for (let r = 0; r < L.height; r++) {
    for (let c = 0; c < L.width; c++) {
      out.push({ key: `${r}-${c}`, index: L.activeAt(r, c) });
    }
  }
  return out;
});

const gridStyle = computed(() => ({
  "--cols": props.layout.width,
  "--rows": props.layout.height,
}));

// Thick block-boundary borders, unioned across every board a cell belongs
// to (a shared block is a boundary for both boards at once, so this just
// works without special-casing the seam).
const borderInfo = computed(() =>
  props.layout.cells.map((cell) => {
    let top = false, left = false, right = false, bottom = false;
    for (const m of cell.memberships) {
      if (m.localRow % 3 === 0) top = true;
      if (m.localRow % 3 === 2) bottom = true;
      if (m.localCol % 3 === 0) left = true;
      if (m.localCol % 3 === 2) right = true;
    }
    return { top, left, right, bottom };
  })
);

// Mark every cell that shares a unit with any occurrence of the highlighted
// number — those cells can't legally take that number there (either
// already filled, or empty but blocked), so they're grayed on the grid.
// Triggered by selecting a cell that already holds a value.
const illegalCells = computed(() => {
  const set = new Set();
  const val = props.highlightNumber;
  if (!val) return set;
  const peers = props.layout.peers;
  for (let i = 0; i < props.board.length; i++) {
    if (props.board[i] !== val) continue;
    for (const p of peers[i]) set.add(p);
  }
  return set;
});

function cellClasses(i) {
  const val = props.board[i];
  const border = borderInfo.value[i];
  return {
    fixed: props.fixed[i],
    "has-value": val !== 0,
    selected: i === props.selected,
    "same-value":
      val !== 0 &&
      props.highlightNumber !== 0 &&
      val === props.highlightNumber &&
      i !== props.selected,
    illegal: illegalCells.value.has(i),
    conflict: props.conflicts.has(i),
    // A placed digit that doesn't match the puzzle's actual solution. Guarded
    // by solution[i]!==0 so this never fires mid-creation, before a real
    // solution exists (custom puzzles start with an all-zero solution).
    wrong:
      val !== 0 &&
      !props.fixed[i] &&
      props.solution[i] !== 0 &&
      val !== props.solution[i],
    "border-top": border.top,
    "border-left": border.left,
    "border-right": border.right,
    "border-bottom": border.bottom,
  };
}
</script>

<template>
  <div class="grid-scroll">
    <div
      class="grid"
      :style="gridStyle"
      role="grid"
      aria-label="ตารางซูโดกุ"
    >
      <template v-for="cell in gridCells" :key="cell.key">
        <button
          v-if="cell.index !== -1"
          class="cell"
          :class="cellClasses(cell.index)"
          type="button"
          @click="emit('select', cell.index)"
        >
          <span v-if="board[cell.index] !== 0" class="value">{{ board[cell.index] }}</span>
          <div v-else class="notes">
            <span
              v-for="n in 9"
              :key="n"
              class="note"
              :class="{ on: notes[cell.index].has(n) }"
              >{{ notes[cell.index].has(n) ? n : "" }}</span
            >
          </div>
        </button>
        <div v-else class="cell blank" aria-hidden="true"></div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.grid-scroll {
  width: 100%;
  display: flex;
  justify-content: center;
  overflow: auto;
}

.grid {
  --cols: 9;
  --rows: 9;
  width: min(460px, 100%);
  height: auto;
  aspect-ratio: var(--cols) / var(--rows);
  max-height: 66dvh;
  display: grid;
  grid-template-columns: repeat(var(--cols), 1fr);
  grid-template-rows: repeat(var(--rows), 1fr);
  border-radius: 10px;
}

.cell {
  background: var(--void);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  position: relative;
  font-family: "Inter", sans-serif;
  min-width: 0;
  min-height: 0;
  /* Establishes a query container sized to this cell's own rendered box,
     so digit/note size below can scale off the ACTUAL cell size — correct
     whether the cell is small because of many columns, many rows, or both. */
  container-type: inline-size;
}

.cell.blank {
  background: transparent;
  border-color: transparent;
  pointer-events: none;
}

.cell.border-top {
  border-top: 2.5px solid var(--line-strong);
}
.cell.border-left {
  border-left: 2.5px solid var(--line-strong);
}
.cell.border-right {
  border-right: 2.5px solid var(--line-strong);
}
.cell.border-bottom {
  border-bottom: 2.5px solid var(--line-strong);
}

/* Any cell that already has a number is always gray — it can never accept
   new input anyway, filled or clue alike. */
.cell.has-value {
  background: var(--paper);
}

/* Empty cells where the selected number can't legally go — same gray as
   filled cells, so the whole "unavailable" zone reads consistently. */
.cell.illegal {
  background: var(--paper);
}

.cell.illegal .value {
  color: var(--text);
}

.cell.selected {
  background: rgba(63, 99, 201, 0.3);
  outline: 2px solid var(--accent-text);
  outline-offset: -2px;
  z-index: 2;
}

.cell.selected .value {
  color: var(--text);
}

/* Cells matching the selected value get a solid blue chip, not just tinted
   text, so they're unmistakable at a glance. */
.cell.same-value {
  background: var(--accent);
}

.cell.same-value .value {
  color: var(--on-accent);
}

.cell.conflict .value {
  color: var(--clay);
}

.cell.conflict {
  background: var(--clay-soft);
}

/* A placed digit that doesn't match the actual solution — flagged red even
   if it doesn't (yet) break any row/column/box rule. */
.cell.wrong .value {
  color: var(--clay);
}

.value {
  /* Sized off the cell's own box (container query units), not the
     viewport — correct whether the cell is small from many columns, many
     rows, or both, unlike a vw-based size which only sees the viewport. */
  font-size: clamp(7px, 66cqw, 26px);
  font-weight: 700;
  color: var(--accent-text);
  font-variant-numeric: tabular-nums;
}

.cell.fixed .value {
  color: var(--text);
  font-weight: 800;
}

/* Higher-specificity overrides so a fixed clue still shows conflict/match
   coloring instead of silently falling back to the plain fixed-clue color. */
.cell.fixed.conflict .value {
  color: var(--clay);
}

.cell.fixed.same-value .value {
  color: var(--on-accent);
}

.notes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  width: 100%;
  height: 100%;
}

.note {
  display: flex;
  align-items: center;
  justify-content: center;
  /* Same container as .value (the cell) — each note sits in a 3x3
     sub-grid, so ~28% of the cell's width is as big as one digit can go
     without the 9 of them crowding into each other. */
  font-size: clamp(5px, 28cqw, 13px);
  font-weight: 700;
  color: var(--text);
  line-height: 1;
}
</style>
