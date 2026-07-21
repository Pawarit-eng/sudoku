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
});
const emit = defineEmits(["select"]);

const selRow = computed(() =>
  props.selected === null ? null : Math.floor(props.selected / 9)
);
const selCol = computed(() =>
  props.selected === null ? null : props.selected % 9
);

function isPeer(i) {
  if (props.selected === null) return false;
  const row = Math.floor(i / 9);
  const col = i % 9;
  const sameRow = row === selRow.value;
  const sameCol = col === selCol.value;
  const sameBox =
    Math.floor(row / 3) === Math.floor(selRow.value / 3) &&
    Math.floor(col / 3) === Math.floor(selCol.value / 3);
  return sameRow || sameCol || sameBox;
}

function peersOf(i) {
  const row = Math.floor(i / 9);
  const col = i % 9;
  const out = new Set();
  for (let c = 0; c < 9; c++) out.add(row * 9 + c);
  for (let r = 0; r < 9; r++) out.add(r * 9 + col);
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++)
    for (let c = bc; c < bc + 3; c++) out.add(r * 9 + c);
  out.delete(i);
  return out;
}

// Mark every empty cell that shares a row/column/box with any occurrence of
// the highlighted number — those cells can't legally take that number, so
// they're dimmed/hazy on the grid. Triggered either by selecting a cell that
// already holds a value, or by tapping that number on the number pad.
const illegalCells = computed(() => {
  const set = new Set();
  const val = props.highlightNumber;
  if (!val) return set;
  for (let i = 0; i < 81; i++) {
    if (props.board[i] !== val) continue;
    for (const p of peersOf(i)) {
      set.add(p);
    }
  }
  return set;
});

function cellClasses(i) {
  const row = Math.floor(i / 9);
  const col = i % 9;
  const val = props.board[i];
  const boxRow = Math.floor(row / 3);
  const boxCol = Math.floor(col / 3);
  return {
    fixed: props.fixed[i],
    alt: (boxRow + boxCol) % 2 === 1,
    selected: i === props.selected,
    peer: isPeer(i) && i !== props.selected && props.highlightNumber !== 0,
    "same-value":
      val !== 0 &&
      props.highlightNumber !== 0 &&
      val === props.highlightNumber &&
      i !== props.selected,
    illegal: illegalCells.value.has(i),
    conflict: props.conflicts.has(`${row}-${col}`),
    "border-right": col === 2 || col === 5,
    "border-bottom": row === 2 || row === 5,
  };
}
</script>

<template>
  <div class="grid" role="grid" aria-label="ตารางซูโดกุ 9 คูณ 9">
    <button
      v-for="(val, i) in board"
      :key="i"
      class="cell"
      :class="cellClasses(i)"
      type="button"
      @click="emit('select', i)"
    >
      <span v-if="val !== 0" class="value">{{ val }}</span>
      <div v-else class="notes">
        <span
          v-for="n in 9"
          :key="n"
          class="note"
          :class="{ on: notes[i].has(n) }"
          >{{ notes[i].has(n) ? n : "" }}</span
        >
      </div>
    </button>
  </div>
</template>

<style scoped>
.grid {
  width: 100%;
  max-width: 460px;
  aspect-ratio: 1 / 1;
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  grid-template-rows: repeat(9, 1fr);
  background: var(--void);
  border: 3px solid var(--line-strong);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: var(--shadow);
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
}

.cell.border-right {
  border-right: 2.5px solid var(--line-strong);
}
.cell.border-bottom {
  border-bottom: 2.5px solid var(--line-strong);
}

.cell.peer {
  background: var(--paper);
}

.cell.peer .value {
  color: var(--text);
}

/* Cells where the selected number can't legally go — same gray as the rest
   of the highlighted row/column/box. */
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

.value {
  font-size: clamp(16px, 4.6vw, 24px);
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
  font-size: clamp(8px, 2.1vw, 11px);
  font-weight: 700;
  color: var(--text);
  line-height: 1;
}
</style>
