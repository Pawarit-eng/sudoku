<script setup>
defineProps({
  time: { type: String, required: true },
});
defineEmits(["new-game"]);
</script>

<template>
  <div class="overlay">
    <div class="card">
      <h2>เก่งมาก! 🎉</h2>
      <p>ไขซูโดกุสำเร็จแล้ว ใช้เวลา</p>
      <p class="time">{{ time }}</p>
      <button class="cta" @click="$emit('new-game')">เล่นตาใหม่</button>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  padding: 20px;
}

.card {
  background: var(--paper);
  border-radius: var(--radius);
  border: 1px solid var(--line);
  padding: 28px 26px;
  text-align: center;
  max-width: 320px;
  width: 100%;
  box-shadow: var(--shadow);
}

.card h2 {
  font-size: 26px;
  color: var(--accent-text);
  margin-bottom: 10px;
}

.card p {
  margin: 4px 0;
  color: var(--ink-soft);
}

.time {
  font-size: 30px;
  font-weight: 800;
  color: var(--gold);
  font-variant-numeric: tabular-nums;
  margin: 8px 0 20px;
}

.cta {
  width: 100%;
  padding: 14px;
  background: var(--accent);
  color: var(--on-accent);
  border-radius: 12px;
  font-weight: 700;
  font-size: 17px;
}

.cta:active {
  transform: scale(0.97);
}
</style>
