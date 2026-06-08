import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/Login.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    name: 'dashboard',
    component: () => import('../views/Dashboard.vue'),
  },
  {
    path: '/library/:id',
    name: 'library',
    component: () => import('../views/Library.vue'),
  },
  {
    path: '/book/:id',
    name: 'book-detail',
    component: () => import('../views/BookDetail.vue'),
  },
  {
    path: '/read/:id',
    name: 'reader',
    component: () => import('../views/Reader.vue'),
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../views/Admin.vue'),
    meta: { adminOnly: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/Settings.vue'),
  },
  {
    path: '/stats',
    name: 'statistics',
    component: () => import('../views/Statistics.vue'),
  },
  {
    path: '/metadata',
    name: 'metadata',
    component: () => import('../views/MetadataEditor.vue'),
    meta: { adminOnly: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore();

  if (to.meta.public) {
    if (authStore.isAuthenticated) {
      next('/');
    } else {
      next();
    }
    return;
  }

  if (!authStore.isAuthenticated) {
    next('/login');
    return;
  }

  if (to.meta.adminOnly && authStore.user?.role !== 'admin') {
    next('/');
    return;
  }

  next();
});

export default router;
