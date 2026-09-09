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
      <!-- API Token Button -->
      <button
        class="btn btn-sm"
        @click="openTokenModal"
        :title="t('api_token.modal_title')"
        style="background: rgba(255,180,0,0.15); color: #ffb400; border: 1px solid rgba(255,180,0,0.35); font-weight: 600; display: flex; align-items: center; gap: 6px; padding: 4px 10px;"
      >
        <span>🔑</span>
        <span>{{ t('api_token.nav_btn') }}</span>
      </button>

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

    <!-- API Token Modal -->
    <Teleport to="body">
      <div v-if="showTokenModal" class="modal-overlay" @click.self="showTokenModal = false">
        <div class="modal-content" style="max-width: 500px;">
          <div class="modal-header">
            <h3 style="margin: 0; font-size: 16px; display: flex; align-items: center; gap: 8px;">
              <span>🔑</span>
              <span>{{ t('api_token.modal_title') }}</span>
            </h3>
            <button @click="showTokenModal = false" style="background: transparent; border: none; font-size: 18px; color: var(--text-muted); cursor: pointer;">✕</button>
          </div>

          <div class="modal-body">
            <!-- Master Switch Box -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
                <div>
                  <div style="font-size: 13.5px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 8px;">
                    <span>{{ t('api_token.switch_title') }}</span>
                    <span
                      :style="{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontWeight: '600',
                        background: apiEnabled ? '#dcfce7' : '#f1f5f9',
                        color: apiEnabled ? '#15803d' : '#64748b'
                      }"
                    >
                      {{ apiEnabled ? t('api_token.status_enabled') : t('api_token.status_disabled') }}
                    </span>
                  </div>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px;">
                    {{ apiEnabled ? t('api_token.hint_enabled') : t('api_token.hint_disabled') }}
                  </div>
                </div>

                <button
                  @click="handleToggleAccess"
                  :disabled="isToggling"
                  :class="['btn btn-sm', apiEnabled ? 'btn-danger' : 'btn-success']"
                  style="white-space: nowrap; min-width: 72px; padding: 5px 12px; font-weight: 600;"
                >
                  {{ isToggling ? t('common.loading') : (apiEnabled ? t('api_token.btn_disable') : t('api_token.btn_enable')) }}
                </button>
              </div>
            </div>

            <!-- Token Row -->
            <div style="margin-bottom: 16px;" :style="{ opacity: apiEnabled ? 1 : 0.6 }">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label style="font-size: 12px; font-weight: 600; color: var(--text);">
                  {{ t('api_token.token_label') }}
                </label>
                <span v-if="!apiEnabled" style="font-size: 11px; color: #b45309; font-weight: 500;">
                  ({{ t('api_token.token_disabled_tag') }})
                </span>
              </div>
              <div style="display: flex; gap: 8px;">
                <div style="flex: 1; background: #0f172a; border: 1px solid #334155; border-radius: var(--radius-sm); padding: 8px 12px; font-family: monospace; font-size: 13px; color: #38bdf8; word-break: break-all; display: flex; align-items: center; justify-content: space-between;">
                  <span>{{ isTokenVisible ? apiToken : maskedToken }}</span>
                  <button
                    @click="isTokenVisible = !isTokenVisible"
                    style="background: transparent; border: none; cursor: pointer; color: #94a3b8; font-size: 14px; padding: 2px;"
                    :title="isTokenVisible ? '🙈' : '👁'"
                  >
                    {{ isTokenVisible ? '🙈' : '👁' }}
                  </button>
                </div>
                <button
                  class="btn btn-primary"
                  @click="copyToken"
                  :disabled="!apiEnabled"
                  style="white-space: nowrap;"
                >
                  <span>📋</span>
                  <span>{{ copyBtnText }}</span>
                </button>
              </div>
            </div>

            <!-- Regenerate Box -->
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius-sm); padding: 12px 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                <div>
                  <div style="font-size: 13px; font-weight: 600; color: #dc2626;">{{ t('api_token.regenerate_title') }}</div>
                  <div style="font-size: 11.5px; color: #7f1d1d; margin-top: 2px;">{{ t('api_token.regenerate_hint') }}</div>
                </div>
                <button class="btn btn-sm btn-danger" @click="handleRegenerate" :disabled="isRegenerating" style="white-space: nowrap;">
                  {{ isRegenerating ? t('common.loading') : t('api_token.regenerate_btn') }}
                </button>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showTokenModal = false">{{ t('common.close') }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </nav>
</template>

<script setup>
import { ref, computed } from 'vue';
import { t, currentLang, setLanguage } from '../i18n';
import { api } from '../api';
import { useRouter } from 'vue-router';
import { showToast } from '../toast';

const props = defineProps({
  currentUser: Object
});

const emit = defineEmits(['logout']);
const router = useRouter();

// API Token Modal State
const showTokenModal = ref(false);
const apiToken = ref('');
const apiEnabled = ref(false);
const isTokenVisible = ref(false);
const isRegenerating = ref(false);
const isToggling = ref(false);
const copyBtnText = computed(() => isCopied.value ? t('api_token.copied') : t('api_token.copy_btn'));
const isCopied = ref(false);

const maskedToken = computed(() => {
  if (!apiToken.value) return t('common.loading');
  if (apiToken.value.length <= 8) return '••••••••••••••••';
  return apiToken.value.substring(0, 5) + '••••••••••••••••' + apiToken.value.substring(apiToken.value.length - 4);
});

async function openTokenModal() {
  showTokenModal.value = true;
  isCopied.value = false;
  isTokenVisible.value = false;
  try {
    const res = await api.getApiToken();
    if (res.success) {
      if (res.token) apiToken.value = res.token;
      apiEnabled.value = !!res.enabled;
    }
  } catch (err) {
    showToast(err.message || t('common.error'), 'error');
  }
}

async function handleToggleAccess() {
  isToggling.value = true;
  const targetState = !apiEnabled.value;
  try {
    const res = await api.toggleApiAccess(targetState);
    if (res.success) {
      apiEnabled.value = !!res.enabled;
      if (res.token) apiToken.value = res.token;
      showToast(targetState ? t('api_token.enable_success') : t('api_token.disable_success'), targetState ? 'success' : 'info');
    }
  } catch (err) {
    showToast(err.message || t('common.error'), 'error');
  } finally {
    isToggling.value = false;
  }
}

function copyToken() {
  if (!apiToken.value || !apiEnabled.value) return;
  navigator.clipboard.writeText(apiToken.value).then(() => {
    isCopied.value = true;
    showToast(t('common.copied'), 'success');
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  }).catch(() => {
    showToast(t('common.error'), 'error');
  });
}

async function handleRegenerate() {
  if (!confirm(t('api_token.regenerate_confirm'))) {
    return;
  }
  isRegenerating.value = true;
  try {
    const res = await api.regenerateApiToken();
    if (res.success && res.token) {
      apiToken.value = res.token;
      showToast(t('api_token.regenerate_success'), 'success');
    }
  } catch (err) {
    showToast(err.message || t('common.error'), 'error');
  } finally {
    isRegenerating.value = false;
  }
}

async function handleLogout() {
  try {
    await api.logout();
  } catch {}
  emit('logout');
  router.push('/login');
}
</script>
