<template>
  <div>
    <div class="card-header" style="margin-bottom: 24px;">
      <div>
        <h1 style="font-size: 24px; font-weight: 800;">{{ t('networks.title') }}</h1>
        <p class="card-subtitle">{{ t('networks.subtitle') }}</p>
      </div>
      <div style="display: flex; gap: 10px;">
        <button class="btn btn-secondary" @click="fetchNetworks" :disabled="loading">
          <span>🔄</span>
          <span>刷新</span>
        </button>
        <button class="btn btn-primary" @click="showCreateModal = true">
          <span>➕</span>
          <span>{{ t('networks.create_btn') }}</span>
        </button>
      </div>
    </div>

    <div class="card">
      <div style="margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
        <div style="max-width: 320px; width: 100%;">
          <input
            v-model="searchQuery"
            type="text"
            class="form-control"
            :placeholder="t('common.search')"
          />
        </div>
        <div style="font-size: 13px; color: var(--text-muted);">
          共 {{ filteredNetworks.length }} 个网络
        </div>
      </div>

      <div v-if="filteredNetworks.length > 0" class="table-container">
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">{{ t('networks.network_name') }}</th>
              <th style="width: 35%;">{{ t('networks.network_id') }}</th>
              <th style="width: 15%;">{{ t('networks.mode') }}</th>
              <th style="width: 25%; text-align: right;">{{ t('common.action') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="net in filteredNetworks" :key="net.nwid">
              <td>
                <router-link
                  :to="'/networks/' + net.nwid"
                  style="font-weight: 600; font-size: 15px; color: var(--primary); text-decoration: none;"
                >
                  {{ net.name || 'Unnamed Network' }}
                </router-link>
              </td>
              <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="badge-id">{{ net.nwid }}</span>
                  <button class="copy-btn" @click="copyText(net.nwid, t('common.copied'))" :title="t('common.copy')">
                    📋
                  </button>
                </div>
              </td>
              <td>
                <span v-if="net.private" class="badge badge-muted">
                  🔒 {{ t('networks.private_mode') }}
                </span>
                <span v-else class="badge badge-success">
                  🌐 {{ t('networks.public_mode') }}
                </span>
              </td>
              <td style="text-align: right;">
                <div style="display: inline-flex; gap: 6px;">
                  <router-link :to="'/networks/' + net.nwid" class="btn btn-secondary btn-sm">
                    <span>⚙️ {{ t('networks.detail_btn') }}</span>
                  </router-link>
                  <button class="btn btn-danger btn-sm" @click="confirmDelete(net)">
                    <span>🗑️</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty state -->
      <div v-else-if="!loading" style="text-align: center; padding: 48px 20px;">
        <div style="font-size: 44px; margin-bottom: 12px;">🌐</div>
        <h3 style="font-size: 18px; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">{{ t('networks.empty_title') }}</h3>
        <p style="color: var(--text-muted); font-size: 14px; max-width: 440px; margin: 0 auto 20px;">{{ t('networks.empty_desc') }}</p>
        <button class="btn btn-primary" @click="showCreateModal = true">
          <span>➕ {{ t('networks.create_btn') }}</span>
        </button>
      </div>
    </div>

    <!-- Create Network Modal -->
    <Modal v-model="showCreateModal" :title="t('networks.modal_title')">
      <form @submit.prevent="handleCreate">
        <div class="form-group">
          <label class="form-label">{{ t('networks.network_name') }}</label>
          <input
            v-model="newNetName"
            type="text"
            class="form-control"
            :placeholder="t('networks.name_placeholder')"
            required
            autofocus
          />
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
          <button type="button" class="btn btn-secondary" @click="showCreateModal = false">{{ t('common.cancel') }}</button>
          <button type="submit" class="btn btn-primary" :disabled="creating">
            <span v-if="creating">⏳ 创建中...</span>
            <span v-else>确认创建</span>
          </button>
        </div>
      </form>
    </Modal>

    <!-- Delete Confirm Modal -->
    <Modal v-model="showDeleteModal" title="确认删除网络">
      <p style="color: var(--text-main); font-size: 14px; line-height: 1.6;">
        确定要彻底删除网络 <strong>{{ deleteTarget?.name }}</strong> (<code style="color: var(--primary);">{{ deleteTarget?.nwid }}</code>) 吗？
      </p>
      <p style="color: var(--danger); font-size: 13px; margin-top: 8px;">
        ⚠️ 注意：此操作不可撤销，网络内所有成员连接将立即断开！
      </p>
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
        <button type="button" class="btn btn-secondary" @click="showDeleteModal = false">{{ t('common.cancel') }}</button>
        <button type="button" class="btn btn-danger" @click="handleDelete" :disabled="deleting">
          <span v-if="deleting">⏳ 正在删除...</span>
          <span v-else>确认彻底删除</span>
        </button>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { t } from '../i18n';
import { api } from '../api';
import { copyText, showToast } from '../toast';
import Modal from '../components/Modal.vue';

const router = useRouter();
const networks = ref([]);
const searchQuery = ref('');
const loading = ref(false);

const showCreateModal = ref(false);
const newNetName = ref('');
const creating = ref(false);

const showDeleteModal = ref(false);
const deleteTarget = ref(null);
const deleting = ref(false);

const filteredNetworks = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return networks.value;
  return networks.value.filter(n =>
    (n.name && n.name.toLowerCase().includes(q)) ||
    (n.nwid && n.nwid.toLowerCase().includes(q))
  );
});

async function fetchNetworks() {
  loading.value = true;
  try {
    const res = await api.getNetworks();
    networks.value = res.networks || [];
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    loading.value = false;
  }
}

async function handleCreate() {
  if (!newNetName.value.trim()) return;
  creating.value = true;
  try {
    const res = await api.createNetwork(newNetName.value.trim());
    showToast('网络创建成功！');
    showCreateModal.value = false;
    newNetName.value = '';
    await fetchNetworks();
    if (res.network && res.network.nwid) {
      router.push('/networks/' + res.network.nwid);
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    creating.value = false;
  }
}

function confirmDelete(net) {
  deleteTarget.value = net;
  showDeleteModal.value = true;
}

async function handleDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await api.deleteNetwork(deleteTarget.value.nwid);
    showToast('网络已成功删除');
    showDeleteModal.value = false;
    deleteTarget.value = null;
    await fetchNetworks();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  fetchNetworks();
});
</script>
