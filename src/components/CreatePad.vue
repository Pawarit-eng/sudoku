<script setup>
const props = defineProps({
  counts: { type: Array, required: true },
  selectedValue: { type: Number, default: 0 },
  message: { type: String, default: "" },
});
defineEmits(["number", "erase", "clear", "cancel", "confirm"]);
</script>

<template>
  <div class="pad-wrap">
    <p class="hint">แตะช่องว่างในตาราง แล้วกดเลขเพื่อวางโจทย์ตั้งต้น</p>

    <p v-if="props.message" class="message">{{ props.message }}</p>

    <div class="numbers">
      <button
        v-for="n in 9"
        :key="n"
        class="num-btn"
        :disabled="props.counts[n - 1] <= 0 && props.selectedValue !== n"
        @click="$emit('number', n)"
      >
        <span class="num">{{ n }}</span>
        <span class="remaining">{{
          props.counts[n - 1] > 0 ? props.counts[n - 1] : ""
        }}</span>
      </button>
    </div>

    <div class="row secondary">
      <button class="pill" @click="$emit('erase')">
        <span class="pill-icon">⌫</span>
        <span class="pill-label">ลบช่อง</span>
      </button>
      <button class="pill" @click="$emit('clear')">
        <span class="pill-icon">↺</span>
        <span class="pill-label">ล้างทั้งหมด</span>
      </button>
      <button class="pill" @click="$emit('cancel')">
        <span class="pill-icon">✕</span>
        <span class="pill-label">ยกเลิก</span>
      </button>
    </div>

    <button class="confirm-btn" @click="$emit('confirm')">
      ✓ ยืนยันโจทย์ เริ่มเล่นเลย
    </button>
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

.hint {
  text-align: center;
  color: var(--ink-soft);
  font-size: 14px;
  margin: 0;
}

.message {
  text-align: center;
  color: var(--clay);
  background: var(--clay-soft);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 600;
  margin: 0;
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

.row.secondary {
  display: flex;
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
}

.pill:active {
  transform: scale(0.96);
}

.confirm-btn {
  width: 100%;
  padding: 15px;
  background: var(--gold);
  color: var(--on-gold);
  border-radius: 12px;
  font-weight: 800;
  font-size: 16px;
}

.confirm-btn:active {
  transform: scale(0.98);
}
</style>
