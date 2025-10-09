<!-- filepath: /Users/b-mini/sites/thuenen/tfm/TFM-Documentation/components/ActionCellRenderer.vue -->
<script setup>
    import { withBase } from 'vitepress';
    import { onMounted, ref, shallowRef } from 'vue';
    import ClusterDetails from '../records/ClusterDetails.vue';

    const dialog = shallowRef(false)

    const props = defineProps({
        params: {
            type: Object,
            required: true
        }
    });

    function handleClick(e) {

        e.preventDefault();
        e.stopPropagation();

        if (props.params.onActionClick) {
            props.params.onActionClick(props.params.data);
        }
    }
</script>

<template>
    <v-badge 
        v-if="props.params.data.note && props.params.data.note.trim() !== ''" 
        bordered 
        location="top right"
        color="orange"
        dot
    >
        <v-btn
            variant="plain"
            icon="mdi-eye-outline"
            density="compact"
            :disabled="!props.params.onActionClick"
            @click="handleClick"
        ></v-btn>
    </v-badge>
    <v-btn
        v-else
        variant="plain"
        icon="mdi-eye-outline"
        density="compact"
        :disabled="!props.params.onActionClick"
        @click="handleClick"
    ></v-btn>
</template>