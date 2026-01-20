<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { Flow } from '@codeblock-bff/shared';
import { flowsApi } from '@/lib/api';

const router = useRouter();

const flows = ref<Flow[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const statusFilter = ref<string>('');

onMounted(async () => {
  await loadFlows();
});

async function loadFlows() {
  loading.value = true;
  try {
    const response = await flowsApi.list({
      search: searchQuery.value || undefined,
      status: statusFilter.value || undefined,
    });
    if (response.success && response.data) {
      flows.value = response.data;
    }
  } finally {
    loading.value = false;
  }
}

async function deleteFlow(flow: Flow) {
  if (!flow._id) return;
  if (!confirm(`Are you sure you want to delete "${flow.name}"?`)) return;

  const response = await flowsApi.delete(flow._id);
  if (response.success) {
    flows.value = flows.value.filter(f => f._id !== flow._id);
  }
}

function formatDate(dateStr?: string | Date) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getExecuteUrl(slug: string) {
  return `${window.location.origin}/api/execute/${slug}`;
}
</script>

<template>
  <div>
    <header class="page-header">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1>Flows</h1>
          <p>Manage your API composition flows</p>
        </div>
        <button class="btn btn-primary" @click="router.push('/flows/new')">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z"/>
          </svg>
          New Flow
        </button>
      </div>
    </header>

    <div class="page-content">
      <!-- Filters -->
      <div class="filters" style="display: flex; gap: 12px; margin-bottom: 24px;">
        <input
          v-model="searchQuery"
          type="text"
          class="form-input"
          placeholder="Search flows..."
          style="max-width: 300px;"
          @input="loadFlows"
        />
        <select v-model="statusFilter" class="form-input" style="max-width: 150px;" @change="loadFlows">
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>

      <div v-else-if="flows.length === 0" class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
        <h3>No flows found</h3>
        <p>Create your first flow to get started</p>
        <button class="btn btn-primary" style="margin-top: 16px;" @click="router.push('/flows/new')">
          Create Flow
        </button>
      </div>

      <div v-else class="grid grid-cols-2">
        <div v-for="flow in flows" :key="flow._id" class="card flow-card">
          <div class="flow-card-header">
            <h3 class="card-title">{{ flow.name }}</h3>
            <span :class="['badge', `badge-${flow.status}`]">{{ flow.status }}</span>
          </div>
          <p class="card-description">{{ flow.description || 'No description' }}</p>

          <div class="flow-card-meta">
            <span>Slug: <code>{{ flow.slug }}</code></span>
            <span>v{{ flow.version }}</span>
            <span>Updated: {{ formatDate(flow.updatedAt) }}</span>
          </div>

          <div v-if="flow.status === 'published'" class="flow-card-url">
            <span>Execute URL:</span>
            <code>{{ getExecuteUrl(flow.slug) }}</code>
          </div>

          <div class="flow-card-actions">
            <button class="btn btn-sm btn-primary" @click="router.push(`/flows/${flow._id}`)">
              Edit
            </button>
            <button class="btn btn-sm btn-secondary" @click="deleteFlow(flow)">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flow-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.flow-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.flow-card-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.flow-card-meta code {
  background: var(--color-bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.flow-card-url {
  font-size: 13px;
  color: var(--color-text-secondary);
  background: var(--color-bg);
  padding: 8px 12px;
  border-radius: var(--radius-md);
}

.flow-card-url code {
  display: block;
  margin-top: 4px;
  font-family: monospace;
  word-break: break-all;
}

.flow-card-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
}
</style>
