<script setup>
import { computed, ref } from "vue";
import { useGame } from "./composables/useGame.js";
import { LINK_MODES } from "./utils/layouts.js";
import TopBar from "./components/TopBar.vue";
import SudokuGrid from "./components/SudokuGrid.vue";
import NumberPad from "./components/NumberPad.vue";
import CreatePad from "./components/CreatePad.vue";
import WinModal from "./components/WinModal.vue";

const {
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
  canUndo,
  canRedo,
} = useGame();

const showPicker = ref(false);
const pickedLinkMode = ref(state.linkMode);

// Tiny geometry-accurate preview for each mode card: drawn at BLOCK
// resolution (one square per 3x3 box) straight from that mode's board
// origins, so it can never drift out of sync with the real layout.
function blockPreview(mode) {
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  for (const b of mode.boards) {
    minR = Math.min(minR, b.blockRow);
    maxR = Math.max(maxR, b.blockRow + 2);
    minC = Math.min(minC, b.blockCol);
    maxC = Math.max(maxC, b.blockCol + 2);
  }
  const width = maxC - minC + 1;
  const height = maxR - minR + 1;
  const hits = Array.from({ length: height }, () => new Array(width).fill(0));
  for (const b of mode.boards) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        hits[b.blockRow + r - minR][b.blockCol + c - minC]++;
      }
    }
  }
  const blocks = [];
  for (let r = 0; r < height; r++)
    for (let c = 0; c < width; c++)
      if (hits[r][c] > 0) blocks.push({ r, c, shared: hits[r][c] > 1 });
  return { width, height, blocks };
}

const modeCards = LINK_MODES.map((m) => ({ ...m, preview: blockPreview(m) }));
const straightModeCards = modeCards.filter((m) => !m.id.startsWith("vz-") && !m.id.startsWith("hz-"));
const zigzagModeCards = modeCards.filter((m) => m.id.startsWith("vz-") || m.id.startsWith("hz-"));

const counts = computed(() => {
  const L = layout.value;
  let boardIdxs = [0];
  if (state.selected !== null && state.selected !== undefined) {
    const cell = L.cells[state.selected];
    if (cell) boardIdxs = cell.memberships.map((m) => m.board);
  }
  const perBoard = boardIdxs.map((bi) => {
    const c = new Array(9).fill(9);
    for (const gi of L.boards[bi].cellIndices) {
      const v = state.board[gi];
      if (v !== 0) c[v - 1]--;
    }
    return c;
  });
  return Array.from({ length: 9 }, (_, n) => Math.min(...perBoard.map((c) => c[n])));
});

// The value currently sitting in the selected cell (0 if empty/none selected).
// Lets the number pad allow tapping that same digit again to erase it, even
// when that digit's count elsewhere is already maxed at 9.
const selectedValue = computed(() => {
  if (state.selected === null || state.selected === undefined) return 0;
  return state.board[state.selected];
});

function openPicker() {
  pickedLinkMode.value = state.linkMode;
  showPicker.value = true;
}

function pickDifficulty(diff) {
  newGame(pickedLinkMode.value, diff);
  showPicker.value = false;
}

function pickCreate() {
  startCreate();
  showPicker.value = false;
}

function pickRestart() {
  restartPuzzle();
  showPicker.value = false;
}
</script>

