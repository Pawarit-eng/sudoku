<script setup>
const props = defineProps({
  time: { type: String, required: true },
  difficulty: { type: String, required: true },
  mode: { type: String, default: "play" },
  canUndo: { type: Boolean, default: false },
  canRedo: { type: Boolean, default: false },
});
defineEmits(["undo", "redo", "new-game"]);

const difficultyLabel = {
  easy: "ง่าย",
  medium: "ปานกลาง",
  hard: "ยาก",
  expert: "โหด",
  custom: "กำหนดเอง",
};
</script>

<template>
  <header class="topbar">
    <div class="title-block">
      <h1>ซูโดกุ</h1>
      <span class="tag">{{ difficultyLabel[difficulty] }}</span>
    </div>

    <div class="mid">
      <span v-if="mode === 'create'" class="timer creating"
        >กำลังสร้างโจทย์</span
      >
      <span v-else class="timer" aria-label="เวลาเล่น">{{ time }}</span>
    </div>

    <div class="actions">
      <button
        class="icon-btn"
        :disabled="!canUndo"
        @click="$emit('undo')"
        aria-label="ย้อนกลับ"
      >
        ↶
      </button>
      <button
        class="icon-btn"
        :disabled="!canRedo"
        @click="$emit('redo')"
        aria-label="ทำซ้ำ"
      >
        ↷
      </button>
      <button class="icon-btn" @click="$emit('new-game')" aria-label="เกมใหม่">
        ⟲
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  width: 100%;
  max-width: 460px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 2px 14px;
}

.title-block {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.title-block h1 {
  font-size: 28px;
  color: var(--accent-text);
  font-weight: 700;
}

.tag {
  font-size: 13px;
  color: var(--ink-soft);
  background: var(--paper-shade);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 3px 10px;
}

.timer {
  font-variant-numeric: tabular-nums;
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  background: var(--paper-shade);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 6px 14px;
}

.timer.creating {
  font-size: 14px;
  color: var(--gold);
  background: var(--gold-soft);
  border-color: var(--gold);
}

.actions {
  display: flex;
  gap: 8px;
}

.icon-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--paper-shade);
  border: 1px solid var(--line);
  color: var(--accent-text);
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s ease, background 0.15s ease;
}

.icon-btn:active:not(:disabled) {
  transform: scale(0.92);
  background: var(--gold-soft);
}

.icon-btn:disabled {
  opacity: 0.35;
}
</style>
