<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { DataSource } from '@codeblock-bff/shared';
import { sourcesApi, blocksApi } from '@/lib/api';

const sources = ref<DataSource[]>([]);
const loading = ref(true);
const selectedSource = ref<number | null>(null);
const operations = ref<any[]>([]);
const loadingOperations = ref(false);

onMounted(async () => {
  await loadSources();
});

async function loadSources() {
  loading.value = true;
  try {
    const response = await sourcesApi.list();
    if (response.success && response.data) {
      sources.value = response.data;
    }
  } finally {
    loading.value = false;
  }
}

async function refreshSources() {
  await sourcesApi.refresh();
  await loadSources();
}

async function selectSource(index: number) {
  selectedSource.value = index;
  loadingOperations.value = true;
  operations.value = [];

  try {
    const response = await sourcesApi.getOperations(index);
    if (response.success && response.data) {
      operations.value = response.data.operations;
    }
  } finally {
    loadingOperations.value = false;
  }
}

async function createBlockFromOperation(operation: any) {
  const source = sources.value[selectedSource.value!];

  const response = await blocksApi.create({
    name: operation.summary || operation.operationId,
    description: operation.description,
    type: 'api_call',
    source: {
      openApiUrl: source.url,
      operationId: operation.operationId,
      path: operation.path,
      method: operation.method,
    },
    inputs: operation.parameters.map((p: any) => ({
      name: p.name,
      type: p.type,
      in: p.in,
      required: p.required,
      description: p.description,
    })),
    outputs: operation.responses
      .filter((r: any) => r.statusCode === '200')
      .map(() => ({
        name: 'response',
        type: 'object',
        path: '$',
      })),
  });

  if (response.success) {
    alert(`Block "${operation.operationId}" created successfully!`);
  }
}

function getMethodColor(method: string) {
  const colors: Record<string, string> = {
    GET: '#16a34a',
    POST: '#2563eb',
    PUT: '#d97706',
    PATCH: '#d97706',
    DELETE: '#dc2626',
  };
  return colors[method] || '#6b7280';
}
</script>

<template>
  <div>
    <header class="page-header">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1>API Sources</h1>
          <p>OpenAPI sources from Notion database</p>
        </div>
        <button class="btn btn-secondary" @click="refreshSources">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path fill-rule="evenodd" d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.418A6 6 0 118 2v1z" clip-rule="evenodd"/>
            <path d="M8 4.466V.534a.25.25 0 01.41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 018 4.466z"/>
          </svg>
          Refresh
        </button>
      </div>
    </header>

    <div class="page-content">
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>

      <div v-else class="sources-layout">
        <!-- Sources List -->
        <div class="sources-list">
          <div
            v-for="(source, index) in sources"
            :key="index"
            :class="['source-item', { active: selectedSource === index }]"
            @click="selectSource(index)"
          >
            <h4>{{ source.title }}</h4>
            <p>{{ source.description || 'No description' }}</p>
          </div>

          <div v-if="sources.length === 0" class="empty-state" style="padding: 24px;">
            <p>No API sources found in Notion</p>
          </div>
        </div>

        <!-- Operations Panel -->
        <div class="operations-panel">
          <div v-if="selectedSource === null" class="empty-state">
            <p>Select a source to view operations</p>
          </div>

          <div v-else-if="loadingOperations" class="loading">
            <div class="spinner"></div>
          </div>

          <div v-else-if="operations.length === 0" class="empty-state">
            <p>No operations found</p>
          </div>

          <div v-else>
            <h3 style="margin-bottom: 16px;">
              Operations ({{ operations.length }})
            </h3>
            <div class="operations-list">
              <div v-for="op in operations" :key="op.operationId" class="operation-item">
                <div class="operation-header">
                  <span class="method" :style="{ color: getMethodColor(op.method) }">
                    {{ op.method }}
                  </span>
                  <code class="path">{{ op.path }}</code>
                </div>
                <p class="operation-summary">{{ op.summary || op.operationId }}</p>
                <div class="operation-meta">
                  <span>{{ op.parameters?.length || 0 }} params</span>
                </div>
                <button class="btn btn-sm btn-primary" @click="createBlockFromOperation(op)">
                  Create Block
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sources-layout {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 24px;
  height: calc(100vh - 200px);
}

.sources-list {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow-y: auto;
}

.source-item {
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.15s ease;
}

.source-item:hover {
  background: var(--color-bg);
}

.source-item.active {
  background: var(--color-primary);
  color: white;
}

.source-item.active p {
  color: rgba(255, 255, 255, 0.8);
}

.source-item h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.source-item p {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.operations-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 20px;
  overflow-y: auto;
}

.operations-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.operation-item {
  padding: 16px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
}

.operation-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.operation-header .method {
  font-weight: 700;
  font-size: 12px;
}

.operation-header .path {
  font-family: monospace;
  font-size: 13px;
  color: var(--color-text);
}

.operation-summary {
  font-size: 14px;
  margin-bottom: 8px;
}

.operation-meta {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 12px;
}
</style>
