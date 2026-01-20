<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { VueFlow, useVueFlow, Panel, MiniMap, Controls, Background } from '@vue-flow/core';
import type { Node, Edge, Connection } from '@vue-flow/core';
import { useFlowEditorStore } from '@/stores/flowEditor';
import type { Block } from '@codeblock-bff/shared';

const route = useRoute();
const router = useRouter();
const store = useFlowEditorStore();

const {
  onConnect,
  onNodeDragStop,
  onPaneClick,
  addEdges,
} = useVueFlow();

const showSettings = ref(false);
const testInputs = ref<Record<string, string>>({});
const testResult = ref<unknown>(null);
const testing = ref(false);

const flowId = computed(() => route.params.id as string | undefined);
const isNew = computed(() => !flowId.value || flowId.value === 'new');

onMounted(async () => {
  await store.loadBlocks();

  if (flowId.value && flowId.value !== 'new') {
    await store.loadFlow(flowId.value);
  } else {
    store.createNewFlow();
  }
});

// Handle connection
onConnect((params: Connection) => {
  store.addEdge(params.source!, params.target!);
});

// Handle node drag
onNodeDragStop(({ node }) => {
  store.updateNodePosition(node.id, node.position);
});

// Handle pane click (deselect)
onPaneClick(() => {
  store.selectNode(null);
});

// Handle drop from palette
function onDrop(event: DragEvent) {
  const blockData = event.dataTransfer?.getData('application/json');
  if (!blockData) return;

  const block: Block = JSON.parse(blockData);
  const bounds = (event.target as HTMLElement).getBoundingClientRect();
  const position = {
    x: event.clientX - bounds.left - 90,
    y: event.clientY - bounds.top - 25,
  };

  store.addNode(block, position);
}

function onDragOver(event: DragEvent) {
  event.preventDefault();
  event.dataTransfer!.dropEffect = 'copy';
}

function startDrag(event: DragEvent, block: Block) {
  event.dataTransfer?.setData('application/json', JSON.stringify(block));
  event.dataTransfer!.effectAllowed = 'copy';
}

async function handleSave() {
  const result = await store.saveFlow();
  if (result && isNew.value) {
    router.replace(`/flows/${result._id}`);
  }
}

async function handlePublish() {
  const result = await store.publishFlow();
  if (result) {
    alert('Flow published successfully!');
  }
}

