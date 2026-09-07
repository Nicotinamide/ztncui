<template>
  <div class="toast-container">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :class="['toast', toast.type === 'error' ? 'toast-error' : 'toast-success']"
    >
      <span>{{ toast.type === 'error' ? '❌' : '✅' }}</span>
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>

<script setup>
import { toasts } from '../toast';
</script>
