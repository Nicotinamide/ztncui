<template>
  <nav class="navbar">
    <div style="display: flex; align-items: center; gap: 24px;">
      <router-link to="/controller" class="navbar-brand">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="#ffb400" stroke-width="2.5" />
          <circle cx="12" cy="12" r="4" fill="#ffb400" />
        </svg>
        <span>{{ t('brand') }}</span>
      </router-link>

      <ul class="navbar-nav">
        <li>
          <router-link to="/controller" class="nav-link" active-class="active">
            <span>📊</span>
            <span>{{ t('nav.dashboard') }}</span>
          </router-link>
        </li>
        <li>
          <router-link to="/networks" class="nav-link" active-class="active">
            <span>🌐</span>
            <span>{{ t('nav.networks') }}</span>
          </router-link>
        </li>
        <li>
          <router-link to="/users" class="nav-link" active-class="active">
            <span>👥</span>
            <span>{{ t('nav.users') }}</span>
          </router-link>
        </li>
      </ul>
    </div>

    <div style="display: flex; align-items: center; gap: 16px;">
      <!-- Language Switcher -->
      <div style="display: flex; align-items: center; gap: 6px; font-size: 13px;">
        <button
          :class="['btn btn-sm', currentLang === 'zh-CN' ? 'btn-primary' : 'btn-secondary']"
          @click="setLanguage('zh-CN')"
          style="padding: 3px 8px;"
        >
          🇨🇳 中文
        </button>
        <button
          :class="['btn btn-sm', currentLang === 'en-US' ? 'btn-primary' : 'btn-secondary']"
          @click="setLanguage('en-US')"
          style="padding: 3px 8px;"
        >
          🇺🇸 EN
        </button>
      </div>

      <!-- Current User & Logout -->
      <div v-if="currentUser" style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 13px; color: #cbd5e1; display: flex; align-items: center; gap: 4px;">
          <span>👤</span>
          <strong>{{ currentUser.name }}</strong>
        </span>
        <button class="btn btn-sm btn-secondary" @click="handleLogout" :title="t('nav.logout')" style="background: rgba(255,255,255,0.1); color: #fff; border-color: rgba(255,255,255,0.2);">
          <span>🚪</span>
          <span>{{ t('nav.logout') }}</span>
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { t, currentLang, setLanguage } from '../i18n';
import { api } from '../api';
import { useRouter } from 'vue-router';

const props = defineProps({
  currentUser: Object
});

const emit = defineEmits(['logout']);
const router = useRouter();

async function handleLogout() {
  try {
    await api.logout();
  } catch {}
  emit('logout');
  router.push('/login');
}
</script>