async function runTest() {
  if (!store.flow?.slug) {
    alert('Please save the flow first');
    return;
  }

  testing.value = true;
  testResult.value = null;

  try {
    const inputs: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(testInputs.value)) {
      try {
        inputs[key] = JSON.parse(value);
      } catch {
        inputs[key] = value;
      }
    }

    const response = await fetch(`/api/execute/${store.flow.slug}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
    });

    testResult.value = await response.json();
  } finally {
    testing.value = false;
  }
}

function getBlockColor(type: string) {
  const colors: Record<string, string> = {
    api_call: '#4f46e5',
    transform: '#06b6d4',
    condition: '#f59e0b',
    loop: '#10b981',
    aggregate: '#8b5cf6',
    custom: '#6b7280',
  };
  return colors[type] || colors.custom;
}
</script>

<template>
  <div class="flow-editor">
    <!-- Header -->
    <header class="editor-header">
      <div class="header-left">
        <button class="btn btn-secondary btn-sm" @click="router.push('/flows')">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path fill-rule="evenodd" d="M12.5 10a.75.75 0 000-1.5H5.56l2.22-2.22a.75.75 0 00-1.06-1.06l-3.5 3.5a.75.75 0 000 1.06l3.5 3.5a.75.75 0 001.06-1.06L5.56 10H12.5z" clip-rule="evenodd"/>
          </svg>
          Back
        </button>
        <div class="header-title">
          <input
            v-if="store.flow"
            v-model="store.flow.name"
            type="text"
            class="title-input"
            placeholder="Flow name"
            @change="store.hasChanges = true"
          />
          <span v-if="store.flow" :class="['badge', `badge-${store.flow.status}`]">
            {{ store.flow.status }}
          </span>
          <span v-if="store.hasChanges" class="unsaved-indicator">Unsaved changes</span>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary btn-sm" @click="showSettings = !showSettings">
          Settings
        </button>
        <button
          class="btn btn-secondary btn-sm"
          :disabled="store.isSaving || !store.hasChanges"
          @click="handleSave"
        >
          {{ store.isSaving ? 'Saving...' : 'Save' }}
        </button>
        <button
          v-if="store.flow?.status === 'draft'"
          class="btn btn-primary btn-sm"
          :disabled="!store.flow?._id"
          @click="handlePublish"
        >
          Publish
        </button>
      </div>
    </header>

    <div class="editor-body">
      <!-- Block Palette -->
      <aside class="block-palette">
        <h3>Blocks</h3>
        <div class="palette-search">
          <input type="text" placeholder="Search blocks..." class="form-input" />
        </div>
        <div class="palette-list">
          <div
            v-for="block in store.availableBlocks"
            :key="block._id"
            class="palette-item"
            draggable="true"
            @dragstart="startDrag($event, block)"
          >
            <div
              class="palette-item-indicator"
              :style="{ background: getBlockColor(block.type) }"
            ></div>
            <div class="palette-item-content">
              <div class="palette-item-name">{{ block.name }}</div>
              <div class="palette-item-type">{{ block.type }}</div>
            </div>
          </div>
          <div v-if="store.availableBlocks.length === 0" class="palette-empty">
            No blocks available. Create blocks from Sources page.
          </div>
        </div>
      </aside>

      <!-- Canvas -->
      <div class="canvas-container" @drop="onDrop" @dragover="onDragOver">
        <VueFlow
          v-model:nodes="store.nodes"
          v-model:edges="store.edges"
          :default-viewport="{ zoom: 1 }"
          fit-view-on-init
          @node-click="({ node }) => store.selectNode(node.id)"
        >
          <Background />
          <MiniMap />
          <Controls />

          <template #node-api_call="{ data }">
            <div class="custom-node api_call">
              <div class="node-label">{{ data.label }}</div>
              <div class="node-type">API Call</div>
            </div>
          </template>

          <template #node-transform="{ data }">
            <div class="custom-node transform">
              <div class="node-label">{{ data.label }}</div>
              <div class="node-type">Transform</div>
            </div>
          </template>

          <template #node-condition="{ data }">
            <div class="custom-node condition">
              <div class="node-label">{{ data.label }}</div>
              <div class="node-type">Condition</div>
            </div>
          </template>
        </VueFlow>
      </div>

      <!-- Property Panel -->
      <aside class="property-panel" v-if="store.selectedNode || showSettings">
        <template v-if="showSettings && store.flow">
          <h3>Flow Settings</h3>
          <div class="panel-section">
            <div class="form-group">
              <label class="form-label">Name</label>
              <input
                v-model="store.flow.name"
                type="text"
                class="form-input"
                @change="store.hasChanges = true"
              />
            </div>
            <div class="form-group">
              <label class="form-label">Slug (URL path)</label>
              <input
                v-model="store.flow.slug"
                type="text"
                class="form-input"
                placeholder="my-flow"
                pattern="[a-z0-9-]+"
                @change="store.hasChanges = true"
              />
              <small style="color: var(--color-text-secondary);">
                lowercase letters, numbers, hyphens only
              </small>
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea
                v-model="store.flow.description"
                class="form-input"
                rows="3"
                @change="store.hasChanges = true"
              ></textarea>
            </div>
          </div>

          <!-- Test Runner -->
          <h3 style="margin-top: 24px;">Test Flow</h3>
          <div class="panel-section">
            <div v-for="input in store.flow.inputs" :key="input.name" class="form-group">
              <label class="form-label">{{ input.name }}</label>
              <input
                v-model="testInputs[input.name]"
                type="text"
                class="form-input"
                :placeholder="input.type"
              />
            </div>
            <button
              class="btn btn-primary"
              :disabled="testing || !store.flow.slug"
              @click="runTest"
            >
              {{ testing ? 'Testing...' : 'Run Test' }}
            </button>
            <div v-if="testResult" class="test-result">
              <pre>{{ JSON.stringify(testResult, null, 2) }}</pre>
            </div>
          </div>
        </template>

        <template v-else-if="store.selectedNode">
          <h3>Node Properties</h3>
          <div class="panel-section">
            <div class="form-group">
              <label class="form-label">Label</label>
              <input
                :value="store.selectedNode.data.label"
                type="text"
                class="form-input"
                @change="e => store.updateNodeData(store.selectedNode!.id, { label: (e.target as HTMLInputElement).value })"
              />
            </div>
            <div class="form-group">
              <label class="form-label">Block ID</label>
              <code class="block-id">{{ store.selectedNode.data.blockId }}</code>
            </div>
          </div>

          <h4 style="margin-top: 16px;">Input Mappings</h4>
          <div class="panel-section">
            <p style="font-size: 13px; color: var(--color-text-secondary);">
              Configure how this node receives input from other nodes or flow inputs.
            </p>
            <!-- Input mapping editor would go here -->
          </div>

          <button
            class="btn btn-danger btn-sm"
            style="margin-top: 16px;"
            @click="store.removeNode(store.selectedNode!.id)"
          >
            Delete Node
          </button>
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.flow-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-input {
  border: none;
  background: transparent;
  font-size: 18px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: var(--radius-md);
}

.title-input:hover,
.title-input:focus {
  background: var(--color-bg);
  outline: none;
}

.unsaved-indicator {
  font-size: 12px;
  color: var(--color-warning);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.editor-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.block-palette {
  width: 240px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
}

.block-palette h3 {
  padding: 16px;
  font-size: 14px;
  font-weight: 600;
  border-bottom: 1px solid var(--color-border);
}

.palette-search {
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
}

.palette-search .form-input {
  font-size: 13px;
}

.palette-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.palette-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: var(--radius-md);
  cursor: grab;
  transition: background 0.15s ease;
}

.palette-item:hover {
  background: var(--color-bg);
}

.palette-item-indicator {
  width: 4px;
  border-radius: 2px;
  flex-shrink: 0;
}

.palette-item-name {
  font-size: 13px;
  font-weight: 500;
}

.palette-item-type {
  font-size: 11px;
  color: var(--color-text-secondary);
  text-transform: uppercase;
}

.palette-empty {
  padding: 16px;
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
}

.canvas-container {
  flex: 1;
  position: relative;
}

.custom-node {
  padding: 12px 16px;
  background: white;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  min-width: 150px;
}

.custom-node.api_call { border-left: 4px solid #4f46e5; }
.custom-node.transform { border-left: 4px solid #06b6d4; }
.custom-node.condition { border-left: 4px solid #f59e0b; }

.node-label {
  font-weight: 500;
  font-size: 13px;
}

.node-type {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.property-panel {
  width: 300px;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  padding: 16px;
  overflow-y: auto;
}

.property-panel h3 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 16px;
}

.property-panel h4 {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.panel-section {
  padding: 12px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
}

.block-id {
  display: block;
  font-size: 12px;
  background: var(--color-surface);
  padding: 8px;
  border-radius: var(--radius-sm);
  word-break: break-all;
}

.test-result {
  margin-top: 12px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 12px;
  overflow-x: auto;
}

.test-result pre {
  font-size: 12px;
  margin: 0;
}
</style>
