import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Node, Edge } from '@vue-flow/core';
import type { Flow, FlowBlock, Block, Connection } from '@codeblock-bff/shared';
import { flowsApi, blocksApi } from '@/lib/api';

export const useFlowEditorStore = defineStore('flowEditor', () => {
  // State
  const flow = ref<Flow | null>(null);
  const nodes = ref<Node[]>([]);
  const edges = ref<Edge[]>([]);
  const availableBlocks = ref<Block[]>([]);
  const selectedNodeId = ref<string | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const hasChanges = ref(false);

  // Getters
  const selectedNode = computed(() => {
    if (!selectedNodeId.value) return null;
    return nodes.value.find(n => n.id === selectedNodeId.value) || null;
  });

  const selectedFlowBlock = computed(() => {
    if (!selectedNodeId.value || !flow.value) return null;
    return flow.value.blocks.find(b => b.id === selectedNodeId.value) || null;
  });

  // Actions
  async function loadFlow(flowId: string) {
    isLoading.value = true;
    try {
      const response = await flowsApi.get(flowId);
      if (response.success && response.data) {
        flow.value = response.data;
        syncFromFlow();
      }
    } finally {
      isLoading.value = false;
    }
  }

  async function loadBlocks() {
    const response = await blocksApi.list({ limit: 100 });
    if (response.success && response.data) {
      availableBlocks.value = response.data;
    }
  }

  function createNewFlow() {
    flow.value = {
      name: 'New Flow',
      slug: '',
      version: 1,
      blocks: [],
      connections: [],
      inputs: [],
      outputs: [],
      config: {},
      status: 'draft',
    };
    nodes.value = [];
    edges.value = [];
    hasChanges.value = false;
  }

  function syncFromFlow() {
    if (!flow.value) return;

    // Convert flow blocks to Vue Flow nodes
    nodes.value = flow.value.blocks.map(block => {
      const blockDef = availableBlocks.value.find(b => b._id === block.blockId);
      return {
        id: block.id,
        type: blockDef?.type || 'api_call',
        position: block.position,
        data: {
          label: blockDef?.name || 'Unknown Block',
          blockId: block.blockId,
          inputMappings: block.inputMappings,
          config: block.config,
        },
      };
    });

    // Convert connections to Vue Flow edges
    edges.value = flow.value.connections.map(conn => ({
      id: conn.id,
      source: conn.fromBlockId,
      target: conn.toBlockId,
      animated: true,
    }));

    hasChanges.value = false;
  }

  function syncToFlow() {
    if (!flow.value) return;

    // Convert Vue Flow nodes to flow blocks
    flow.value.blocks = nodes.value.map(node => ({
      id: node.id,
      blockId: node.data.blockId,
      position: node.position,
      inputMappings: node.data.inputMappings || [],
      config: node.data.config,
    }));

    // Convert Vue Flow edges to connections
    flow.value.connections = edges.value.map(edge => ({
      id: edge.id,
      fromBlockId: edge.source,
      toBlockId: edge.target,
    }));
  }

  function addNode(block: Block, position: { x: number; y: number }) {
    const nodeId = `node_${Date.now()}`;

    nodes.value.push({
      id: nodeId,
      type: block.type,
      position,
      data: {
        label: block.name,
        blockId: block._id,
        inputMappings: [],
        config: {},
      },
    });

    hasChanges.value = true;
    return nodeId;
  }

  function removeNode(nodeId: string) {
    nodes.value = nodes.value.filter(n => n.id !== nodeId);
    edges.value = edges.value.filter(e => e.source !== nodeId && e.target !== nodeId);

    if (selectedNodeId.value === nodeId) {
      selectedNodeId.value = null;
    }

    hasChanges.value = true;
  }

  function addEdge(source: string, target: string) {
    const edgeId = `edge_${Date.now()}`;

    // Check for existing edge
    const exists = edges.value.some(e => e.source === source && e.target === target);
    if (exists) return;

    edges.value.push({
      id: edgeId,
      source,
      target,
      animated: true,
    });

    hasChanges.value = true;
    return edgeId;
  }

  function removeEdge(edgeId: string) {
    edges.value = edges.value.filter(e => e.id !== edgeId);
    hasChanges.value = true;
  }

  function selectNode(nodeId: string | null) {
    selectedNodeId.value = nodeId;
  }

  function updateNodePosition(nodeId: string, position: { x: number; y: number }) {
    const node = nodes.value.find(n => n.id === nodeId);
    if (node) {
      node.position = position;
      hasChanges.value = true;
    }
  }

  function updateNodeData(nodeId: string, data: Partial<Node['data']>) {
    const node = nodes.value.find(n => n.id === nodeId);
    if (node) {
      node.data = { ...node.data, ...data };
      hasChanges.value = true;
    }
  }

  function updateFlowInfo(info: Partial<Pick<Flow, 'name' | 'description' | 'slug' | 'inputs' | 'outputs' | 'config'>>) {
    if (flow.value) {
      Object.assign(flow.value, info);
      hasChanges.value = true;
    }
  }

  async function saveFlow() {
    if (!flow.value) return null;

    syncToFlow();
    isSaving.value = true;

    try {
      let response;

      if (flow.value._id) {
        response = await flowsApi.update(flow.value._id, {
          name: flow.value.name,
          description: flow.value.description,
          slug: flow.value.slug,
          blocks: flow.value.blocks,
          connections: flow.value.connections,
          inputs: flow.value.inputs,
          outputs: flow.value.outputs,
          config: flow.value.config,
          tags: flow.value.tags,
        });
      } else {
        response = await flowsApi.create({
          name: flow.value.name,
          description: flow.value.description,
          slug: flow.value.slug,
          blocks: flow.value.blocks,
          connections: flow.value.connections,
          inputs: flow.value.inputs,
          outputs: flow.value.outputs,
          config: flow.value.config,
          tags: flow.value.tags,
        });
      }

      if (response.success && response.data) {
        flow.value = response.data;
        hasChanges.value = false;
        return flow.value;
      }

      return null;
    } finally {
      isSaving.value = false;
    }
  }

  async function publishFlow() {
    if (!flow.value?._id) return null;

    const response = await flowsApi.publish(flow.value._id);
    if (response.success && response.data) {
      flow.value = response.data;
      return flow.value;
    }
    return null;
  }

  return {
    // State
    flow,
    nodes,
    edges,
    availableBlocks,
    selectedNodeId,
    isLoading,
    isSaving,
    hasChanges,
    // Getters
    selectedNode,
    selectedFlowBlock,
    // Actions
    loadFlow,
    loadBlocks,
    createNewFlow,
    syncFromFlow,
    syncToFlow,
    addNode,
    removeNode,
    addEdge,
    removeEdge,
    selectNode,
    updateNodePosition,
    updateNodeData,
    updateFlowInfo,
    saveFlow,
    publishFlow,
  };
});