<template>
  <TopBar
    :time="formattedTime"
    :difficulty="state.difficulty"
    :mode="state.mode"
    :can-undo="canUndo"
    :can-redo="canRedo"
    @undo="undo"
    @redo="redo"
    @new-game="openPicker"
  />

  <SudokuGrid
    :board="state.board"
    :fixed="state.fixed"
    :notes="state.notes"
    :solution="state.solution"
    :selected="state.selected"
    :highlight-number="state.highlightNumber"
    :conflicts="conflicts"
    :layout="layout"
    @select="select"
  />

  <NumberPad
    v-if="state.mode === 'play'"
    :note-mode="state.noteMode"
    :counts="counts"
    :selected-value="selectedValue"
    @number="inputNumber"
    @erase="eraseSelected"
    @toggle-notes="toggleNoteMode"
    @auto-note="autoNoteAll"
    @clear-notes="clearAllNotes"
  />

  <CreatePad
    v-else
    :counts="counts"
    :selected-value="selectedValue"
    :message="state.createMessage"
    @number="inputNumber"
    @erase="eraseSelected"
    @clear="clearCreateBoard"
    @cancel="cancelCreate"
    @confirm="confirmCustomPuzzle"
  />

  <WinModal v-if="won" :time="formattedTime" @new-game="openPicker" />

  <div v-if="showPicker" class="picker-overlay">
    <div class="picker-card">
      <h2>เริ่มเกมใหม่</h2>

      <button
        v-if="state.mode === 'play'"
        class="diff-btn restart-btn"
        @click="pickRestart"
      >
        ↺ เริ่มเกมนี้ใหม่ <span>ล้างเลขที่กรอกไว้ แต่โจทย์เดิม</span>
      </button>
      <button class="diff-btn create-btn" @click="pickCreate">
        ✎ สร้างโจทย์เอง <span>กรอกเลขตั้งต้นเองทั้งหมด</span>
      </button>

      <div class="divider"><span>หรือให้สุ่มโจทย์</span></div>

      <p class="section-label">รูปแบบกระดาน</p>
      <div class="mode-grid">
        <button
          v-for="m in straightModeCards"
          :key="m.id"
          class="mode-card"
          :class="{ picked: pickedLinkMode === m.id }"
          type="button"
          @click="pickedLinkMode = m.id"
        >
          <span
            class="mode-preview"
            :style="{ '--pw': m.preview.width, '--ph': m.preview.height }"
          >
            <span
              v-for="(b, bi) in m.preview.blocks"
              :key="bi"
              class="mode-block"
              :class="{ shared: b.shared }"
              :style="{ gridRow: b.r + 1, gridColumn: b.c + 1 }"
            ></span>
          </span>
          <span class="mode-label">{{ m.label }}</span>
        </button>
      </div>

      <p class="section-label">ซิกแซกหลายกระดาน</p>
      <div class="mode-grid">
        <button
          v-for="m in zigzagModeCards"
          :key="m.id"
          class="mode-card"
          :class="{ picked: pickedLinkMode === m.id }"
          type="button"
          @click="pickedLinkMode = m.id"
        >
          <span
            class="mode-preview"
            :style="{ '--pw': m.preview.width, '--ph': m.preview.height }"
          >
            <span
              v-for="(b, bi) in m.preview.blocks"
              :key="bi"
              class="mode-block"
              :class="{ shared: b.shared }"
              :style="{ gridRow: b.r + 1, gridColumn: b.c + 1 }"
            ></span>
          </span>
          <span class="mode-label">{{ m.label }}</span>
        </button>
      </div>

      <p class="section-label">ความยาก</p>
      <button class="diff-btn" @click="pickDifficulty('easy')">
        ง่าย <span>เหมาะสำหรับเล่นสบายๆ</span>
      </button>
      <button class="diff-btn" @click="pickDifficulty('medium')">
        ปานกลาง <span>ท้าทายพอดี</span>
      </button>
      <button class="diff-btn" @click="pickDifficulty('hard')">
        ยาก <span>ต้องคิดเยอะหน่อย</span>
      </button>
      <button class="diff-btn" @click="pickDifficulty('expert')">
        โหด <span>สำหรับมือโปร</span>
      </button>

      <button
        v-if="state.hasSave || canUndo"
        class="cancel-btn"
        @click="showPicker = false"
      >
        กลับไปเล่นเกมเดิม
      </button>
    </div>
  </div>
</template>

<style scoped>
.picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  padding: 20px;
}

.picker-card {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 24px;
  width: 100%;
  max-width: 340px;
  max-height: 88dvh;
  overflow-y: auto;
  box-shadow: var(--shadow);
}

.picker-card h2 {
  color: var(--accent-text);
  font-size: 22px;
  margin-bottom: 16px;
  text-align: center;
}

.diff-btn {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--accent);
  color: var(--on-accent);
  border-radius: 12px;
  padding: 14px;
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 10px;
}

.create-btn {
  background: var(--gold);
  color: var(--on-gold);
}

.restart-btn {
  background: var(--paper-shade);
  color: var(--accent-text);
  border: 1px solid var(--line);
}

.divider {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--ink-soft);
  font-size: 12px;
  margin: 4px 0 10px;
}

.divider::before,
.divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--line);
}

.section-label {
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 700;
  margin: 2px 0 8px;
}

.mode-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.mode-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: var(--paper-shade);
  border: 1.5px solid var(--line);
  border-radius: 10px;
  padding: 8px 4px;
}

.mode-card.picked {
  border-color: var(--accent-text);
  background: var(--gold-soft);
}

.mode-preview {
  display: grid;
  grid-template-rows: repeat(var(--ph), 6px);
  grid-template-columns: repeat(var(--pw), 6px);
  gap: 1px;
}

.mode-block {
  background: var(--accent-text);
  border-radius: 1px;
}

.mode-block.shared {
  background: var(--gold);
}

.mode-label {
  font-size: 10.5px;
  color: var(--text);
  text-align: center;
  line-height: 1.25;
}

.diff-btn span {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.8;
  margin-top: 2px;
}

.diff-btn:active {
  transform: scale(0.97);
}

.cancel-btn {
  width: 100%;
  background: transparent;
  color: var(--ink-soft);
  text-align: center;
  padding: 10px;
  font-size: 14px;
  text-decoration: underline;
}
</style>
