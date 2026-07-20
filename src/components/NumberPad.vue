<script setup>
defineProps({
  noteMode: { type: Boolean, default: false },
  counts: { type: Array, required: true }, // remaining count per digit 1-9
  selectedValue: { type: Number, default: 0 },
});
const emit = defineEmits([
  "number",
  "erase",
  "toggle-notes",
  "auto-note",
  "clear-notes",
]);
</script>

<template>
  <div class="pad-wrap">
    <div class="row secondary">
      <button class="pill" @click="emit('erase')">
        <span class="pill-icon">⌫</span>
        <span class="pill-label">ลบ</span>
      </button>
      <button
        class="pill"
        :class="{ active: noteMode }"
        @click="emit('toggle-notes')"
      >
        <span class="pill-icon">✎</span>
        <span class="pill-label">จดโน้ต</span>
      </button>
      <button class="pill" @click="emit('auto-note')">
        <span class="pill-icon">✦</span>
        <span class="pill-label">โน้ตทั้งกระดาน</span>
      </button>
      <button class="pill" @click="emit('clear-notes')">
        <span class="pill-icon">🗑</span>
        <span class="pill-label">ลบโน้ตทั้งหมด</span>
      </button>
    </div>

    <div class="numbers">
      <button
        v-for="n in 9"
        :key="n"
        class="num-btn"
        :disabled="counts[n - 1] <= 0 && selectedValue !== n"
        @click="emit('number', n)"
      >
        <span class="num">{{ n }}</span>
        <span class="remaining">{{ counts[n - 1] > 0 ? counts[n - 1] : "" }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.pad-wrap {
  width: 100%;
  max-width: 460px;
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.row.secondary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.pill {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--paper-shade);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px 6px;
  color: var(--accent-text);
  font-weight: 700;
  font-size: 14px;
  transition: background 0.15s ease, transform 0.1s ease;
}

.pill:active {
  transform: scale(0.96);
}

.pill.active {
  background: var(--accent);
  color: var(--on-accent);
  border-color: var(--accent);
}

.pill-icon {
  font-size: 17px;
}

.numbers {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 6px;
}

.num-btn {
  aspect-ratio: 1 / 1;
  background: var(--accent);
  color: var(--on-accent);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  transition: transform 0.08s ease, background 0.15s ease;
}

.num-btn:active:not(:disabled) {
  transform: scale(0.92);
  background: var(--accent-press);
}

.num-btn:disabled {
  background: var(--paper-shade);
  color: var(--line-strong);
}

.num {
  font-size: clamp(20px, 5.5vw, 26px);
  font-weight: 800;
  line-height: 1;
}

.remaining {
  font-size: 10px;
  opacity: 0.7;
  line-height: 1;
  min-height: 12px;
}
</style>
