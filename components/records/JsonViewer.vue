<script setup>
    import { ref } from 'vue';
    import JsonNode from './JsonNode.vue';

    const props = defineProps({
        schema: {
            type: Object,
            required: true,
        },
        data: {
            required: true,
        },
        maxDepth: {
            type: Number,
            default: 20
        }
    });

    // Track expanded states for each node
    const expandedNodes = ref(new Set());

    // Toggle expansion state for a node
    const toggleNode = (path) => {
        if (expandedNodes.value.has(path)) {
            expandedNodes.value.delete(path);
        } else {
            expandedNodes.value.add(path);
        }
    };
</script>

<template>
    <JsonNode 
        :data="data" 
        :schema="schema"
        :path="''"
        :schema-path="''"
        :depth="0"
        :max-depth="maxDepth"
        :expanded-nodes="expandedNodes"
        @toggle="toggleNode"
    />
</template>



