<template>
  <div class="login-wrapper">
    <div class="card login-card">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 16px; background: #eef2ff; margin-bottom: 12px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#4f46e5" stroke-width="2.5" />
            <circle cx="12" cy="12" r="4" fill="#4f46e5" />
          </svg>
        </div>
        <h2 style="font-size: 22px; font-weight: 700; color: var(--text-main);">{{ t('login.title') }}</h2>
        <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">{{ t('login.subtitle') }}</p>
      </div>

      <!-- Language selector -->
      <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 20px;">
        <button
          type="button"
          :class="['btn btn-sm', currentLang === 'zh-CN' ? 'btn-primary' : 'btn-secondary']"
          @click="setLanguage('zh-CN')"
        >
          🇨🇳 简体中文
        </button>
        <button
          type="button"
          :class="['btn btn-sm', currentLang === 'en-US' ? 'btn-primary' : 'btn-secondary']"
          @click="setLanguage('en-US')"
        >
          🇺🇸 English
        </button>
      </div>

      <!-- Alert / Error message -->
      <div v-if="error" class="badge-danger" style="padding: 10px 14px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; line-height: 1.4;">
        ⚠️ {{ error }}
      </div>

      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label class="form-label">{{ t('login.username') }}</label>
          <input
            v-model="username"
            type="text"
            class="form-control"
            :placeholder="t('login.username_placeholder')"
            autocomplete="username"
            required
            :disabled="loading"
          />
        </div>

        <div class="form-group" style="margin-bottom: 24px;">
          <label class="form-label">{{ t('login.password') }}</label>
          <input
            v-model="password"
            type="password"
            class="form-control"
            :placeholder="t('login.password_placeholder')"
            autocomplete="current-password"
            required
            :disabled="loading"
          />
        </div>

        <button
          type="submit"
          class="btn btn-primary"
          style="width: 100%; padding: 10px; font-size: 15px;"
          :disabled="loading"
        >
          <span v-if="loading">⏳ {{ t('login.submitting') }}</span>
          <span v-else>🔐 {{ t('login.submit') }}</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { t, currentLang, setLanguage } from '../i18n';
import { api } from '../api';
import { showToast } from '../toast';

const emit = defineEmits(['login-success']);
const router = useRouter();

const username = ref('admin');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleSubmit() {
  error.value = '';
  loading.value = true;
  try {
    const res = await api.login(username.value, password.value);
    if (res.success && res.user) {
      showToast('登录成功！');
      emit('login-success', res.user);
      router.push('/controller');
    }
  } catch (err) {
    error.value = err.message || t('login.failed');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-wrapper {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: radial-gradient(circle at top, #eef2ff, #f8fafc);
}

.login-card {
  max-width: 420px;
  width: 100%;
  padding: 36px 32px;
  box-shadow: var(--shadow-lg);
  border-radius: 20px;
}
</style>
