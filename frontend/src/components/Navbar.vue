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
    <Teleport to="body">
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
            <!-- Master Switch Box -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: var(--radius-sm); padding: 14px 16px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
                <div>
                  <div style="font-size: 14px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 8px;">
                    <span>API 访问权限总开关</span>
                    <span
                      :style="{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: '600',
                        background: apiEnabled ? '#dcfce7' : '#f1f5f9',
                        color: apiEnabled ? '#15803d' : '#64748b'
                      }"
                    >
                      {{ apiEnabled ? '● 已开启' : '○ 已关闭 (默认安全)' }}
                    </span>
                  </div>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px; line-height: 1.5;">
                    出于系统安全考量，API 接口默认关闭。若需使用 SysMonitor 桌面微件或外部脚本，请在此手动开启。
                  </div>
                </div>

                <button
                  @click="handleToggleAccess"
                  :disabled="isToggling"
                  :class="['btn btn-sm', apiEnabled ? 'btn-danger' : 'btn-success']"
                  style="white-space: nowrap; min-width: 90px; padding: 6px 14px; font-weight: 600;"
                >
                  {{ isToggling ? '处理中...' : (apiEnabled ? '关闭 API' : '开启 API') }}
                </button>
              </div>
            </div>

            <!-- Status Alert -->
            <div
              v-if="!apiEnabled"
              style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 16px; font-size: 12px; color: #92400e; display: flex; align-items: center; gap: 8px;"
            >
              <span>🔒</span>
              <span><strong>默认安全保护中</strong>：当前 API 处于关闭状态，外部调用将被服务端拒绝 (HTTP 403)。开启后方可同步。</span>
            </div>

            <div
              v-else
              style="background: #f0fdf4; border: 1px solid #dcfce7; border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 16px; font-size: 12px; color: #166534; display: flex; align-items: center; gap: 8px;"
            >
              <span>🟢</span>
              <span><strong>API 运行中</strong>：持有下方只读 Token 的客户端（如 SysMonitor 悬浮窗）可实时查询成员数据。</span>
            </div>

            <!-- Token Row -->
            <div style="margin-bottom: 16px;" :style="{ opacity: apiEnabled ? 1 : 0.65 }">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label style="font-size: 12px; font-weight: 600; color: var(--text);">
                  控制器只读 Token
                </label>
                <span v-if="!apiEnabled" style="font-size: 11px; color: #b45309; font-weight: 500;">
                  (API 关闭中，暂不可用)
                </span>
              </div>
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
                <button
                  class="btn btn-primary"
                  @click="copyToken"
                  :disabled="!apiEnabled"
                  style="white-space: nowrap;"
                  :title="!apiEnabled ? '请先开启上方 API 开关' : '复制 Token'"
                >
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
    if (res.success) {
      if (res.token) apiToken.value = res.token;
      apiEnabled.value = !!res.enabled;
    }
  } catch (err) {
    showToast(err.message || '获取 Token 失败', 'error');
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
      showToast(targetState ? '✅ API 访问已手动开启！' : '🔒 API 访问已关闭', targetState ? 'success' : 'info');
    }
  } catch (err) {
    showToast(err.message || '切换 API 状态失败', 'error');
  } finally {
    isToggling.value = false;
  }
}

function copyToken() {
  if (!apiToken.value || !apiEnabled.value) return;
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
