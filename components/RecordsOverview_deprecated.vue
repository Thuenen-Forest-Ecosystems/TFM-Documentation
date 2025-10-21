<script setup>
    import { onMounted } from 'vue';
    import ListOfClusterRecord from './organizations/ListOfClusterRecord.vue';

    const props = defineProps({
        organization_id: String,
        organization_type: String,
        los: Array,
        cluster: Object
    });
    const emit = defineEmits(['confirm']);
    function cancelUpdate() {
        emit('confirm');
    }
</script>


<template>
    <ListOfClusterRecord :organization_id="props.organization_id" :organization_type="props.organization_type" @confirm="cancelUpdate" :cluster="props.cluster" />
</template>