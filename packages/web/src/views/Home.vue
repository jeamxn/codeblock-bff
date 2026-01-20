<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { flowsApi, blocksApi, sourcesApi } from '@/lib/api';

const router = useRouter();

const stats = ref({
  flows: 0,
  blocks: 0,
  sources: 0,
});

const recentFlows = ref<Array<{ _id: string; name: string; status: string; updatedAt: string }>>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const [flowsRes, blocksRes, sourcesRes] = await Promise.all([
      flowsApi.list({ limit: 5 }),
      blocksApi.list({ limit: 1 }),
      sourcesApi.list(),
    ]);

    if (flowsRes.success) {
      recentFlows.value = flowsRes.data || [];
      stats.value.flows = flowsRes.meta?.total || recentFlows.value.length;
    }

    if (blocksRes.success) {
      stats.value.blocks = blocksRes.meta?.total || 0;
    }

    if (sourcesRes.success && sourcesRes.data) {
      stats.value.sources = sourcesRes.data.length;
    }
  } finally {
    loading.value = false;
  }
});

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
</script>

<template>
  <div>
    <header class="page-header">
      <h1>Dashboard</h1>
      <p>Welcome to BFF Block Editor</p>
    </header>

    <div class="page-content">
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>

      <template v-else>
        <!-- Stats -->
        <div class="grid grid-cols-3" style="margin-bottom: 24px;">
          <div class="card">
            <div class="stat-value">{{ stats.flows }}</div>
            <div class="stat-label">Flows</div>
          </div>
          <div class="card">
            <div class="stat-value">{{ stats.blocks }}</div>
            <div class="stat-label">Blocks</div>
          </div>
          <div class="card">
            <div class="stat-value">{{ stats.sources }}</div>
            <div class="stat-label">API Sources</div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="card" style="margin-bottom: 24px;">
          <h3 class="card-title">Quick Actions</h3>
          <div style="display: flex; gap: 12px; margin-top: 16px;">
            <button class="btn btn-primary" @click="router.push('/flows/new')">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z"/>
              </svg>
              Create New Flow
            </button>
            <button class="btn btn-secondary" @click="router.push('/blocks')">
              View Blocks
            </button>
            <button class="btn btn-secondary" @click="router.push('/sources')">
              Browse Sources
            </button>
          </div>
        </div>

        <!-- Recent Flows -->
        <div class="card">
          <h3 class="card-title">Recent Flows</h3>
          <div v-if="recentFlows.length === 0" class="empty-state" style="padding: 24px;">
            <p>No flows yet. Create your first flow!</p>
          </div>
          <table v-else class="table" style="margin-top: 16px;">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="flow in recentFlows" :key="flow._id">
                <td>{{ flow.name }}</td>
                <td>
                  <span :class="['badge', `badge-${flow.status}`]">{{ flow.status }}</span>
                </td>
                <td>{{ formatDate(flow.updatedAt) }}</td>
                <td>
                  <button class="btn btn-sm btn-secondary" @click="router.push(`/flows/${flow._id}`)">
                    Edit
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-primary);
}

.stat-label {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}
</style>
