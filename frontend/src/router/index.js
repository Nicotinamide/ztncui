import { createRouter, createWebHistory } from 'vue-router';
import Login from '../views/Login.vue';
import Dashboard from '../views/Dashboard.vue';
import Networks from '../views/Networks.vue';
import NetworkDetail from '../views/NetworkDetail.vue';
import Users from '../views/Users.vue';

const routes = [
  { path: '/login', component: Login, meta: { guestOnly: true } },
  { path: '/', redirect: '/controller' },
  { path: '/controller', component: Dashboard, meta: { requiresAuth: true } },
  { path: '/networks', component: Networks, meta: { requiresAuth: true } },
  { path: '/networks/:nwid', component: NetworkDetail, meta: { requiresAuth: true } },
  { path: '/users', component: Users, meta: { requiresAuth: true } },
  { path: '/:pathMatch(.*)*', redirect: '/controller' }
];

export const router = createRouter({
  history: createWebHistory(),
  routes
});
