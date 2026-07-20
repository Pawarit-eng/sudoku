<script setup>
import { computed, ref } from "vue";
import { useGame } from "./composables/useGame.js";
import TopBar from "./components/TopBar.vue";
import SudokuGrid from "./components/SudokuGrid.vue";
import NumberPad from "./components/NumberPad.vue";
import CreatePad from "./components/CreatePad.vue";
import WinModal from "./components/WinModal.vue";

const {
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
  canUndo,
  canRedo,
} = useGame();

const showPicker = ref(false);

const counts = computed(() => {
  const c = new Array(9).fill(9);
  for (const v of state.board) if (v !== 0) c[v - 1]--;
  return c;
});

// The value currently sitting in the selected cell (0 if empty/none selected).
// Lets the number pad allow tapping that same digit again to erase it, even
// when that digit's count elsewhere is already maxed at 9.
const selectedValue = computed(() => {
  if (state.selected === null || state.selected === undefined) return 0;
  return state.board[state.selected];
});

function pickDifficulty(diff) {
  newGame(diff);
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
    @new-game="showPicker = true"
  />

  <SudokuGrid
    :board="state.board"
    :fixed="state.fixed"
    :notes="state.notes"
    :solution="state.solution"
    :selected="state.selected"
    :highlight-number="state.highlightNumber"
    :conflicts="conflicts"
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

  <WinModal v-if="won" :time="formattedTime" @new-game="showPicker = true" />

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
