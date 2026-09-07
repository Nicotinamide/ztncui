<template>
  <div>
    <div class="card-header" style="margin-bottom: 24px;">
      <div>
        <h1 style="font-size: 24px; font-weight: 800;">{{ t('dashboard.title') }}</h1>
        <p class="card-subtitle">{{ t('dashboard.subtitle') }}</p>
      </div>
      <div>
        <button class="btn btn-secondary" @click="fetchData" :disabled="loading">
          <span>🔄</span>
          <span>{{ t('common.refresh') }}</span>
        </button>
      </div>
    </div>

    <!-- Stats Grid -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px;">
      <!-- Controller Address Card -->
      <div class="card" style="margin-bottom: 0; padding: 20px;">
        <span class="card-subtitle">{{ t('dashboard.node_id') }}</span>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
          <span class="badge-id" style="font-size: 16px;">{{ status.address || t('common.loading') }}</span>
          <button v-if="status.address" class="copy-btn" @click="copyText(status.address, t('common.copied'))" :title="t('common.copy')">
            📋
          </button>
        </div>
      </div>

      <!-- Online Status Card -->
      <div class="card" style="margin-bottom: 0; padding: 20px;">
        <span class="card-subtitle">{{ t('dashboard.status') }}</span>
        <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge badge-success" style="font-size: 13px; padding: 4px 10px;">
              <span class="dot dot-online"></span>
              <span>{{ t('dashboard.controller_ready') }}</span>
            </span>
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px; display: flex; align-items: center; gap: 6px;">
            <span>{{ t('dashboard.planet_link') }}</span>
            <span v-if="status.online" style="color: var(--success); font-weight: 600;">{{ t('dashboard.planet_online') }}</span>
            <span v-else style="color: var(--warning); font-weight: 600;" :title="t('dashboard.planet_tip')">{{ t('dashboard.planet_syncing') }}</span>
          </div>
        </div>
      </div>

      <!-- Version Card -->
      <div class="card" style="margin-bottom: 0; padding: 20px;">
        <span class="card-subtitle">{{ t('dashboard.version') }}</span>
        <div style="font-size: 20px; font-weight: 700; margin-top: 8px; color: var(--primary);">
          v{{ status.version || '1.14+' }}
        </div>
      </div>

      <!-- Networks Count Card -->
      <div class="card" style="margin-bottom: 0; padding: 20px;">
        <span class="card-subtitle">{{ t('dashboard.networks_count') }}</span>
        <div style="font-size: 20px; font-weight: 700; margin-top: 8px;">
          {{ networks.length }} <span style="font-size: 13px; font-weight: 500; color: var(--text-muted);">{{ t('dashboard.networks_unit') }}</span>
        </div>
      </div>
    </div>

    <!-- Quick Navigation & Recent Networks -->
    <div class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">{{ t('networks.title') }}</h2>
          <p class="card-subtitle">{{ t('dashboard.recent_networks_subtitle') }}</p>
        </div>
        <router-link to="/networks" class="btn btn-primary btn-sm">
          <span>{{ t('dashboard.view_all_networks') }} ({{ networks.length }}) →</span>
        </router-link>
      </div>

      <div v-if="networks.length > 0" class="table-container">
        <table>
          <thead>
            <tr>
              <th>{{ t('networks.network_name') }}</th>
              <th>{{ t('networks.network_id') }}</th>
              <th>{{ t('networks.mode') }}</th>
              <th style="text-align: right;">{{ t('common.action') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="net in networks.slice(0, 5)" :key="net.nwid">
              <td>
                <router-link :to="'/networks/' + net.nwid" style="font-weight: 600; color: var(--primary); text-decoration: none;">
                  {{ net.name || t('common.unnamed_network') }}
                </router-link>
              </td>
              <td>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="badge-id">{{ net.nwid }}</span>
                  <button class="copy-btn" @click="copyText(net.nwid, t('common.copied'))">📋</button>
                </div>
              </td>
              <td>
                <span v-if="net.private" class="badge badge-muted">🔒 {{ t('networks.private_mode') }}</span>
                <span v-else class="badge badge-success">🌐 {{ t('networks.public_mode') }}</span>
              </td>
              <td style="text-align: right;">
                <router-link :to="'/networks/' + net.nwid" class="btn btn-secondary btn-sm">
                  <span>⚙️ {{ t('networks.detail_btn') }}</span>
                </router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else style="text-align: center; padding: 32px 16px; color: var(--text-muted);">
        {{ t('networks.empty_title') }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { t } from '../i18n';
import { api } from '../api';
import { copyText, showToast } from '../toast';

const status = ref({});
const networks = ref([]);
const loading = ref(false);

async function fetchData() {
  loading.value = true;
  try {
    const [statusRes, netRes] = await Promise.all([
      api.getStatus().catch(() => ({ status: {} })),
      api.getNetworks().catch(() => ({ networks: [] }))
    ]);
    status.value = statusRes.status || {};
    networks.value = netRes.networks || [];
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchData();
});
</script>
