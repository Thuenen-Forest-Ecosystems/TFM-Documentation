<!-- filepath: /Users/b-mini/sites/thuenen/tfm/TFM-Documentation/components/ActionCellRenderer.vue -->
<script setup>
   const props = defineProps({
        params: {
            type: Object,
            required: true
        }
    });
</script>

<template>
    <v-icon v-if="params.value" density="compact" icon="mdi-message-outline"></v-icon>
</template>