<!-- filepath: /Users/b-mini/sites/thuenen/tfm/TFM-Documentation/components/ActionCellRenderer.vue -->
<script setup>
import { withBase } from 'vitepress';
import { onMounted } from 'vue';

    const props = defineProps({
        params: {
            type: Object,
            required: true
        }
    });

    function handleClick(e) {
        e.preventDefault();
        e.stopPropagation();

        window.location.href = withBase('/dashboard/records/?clusterId=' + props.params.data.cluster_id);
    }
</script>

<template>
    <v-btn
        variant="plain"
        icon="mdi-history"
        density="compact"
        @click="handleClick"
    ></v-btn>
</template>