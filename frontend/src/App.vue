<template>
  <div class="app-container">
    <Navbar
      v-if="currentUser && $route.path !== '/login'"
      :currentUser="currentUser"
      @logout="currentUser = null"
    />

    <main :class="currentUser && $route.path !== '/login' ? 'main-content' : ''">
      <router-view
        :currentUser="currentUser"
        @login-success="onLoginSuccess"
      />
    </main>

    <Toast />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import Navbar from './components/Navbar.vue';
import Toast from './components/Toast.vue';
import { api } from './api';

const router = useRouter();
const route = useRoute();
const currentUser = ref(null);
const authChecked = ref(false);

async function checkAuth() {
  try {
    const res = await api.getMe();
    if (res.success && res.user) {
      currentUser.value = res.user;
      if (route.path === '/login') {
        router.push('/controller');
      }
    } else {
      currentUser.value = null;
      if (route.path !== '/login') {
        router.push('/login');
      }
    }
  } catch {
    currentUser.value = null;
    if (route.path !== '/login') {
      router.push('/login');
    }
  } finally {
    authChecked.value = true;
  }
}

function onLoginSuccess(user) {
  currentUser.value = user;
}

onMounted(() => {
  checkAuth();
});

router.beforeEach(async (to, from, next) => {
  if (!authChecked.value) {
    return next();
  }
  if (to.meta.requiresAuth && !currentUser.value) {
    return next('/login');
  }
  if (to.meta.guestOnly && currentUser.value) {
    return next('/controller');
  }
  next();
});
</script>
