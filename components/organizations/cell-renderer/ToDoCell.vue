<script setup>
    import { withBase } from 'vitepress';
    import { onMounted, ref, shallowRef, computed } from 'vue'; // Add computed import

    const dialog = shallowRef(false)
    const toDoState = ref('red');

    const props = defineProps({
        params: {
            type: Object,
            required: true
        }
    });
</script>

<template>
    {{toDoState}}
</template>