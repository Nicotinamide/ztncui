<template>
  <div>
    <div class="card-header" style="margin-bottom: 24px;">
      <div>
        <h1 style="font-size: 24px; font-weight: 800;">{{ t('users.title') }}</h1>
        <p class="card-subtitle">{{ t('users.subtitle') }}</p>
      </div>
      <div>
        <button class="btn btn-primary" @click="showAddModal = true">
          <span>➕ {{ t('users.add_btn') }}</span>
        </button>
      </div>
    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>{{ t('users.col_username') }}</th>
              <th>{{ t('users.col_pass_status') }}</th>
              <th style="width: 25%; text-align: right;">{{ t('common.action') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.name">
              <td>
                <div style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
                  <span>👤</span>
                  <span>{{ user.name }}</span>
                </div>
              </td>
              <td>
                <span v-if="user.pass_set" class="badge badge-success">
                  {{ t('users.pass_set') }}
                </span>
                <span v-else class="badge badge-danger">
                  ⚠️ {{ t('users.pass_default') }}
                </span>
              </td>
              <td style="text-align: right;">
                <div style="display: inline-flex; gap: 8px;">
                  <button class="btn btn-secondary btn-sm" @click="openChangePassModal(user)">
                    🔑 {{ t('users.change_pass') }}
                  </button>
                  <button class="btn btn-danger btn-sm" @click="confirmDeleteUser(user)">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add User Modal -->
    <Modal v-model="showAddModal" :title="t('users.add_btn')">
      <form @submit.prevent="handleAddUser">
        <div class="form-group">
          <label class="form-label">{{ t('users.col_username') }}</label>
          <input v-model="newUsername" type="text" class="form-control" required />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('users.new_pass') }}</label>
          <input v-model="newPassword" type="password" class="form-control" required minlength="10" />
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
          <button type="button" class="btn btn-secondary" @click="showAddModal = false">{{ t('common.cancel') }}</button>
          <button type="submit" class="btn btn-primary">{{ t('common.confirm') }}</button>
        </div>
      </form>
    </Modal>

    <!-- Change Password Modal -->
    <Modal v-model="showPassModal" :title="t('users.change_pass_user', { name: selectedUser?.name || '' })">
      <form @submit.prevent="handleChangePassword">
        <div class="form-group">
          <label class="form-label">{{ t('users.new_pass') }}</label>
          <input v-model="changePass1" type="password" class="form-control" required minlength="10" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('users.confirm_pass') }}</label>
          <input v-model="changePass2" type="password" class="form-control" required minlength="10" />
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
          <button type="button" class="btn btn-secondary" @click="showPassModal = false">{{ t('common.cancel') }}</button>
          <button type="submit" class="btn btn-primary">{{ t('common.save') }}</button>
        </div>
      </form>
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { t } from '../i18n';
import { api } from '../api';
import { showToast } from '../toast';
import Modal from '../components/Modal.vue';

const router = useRouter();
const users = ref([]);
const loading = ref(false);

const showAddModal = ref(false);
const newUsername = ref('');
const newPassword = ref('');

const showPassModal = ref(false);
const selectedUser = ref(null);
const changePass1 = ref('');
const changePass2 = ref('');

async function fetchUsers() {
  loading.value = true;
  try {
    const res = await api.getUsers();
    users.value = res.users || [];
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    loading.value = false;
  }
}

async function handleAddUser() {
  if (newPassword.value.length < 10) {
    showToast(t('toast.pass_min_length'), 'error');
    return;
  }
  try {
    await api.createUser(newUsername.value.trim(), newPassword.value);
    showToast(t('toast.user_added'));
    showAddModal.value = false;
    newUsername.value = '';
    newPassword.value = '';
    await fetchUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openChangePassModal(user) {
  selectedUser.value = user;
  changePass1.value = '';
  changePass2.value = '';
  showPassModal.value = true;
}

async function handleChangePassword() {
  if (changePass1.value !== changePass2.value) {
    showToast(t('toast.pass_mismatch'), 'error');
    return;
  }
  if (changePass1.value.length < 10) {
    showToast(t('toast.pass_min_length'), 'error');
    return;
  }
  try {
    await api.updatePassword(selectedUser.value.name, changePass1.value);
    showToast(t('toast.pass_updated'));
    showPassModal.value = false;
    await fetchUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function confirmDeleteUser(user) {
  if (!confirm(t('users.delete_user_confirm_named', { name: user.name }))) return;
  try {
    const res = await api.deleteUser(user.name);
    showToast(t('toast.user_deleted'));
    if (res.selfDeleted) {
      router.push('/login');
    } else {
      await fetchUsers();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

onMounted(() => {
  fetchUsers();
});
</script>
