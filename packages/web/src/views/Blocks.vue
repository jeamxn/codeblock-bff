<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { Block } from '@codeblock-bff/shared';
import { blocksApi } from '@/lib/api';

const blocks = ref<Block[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const typeFilter = ref<string>('');

onMounted(async () => {
  await loadBlocks();
});

async function loadBlocks() {
  loading.value = true;
  try {
    const response = await blocksApi.list({
      search: searchQuery.value || undefined,
      type: typeFilter.value || undefined,
    });
    if (response.success && response.data) {
      blocks.value = response.data;
    }
  } finally {
    loading.value = false;
  }
}

async function deleteBlock(block: Block) {
  if (!block._id) return;
  if (!confirm(`Are you sure you want to delete "${block.name}"?`)) return;

  const response = await blocksApi.delete(block._id);
  if (response.success) {
    blocks.value = blocks.value.filter(b => b._id !== block._id);
  }
}

function getTypeColor(type: string) {
  const colors: Record<string, string> = {
    api_call: 'var(--color-primary)',
    transform: 'var(--color-secondary)',
    condition: 'var(--color-warning)',
    loop: 'var(--color-success)',
    aggregate: '#8b5cf6',
    custom: '#6b7280',
  };
  return colors[type] || colors.custom;
}
</script>

<template>
  <div>
    <header class="page-header">
      <div>
        <h1>Blocks</h1>
        <p>Reusable API blocks for building flows</p>
      </div>
    </header>

    <div class="page-content">
      <!-- Filters -->
      <div class="filters" style="display: flex; gap: 12px; margin-bottom: 24px;">
        <input
          v-model="searchQuery"
          type="text"
          class="form-input"
          placeholder="Search blocks..."
          style="max-width: 300px;"
          @input="loadBlocks"
        />
        <select v-model="typeFilter" class="form-input" style="max-width: 150px;" @change="loadBlocks">
          <option value="">All Types</option>
          <option value="api_call">API Call</option>
          <option value="transform">Transform</option>
          <option value="condition">Condition</option>
          <option value="loop">Loop</option>
          <option value="aggregate">Aggregate</option>
        </select>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>

      <div v-else-if="blocks.length === 0" class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
        <h3>No blocks found</h3>
        <p>Blocks are created from OpenAPI sources</p>
      </div>

      <div v-else class="grid grid-cols-3">
        <div v-for="block in blocks" :key="block._id" class="card block-card">
          <div class="block-card-header">
            <div class="block-type-indicator" :style="{ background: getTypeColor(block.type) }"></div>
            <div>
              <h3 class="card-title">{{ block.name }}</h3>
              <span class="block-type">{{ block.type }}</span>
            </div>
          </div>

          <p class="card-description">{{ block.description || 'No description' }}</p>

          <div class="block-source" v-if="block.source">
            <span class="method" :class="block.source.method.toLowerCase()">
              {{ block.source.method }}
            </span>
            <code>{{ block.source.path }}</code>
          </div>

          <div class="block-io">
            <div>
              <span class="io-label">Inputs:</span>
              <span class="io-count">{{ block.inputs?.length || 0 }}</span>
            </div>
            <div>
              <span class="io-label">Outputs:</span>
              <span class="io-count">{{ block.outputs?.length || 0 }}</span>
            </div>
          </div>

          <div class="block-card-actions">
            <button class="btn btn-sm btn-secondary" @click="deleteBlock(block)">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.block-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.block-card-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.block-type-indicator {
  width: 4px;
  height: 40px;
  border-radius: 2px;
  flex-shrink: 0;
}

.block-type {
  font-size: 12px;
  color: var(--color-text-secondary);
  text-transform: uppercase;
}

.block-source {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  background: var(--color-bg);
  padding: 8px 12px;
  border-radius: var(--radius-md);
}

.block-source .method {
  font-weight: 600;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.method.get { background: #dcfce7; color: #166534; }
.method.post { background: #dbeafe; color: #1e40af; }
.method.put { background: #fef3c7; color: #92400e; }
.method.patch { background: #fef3c7; color: #92400e; }
.method.delete { background: #fee2e2; color: #991b1b; }

.block-source code {
  font-family: monospace;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.block-io {
  display: flex;
  gap: 16px;
  font-size: 13px;
}

.io-label {
  color: var(--color-text-secondary);
}

.io-count {
  font-weight: 600;
}

.block-card-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
}
</style>
