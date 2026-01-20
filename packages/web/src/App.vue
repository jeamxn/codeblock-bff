<script setup lang="ts">
import { RouterView, RouterLink, useRoute } from 'vue-router';
import { computed } from 'vue';

const route = useRoute();

const navItems = [
  { path: '/', name: 'Home', icon: 'home' },
  { path: '/flows', name: 'Flows', icon: 'flow' },
  { path: '/blocks', name: 'Blocks', icon: 'block' },
  { path: '/sources', name: 'Sources', icon: 'source' },
];

const isActive = (path: string) => {
  if (path === '/') return route.path === '/';
  return route.path.startsWith(path);
};
</script>

<template>
  <div class="app-container">
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <svg viewBox="0 0 32 32">
            <rect x="2" y="2" width="12" height="12" rx="2" fill="#4f46e5"/>
            <rect x="18" y="2" width="12" height="12" rx="2" fill="#06b6d4"/>
            <rect x="2" y="18" width="12" height="12" rx="2" fill="#10b981"/>
            <rect x="18" y="18" width="12" height="12" rx="2" fill="#f59e0b"/>
          </svg>
          BFF Editor
        </div>
      </div>
      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          :class="['nav-item', { active: isActive(item.path) }]"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <template v-if="item.icon === 'home'">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
            </template>
            <template v-else-if="item.icon === 'flow'">
              <path fill-rule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clip-rule="evenodd"/>
            </template>
            <template v-else-if="item.icon === 'block'">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
            </template>
            <template v-else-if="item.icon === 'source'">
              <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/>
            </template>
          </svg>
          {{ item.name }}
        </RouterLink>
      </nav>
    </aside>
    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>
