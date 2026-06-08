<template>
  <div id="app-root">
    <AppHeader v-if="authStore.isAuthenticated && !isReaderPage" />
    <main :class="{ 'reader-mode': isReaderPage }">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth';
import AppHeader from './components/AppHeader.vue';

const route = useRoute();
const authStore = useAuthStore();

const isReaderPage = computed(() => route.name === 'reader');
</script>
