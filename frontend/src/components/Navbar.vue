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
        title="查看与管理 API Token"
        style="background: rgba(255,180,0,0.15); color: #ffb400; border: 1px solid rgba(255,180,0,0.35); font-weight: 600; display: flex; align-items: center; gap: 6px; padding: 4px 10px;"
      >
        <span>🔑</span>
        <span>API Token</span>
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
    <div v-if="showTokenModal" class="modal-overlay" @click.self="showTokenModal = false">
      <div class="modal-content" style="max-width: 520px;">
        <div class="modal-header">
          <h3 style="margin: 0; font-size: 16px; display: flex; align-items: center; gap: 8px;">
            <span>🔑</span>
            <span>API Token 接口凭据管理</span>
          </h3>
          <button @click="showTokenModal = false" style="background: transparent; border: none; font-size: 18px; color: var(--text-muted); cursor: pointer;">✕</button>
        </div>

        <div class="modal-body">
          <p style="font-size: 13px; color: var(--text-muted); line-height: 1.6; margin-top: 0; margin-bottom: 16px;">
            此 API Token 专用于 <strong>SysMonitor 桌面微件</strong> 或自动化脚本调用控制器接口（只读鉴权）。长效有效，不受 Web 页面退出或重启影响。
          </p>

          <!-- Token Row -->
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 6px;">
              控制器只读 Token
            </label>
            <div style="display: flex; gap: 8px;">
              <div style="flex: 1; background: #0f172a; border: 1px solid #334155; border-radius: var(--radius-sm); padding: 8px 12px; font-family: monospace; font-size: 13px; color: #38bdf8; word-break: break-all; display: flex; align-items: center; justify-content: space-between;">
                <span>{{ isTokenVisible ? apiToken : maskedToken }}</span>
                <button
                  @click="isTokenVisible = !isTokenVisible"
                  style="background: transparent; border: none; cursor: pointer; color: #94a3b8; font-size: 14px; padding: 2px;"
                  :title="isTokenVisible ? '隐藏 Token' : '显示完整 Token'"
                >
                  {{ isTokenVisible ? '🙈' : '👁' }}
                </button>
              </div>
              <button class="btn btn-primary" @click="copyToken" style="white-space: nowrap;">
                <span>📋</span>
                <span>{{ copyBtnText }}</span>
              </button>
            </div>
          </div>

          <!-- Regenerate Box -->
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius-sm); padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
              <div>
                <div style="font-size: 13px; font-weight: 600; color: #dc2626;">轮转 / 重置 Token</div>
                <div style="font-size: 11.5px; color: #7f1d1d; margin-top: 2px;">若怀疑 Token 泄露可重新生成。重新生成后旧 Token 将立即失效。</div>
              </div>
              <button class="btn btn-sm btn-danger" @click="handleRegenerate" :disabled="isRegenerating" style="white-space: nowrap;">
                {{ isRegenerating ? '生成中...' : '重新生成' }}
              </button>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showTokenModal = false">关闭</button>
        </div>
      </div>
    </div>
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
const isTokenVisible = ref(false);
const isRegenerating = ref(false);
const copyBtnText = ref('复制');

const maskedToken = computed(() => {
  if (!apiToken.value) return '加载中...';
  if (apiToken.value.length <= 8) return '••••••••••••••••';
  return apiToken.value.substring(0, 5) + '••••••••••••••••' + apiToken.value.substring(apiToken.value.length - 4);
});

async function openTokenModal() {
  showTokenModal.value = true;
  copyBtnText.value = '复制';
  isTokenVisible.value = false;
  try {
    const res = await api.getApiToken();
    if (res.success && res.token) {
      apiToken.value = res.token;
    }
  } catch (err) {
    showToast(err.message || '获取 Token 失败', 'error');
  }
}

function copyToken() {
  if (!apiToken.value) return;
  navigator.clipboard.writeText(apiToken.value).then(() => {
    copyBtnText.value = '已复制!';
    showToast('API Token 已复制到剪贴板', 'success');
    setTimeout(() => {
      copyBtnText.value = '复制';
    }, 2000);
  }).catch(() => {
    showToast('复制失败，请手动选取复制', 'error');
  });
}

async function handleRegenerate() {
  if (!confirm('确定要重新生成 API Token 吗？旧 Token 将立即失效，所有已配置的桌面微件需同步更新。')) {
    return;
  }
  isRegenerating.value = true;
  try {
    const res = await api.regenerateApiToken();
    if (res.success && res.token) {
      apiToken.value = res.token;
      showToast('API Token 重新生成成功！', 'success');
    }
  } catch (err) {
    showToast(err.message || '重新生成失败', 'error');
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
